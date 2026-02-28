# Architecture

## Extension コンテキスト構成

Chrome Extension Manifest V3 の 3 つのコンテキストで構成する。

```
┌─────────────────────────────────────────────────────┐
│  Google Meet Tab                                    │
│  ┌───────────────────────────────────────────────┐  │
│  │  Content Script (entrypoints/content.ts)      │  │
│  │  - 字幕 DOM 監視 (MutationObserver)           │  │
│  │  - 字幕自動 ON                                │  │
│  │  - 話者名 + テキスト + タイムスタンプ抽出      │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │  sendMessage('caption')       │
└─────────────────────┼───────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────┐
│  Background SW      │  (entrypoints/background.ts)  │
│  ┌──────────────────▼────────────────────────────┐  │
│  │  onMessage handler                            │  │
│  │  - caption → store & relay to Side Panel      │  │
│  │  - ai:request → Anthropic API call            │  │
│  │  - settings:get/set → chrome.storage          │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │                               │
│  ┌──────────────────▼────────────────────────────┐  │
│  │  Anthropic API Client (lib/anthropic.ts)      │  │
│  │  - fetch() で Messages API を直接呼び出し     │  │
│  │  - BYOK: storage から API キーを取得          │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────┼───────────────────────────────┘
                      │  sendMessage('ai:response')
┌─────────────────────┼───────────────────────────────┐
│  Side Panel         │  (entrypoints/sidepanel/)     │
│  ┌──────────────────▼────────────────────────────┐  │
│  │  React 19 + Tailwind CSS v4                   │  │
│  │  - TranscriptPanel: 字幕リアルタイム表示      │  │
│  │  - AiActionBar: 4 ボタン UI                   │  │
│  │  - ChatPanel: 自由入力チャット                │  │
│  │  - SettingsPanel: API キー設定                │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Zustand Store (stores/meetingStore.ts)        │  │
│  │  - utterances[], aiResponses[], chatHistory[]  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## 各コンテキストの責務

### Content Script (`entrypoints/content.ts`)

| 責務 | 詳細 |
|---|---|
| URL マッチ | `https://meet.google.com/*` でのみ起動 |
| 字幕自動 ON | CC ボタンを自動クリック |
| DOM 監視 | MutationObserver で字幕コンテナを監視 |
| データ抽出 | 話者名・テキスト・タイムスタンプを構造化 |
| メッセージ送信 | 抽出データを Background へ送信 |

Content Script にはロジックを持たせない。DOM 操作とデータ抽出のみに限定する。

### Background Service Worker (`entrypoints/background.ts`)

| 責務 | 詳細 |
|---|---|
| メッセージ中継 | Content Script ↔ Side Panel のブリッジ |
| サイドパネル制御 | Meet タブでの自動表示 (`chrome.sidePanel.setOptions`) |
| AI API 呼び出し | Anthropic Messages API への fetch |
| ストレージ管理 | API キーの読み書き |
| セッション管理 | 字幕データの一時保持 |

### Side Panel (`entrypoints/sidepanel/`)

| 責務 | 詳細 |
|---|---|
| 字幕表示 | リアルタイムトランスクリプト |
| AI 操作 | 4 つのプリセットボタン + 自由入力 |
| 結果表示 | AI レスポンスの表示 |
| 設定 | API キー入力 UI |

## メッセージフロー

### ProtocolMap 定義 (`lib/messaging.ts`)

`@webext-core/messaging` の `defineExtensionMessaging` を使用して型安全なメッセージングを実現する。

```typescript
import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
  // Content Script → Background
  'caption:new': (data: { speaker: string; text: string; time: string }) => void;

  // Background → Side Panel (字幕中継)
  'caption:relay': (data: { speaker: string; text: string; time: string }) => void;

  // Side Panel → Background → Side Panel
  'ai:request': (data: {
    action: 'recap' | 'assist' | 'question' | 'action';
    utterances: Utterance[];
  }) => AiResponse;

  // Side Panel → Background → Side Panel
  'chat:send': (data: {
    message: string;
    utterances: Utterance[];
    history: ChatMessage[];
  }) => AiResponse;

  // Side Panel → Background (設定)
  'settings:getApiKey': () => string | null;
  'settings:setApiKey': (key: string) => void;
}

export const messenger = defineExtensionMessaging<ProtocolMap>();
```

### フロー図

```
1. 字幕取得フロー
   Content Script                Background              Side Panel
       │                            │                        │
       │── caption:new ────────────►│                        │
       │   {speaker, text, time}    │── caption:relay ──────►│
       │                            │                        │── store に追加
       │                            │                        │── UI 更新

2. AI アクションフロー
   Side Panel                   Background              Anthropic API
       │                            │                        │
       │── ai:request ─────────────►│                        │
       │   {action, utterances}     │── fetch ──────────────►│
       │                            │◄─ response ────────────│
       │◄─ AiResponse ─────────────│                        │
       │── store に追加             │                        │
       │── UI 更新                  │                        │

3. チャットフロー
   Side Panel                   Background              Anthropic API
       │                            │                        │
       │── chat:send ──────────────►│                        │
       │   {message, utterances,    │── fetch ──────────────►│
       │    history}                │◄─ response ────────────│
       │◄─ AiResponse ─────────────│                        │
       │── chatHistory に追加       │                        │
       │── UI 更新                  │                        │
```

## 状態管理 (Zustand Store)

### `stores/meetingStore.ts`

```typescript
import { create } from 'zustand';

interface Utterance {
  speaker: string;
  text: string;
  time: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiResponse {
  action: string;
  content: string;
  timestamp: string;
}

type View = 'transcript' | 'chat' | 'settings';

interface MeetingState {
  // 字幕データ
  utterances: Utterance[];
  addUtterance: (u: Utterance) => void;

  // AI レスポンス
  aiResponses: AiResponse[];
  addAiResponse: (r: AiResponse) => void;

  // チャット
  chatHistory: ChatMessage[];
  addChatMessage: (m: ChatMessage) => void;

  // AI ローディング状態
  isAiLoading: boolean;
  setAiLoading: (loading: boolean) => void;

  // 現在のビュー
  currentView: View;
  setView: (view: View) => void;

  // リセット
  reset: () => void;
}
```

Side Panel の React コンポーネントは `useStore()` でサブスクライブする。
Background からのメッセージ受信時は `useStore.getState().addUtterance()` のように React ツリー外から直接更新する。

## サイドパネル自動表示

Background SW で `chrome.tabs.onUpdated` を監視し、Meet URL のタブでサイドパネルを有効化する。

```typescript
// entrypoints/background.ts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url?.match(/^https:\/\/meet\.google\.com\/.+/)) {
    chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true,
    });
    // 自動で開く
    chrome.sidePanel.open({ tabId });
  }
});
```
