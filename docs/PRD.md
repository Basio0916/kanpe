# Kanpe v2 — Product Requirements Document

## 1. Overview

Kanpe v2 は Google Meet 専用のミーティングアシスト Chrome 拡張機能。
字幕をリアルタイムで取得・蓄積し、AI が会議のコンテキストを理解した上でユーザーをアシストする。

## 2. Goals

- 会議中の発言をリアルタイムに構造化して記録する
- ワンクリックで要約・提案・質問・アクション抽出を行う
- ユーザーの BYOK（Bring Your Own Key）で Anthropic API を利用する

## 3. Target User

- Google Meet を日常的に使用するビジネスユーザー
- 会議中にリアルタイムのAIアシストを求める人

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Extension | Chrome Extension Manifest V3 |
| 字幕取得・DOM操作 | Content Script |
| サイドパネルUI | Side Panel API |
| UI Framework | React + Tailwind CSS |
| AI | Anthropic API（BYOK） |

## 5. Features

### 5.1 自動起動

- `https://meet.google.com/*` にマッチしたら Content Script を起動
- サイドパネルを自動表示する

**Acceptance Criteria:**
- Meet の URL に遷移するとサイドパネルが自動で開く
- Meet 以外の URL では起動しない

### 5.2 字幕自動ON

- Meet ページ読み込み後、字幕ボタンを自動クリックして有効化
- EN / JA ロケールに対応（ボタンの `aria-label` 等で判定）

**Acceptance Criteria:**
- Meet 参加時に字幕が自動で ON になる
- 英語 UI・日本語 UI の両方で動作する

### 5.3 字幕取得・話者識別

- `MutationObserver` で字幕 DOM をリアルタイム監視
- 発言者名 + テキスト + タイムスタンプの構造化データとして記録

```typescript
interface Utterance {
  speaker: string;   // 発言者名
  text: string;      // 発言テキスト
  time: string;      // タイムスタンプ (HH:mm:ss)
}
```

**Acceptance Criteria:**
- 発言がリアルタイムに蓄積される
- 話者が正しく識別される
- タイムスタンプが付与される

### 5.4 AI 機能（ワンボタン）

4 つのプリセットボタンを提供する:

| Button | 機能 | 説明 |
|---|---|---|
| **Recap** | 会議要約 | これまでの会議内容を要約する |
| **Assist** | 発言提案 | 次に言うべきことを提案する |
| **Question** | 質問提案 | 今の流れで聞くべき質問を提案する |
| **Action** | TODO抽出 | 決定事項・アクションアイテムを抽出する |

- 各ボタン押下時に蓄積済み字幕全文をコンテキストとして LLM に送信
- レスポンスをサイドパネル内に表示

**Acceptance Criteria:**
- 各ボタンが機能し、適切な結果が表示される
- レスポンス待ちの間はローディング状態を表示する
- APIキー未設定時はエラーメッセージを表示する

### 5.5 自由入力チャット

- 「Ask a question...」フォームからユーザーが自由に質問できる
- 字幕全文をコンテキストに含めて LLM に送信
- 会話履歴をセッション内で保持する

**Acceptance Criteria:**
- テキスト入力 → 送信 → レスポンス表示の一連のフローが動作する
- 字幕コンテキストが正しく含まれる

### 5.6 セッション保存（Post-MVP）

- Meet 終了時（URL 変更検知）に自動保存
- 保存内容: 字幕全文・参加者リスト・開始/終了時刻・自動要約
- 保存先: `chrome.storage.local`

### 5.7 セッション一覧（Post-MVP）

- 過去セッションをサイドパネルで一覧表示
- タップで詳細（字幕・要約・アクションリスト）を確認

## 6. Architecture

```
┌─────────────────────────────────────────────┐
│  Google Meet Tab                            │
│  ┌───────────────────────────────────────┐  │
│  │  Content Script                       │  │
│  │  - 字幕 DOM 監視 (MutationObserver)   │  │
│  │  - 字幕自動ON                         │  │
│  └──────────────┬────────────────────────┘  │
│                 │ chrome.runtime.sendMessage │
└─────────────────┼───────────────────────────┘
                  │
┌─────────────────┼───────────────────────────┐
│  Background     │ (Service Worker)          │
│  - メッセージ中継                            │
│  - サイドパネル自動表示制御                    │
│  - Anthropic API 呼び出し                    │
└─────────────────┼───────────────────────────┘
                  │
┌─────────────────┼───────────────────────────┐
│  Side Panel     │ (React + Tailwind)        │
│  - 字幕表示                                  │
│  - AI ボタン (Recap/Assist/Question/Action)  │
│  - 自由入力チャット                           │
│  - 設定画面 (API キー)                       │
└─────────────────────────────────────────────┘
```

### Message Flow

1. **Content Script** → 字幕 DOM を監視し、新しい発言を検出
2. **Content Script → Background** → `chrome.runtime.sendMessage` で発言データを送信
3. **Background → Side Panel** → `chrome.runtime.sendMessage` で Side Panel に転送
4. **Side Panel** → 発言データを蓄積・表示
5. **Side Panel → Background** → AI ボタン押下時にリクエスト送信
6. **Background → Anthropic API** → 字幕コンテキスト + プロンプトを送信
7. **Anthropic API → Background → Side Panel** → レスポンスを表示

## 7. MVP Scope

### IN（MVP）

- [ ] 字幕自動 ON
- [ ] 字幕取得・話者識別・蓄積
- [ ] サイドパネル UI
- [ ] 4 ボタン（Recap / Assist / Question / Action）→ LLM 連携
- [ ] 自由入力チャット → LLM 連携
- [ ] API キー設定画面

### OUT（Post-MVP）

- セッション保存・一覧
- マネタイズ機能
- 複数言語対応（UI の多言語化）

## 8. Settings

### API Key 設定

- サイドパネル内の設定画面から Anthropic API キーを入力
- `chrome.storage.local` に暗号化なしで保存（MVP）
- キーの有効性を簡易バリデーション（`sk-ant-` プレフィックス確認）

## 9. Non-Functional Requirements

- **パフォーマンス**: 字幕監視が Meet の動作に影響を与えないこと
- **プライバシー**: 字幕データは外部サーバーに送信しない（Anthropic API への送信時のみ）
- **エラーハンドリング**: API エラー時に適切なメッセージを表示する
