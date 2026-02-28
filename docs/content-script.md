# Content Script 設計

## 概要

Content Script は Google Meet ページ上で動作し、字幕の自動有効化と DOM 監視によるリアルタイム字幕取得を行う。ロジックは最小限に留め、データ抽出と Background への送信のみを担う。

## WXT エントリポイント設定

```typescript
// entrypoints/content.ts
export default defineContentScript({
  matches: ['https://meet.google.com/*'],
  runAt: 'document_idle',
  main() {
    enableCaptions();
    observeCaptions();
  },
});
```

## 字幕 DOM 構造

Google Meet の字幕は以下の DOM 構造で描画される（2024–2025 年時点）。

```html
<!-- 字幕コンテナ -->
<div jscontroller="...">
  <!-- 各発言者のブロック -->
  <div class="...">
    <!-- 発言者名 -->
    <div class="...">発言者名</div>
    <!-- 字幕テキスト -->
    <span>字幕テキストがここに表示される</span>
  </div>
</div>
```

### セレクタ戦略

Google Meet は CSS クラス名が難読化されているため、安定したセレクタ選択が重要。

| 要素 | セレクタ戦略 | 説明 |
|---|---|---|
| 字幕コンテナ | `[jscontroller]` 内の特定構造 | 字幕表示領域の最外殻 |
| 発言者名 | 字幕ブロック内の最初の子要素 | テキストノードから取得 |
| 字幕テキスト | 字幕ブロック内の `<span>` | 発話内容 |

### セレクタ定義 (`utils/caption-parser.ts`)

```typescript
// セレクタは Google Meet の DOM 変更に応じて更新する
// 一箇所に集約して変更影響を最小化する
export const SELECTORS = {
  // 字幕コンテナ: data 属性や構造ベースで特定
  captionContainer: '[jscontroller] div[class]',
  // CC ボタン: aria-label ベースで EN/JA 両対応
  ccButtonEn: 'button[aria-label="Turn on captions"]',
  ccButtonJa: 'button[aria-label="字幕をオンにする"]',
  // 字幕 ON 状態判定
  ccButtonActiveEn: 'button[aria-label="Turn off captions"]',
  ccButtonActiveJa: 'button[aria-label="字幕をオフにする"]',
} as const;
```

## 字幕自動 ON ロジック

### フロー

```
Meet ページロード
    │
    ▼
document_idle で Content Script 起動
    │
    ▼
CC ボタンを検索 (EN / JA)
    │
    ├─ 見つかった → 字幕 OFF 状態か判定
    │   ├─ OFF → クリックして ON にする
    │   └─ ON → 何もしない
    │
    └─ 見つからない → リトライ (MutationObserver で DOM 変更を待つ)
```

### 実装方針

```typescript
async function enableCaptions(): Promise<void> {
  const maxRetries = 10;
  const retryInterval = 2000; // 2秒間隔

  for (let i = 0; i < maxRetries; i++) {
    // 既に ON ならスキップ
    const activeButton = document.querySelector(
      `${SELECTORS.ccButtonActiveEn}, ${SELECTORS.ccButtonActiveJa}`
    );
    if (activeButton) return;

    // OFF 状態のボタンを探してクリック
    const ccButton = document.querySelector<HTMLButtonElement>(
      `${SELECTORS.ccButtonEn}, ${SELECTORS.ccButtonJa}`
    );
    if (ccButton) {
      ccButton.click();
      return;
    }

    // ボタンが未出現なら待機してリトライ
    await new Promise((r) => setTimeout(r, retryInterval));
  }

  console.warn('[kanpe] CC button not found after retries');
}
```

- Meet のロード完了タイミングはネットワーク状況で変動するため、リトライ方式を採用
- `aria-label` ベースで EN/JA 両ロケールに対応
- 既に字幕 ON の場合は二重クリックを防止

## MutationObserver 実装

### 監視戦略

```typescript
function observeCaptions(): void {
  // 字幕コンテナが出現するまで待機
  waitForElement('[jscontroller]').then((container) => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const parsed = parseCaptionDOM(container);
          if (parsed) {
            messenger.sendMessage('caption:new', parsed);
          }
        }
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}
```

### パーサー (`utils/caption-parser.ts`)

```typescript
interface Utterance {
  speaker: string;
  text: string;
  time: string;
}

// 前回の発話を記録して重複送信を防止
let lastUtterance: { speaker: string; text: string } | null = null;

export function parseCaptionDOM(container: Element): Utterance | null {
  // 字幕ブロックを取得（最後のブロック = 現在の発話）
  const blocks = container.querySelectorAll(':scope > div');
  if (blocks.length === 0) return null;

  const lastBlock = blocks[blocks.length - 1];
  const speaker = extractSpeaker(lastBlock);
  const text = extractText(lastBlock);

  if (!speaker || !text) return null;

  // 重複チェック
  if (lastUtterance?.speaker === speaker && lastUtterance?.text === text) {
    return null;
  }

  lastUtterance = { speaker, text };

  return {
    speaker,
    text,
    time: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
  };
}
```

### 重複排除

Google Meet の字幕は文字が追加されるたびに DOM が更新される。同じ発話の途中更新を検知するため:

1. **テキスト完全一致チェック**: 前回送信と同じ speaker + text なら送信しない
2. **デバウンス**: 高頻度の DOM 更新に対して 300ms のデバウンスを適用
3. **発話区切り判定**: 話者が変わった時点で前の発話を確定として送信

```typescript
// デバウンス付き送信
const debouncedSend = debounce((utterance: Utterance) => {
  messenger.sendMessage('caption:new', utterance);
}, 300);
```

## DOM 変更への耐性戦略

Google Meet は頻繁に DOM 構造を変更する。以下の戦略で耐性を確保する。

### 1. セレクタの一元管理

全セレクタを `utils/caption-parser.ts` の `SELECTORS` オブジェクトに集約。DOM 変更時の修正箇所を最小化する。

### 2. 構造ベースのセレクタ

クラス名（難読化されて不安定）ではなく、以下を優先する:
- `aria-label` 属性（アクセシビリティ要件により安定）
- DOM 構造（親子関係、兄弟関係）
- `data-*` 属性
- `jscontroller` / `jsaction` 属性

### 3. フォールバック戦略

```typescript
function findCaptionContainer(): Element | null {
  // Strategy 1: 既知のセレクタ
  const primary = document.querySelector(SELECTORS.captionContainer);
  if (primary) return primary;

  // Strategy 2: テキスト内容ベースの探索
  // 字幕テキストが含まれる要素を構造的に特定
  const candidates = document.querySelectorAll('div[jscontroller]');
  for (const el of candidates) {
    if (looksLikeCaptionContainer(el)) return el;
  }

  return null;
}
```

### 4. エラーリカバリ

Observer が監視対象を失った場合、自動的に再接続を試みる。

```typescript
// 定期的に監視対象の存在を確認
setInterval(() => {
  if (!document.contains(observedElement)) {
    observer.disconnect();
    observeCaptions(); // 再接続
  }
}, 5000);
```
