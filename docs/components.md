# Components 設計

## Side Panel 構成

```
App
├── Header                    # ロゴ + ナビゲーション
├── TranscriptPanel           # 字幕リアルタイム表示
│   └── UtteranceItem         # 個別発言行
├── AiActionBar               # 4 つの AI アクションボタン
│   └── ActionButton          # 個別ボタン
├── AiResponsePanel           # AI レスポンス表示
├── ChatPanel                 # 自由入力チャット
│   ├── ChatMessage           # 個別メッセージ
│   └── ChatInput             # 入力フォーム
└── SettingsPanel             # 設定画面
    └── ApiKeyForm            # API キー入力
```

## コンポーネント詳細

### App (`entrypoints/sidepanel/App.tsx`)

ルートコンポーネント。`currentView` に応じて表示を切り替える。

```typescript
function App() {
  const currentView = useMeetingStore((s) => s.currentView);

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header />
      {currentView === 'transcript' && (
        <>
          <TranscriptPanel />
          <AiActionBar />
          <AiResponsePanel />
        </>
      )}
      {currentView === 'chat' && <ChatPanel />}
      {currentView === 'settings' && <SettingsPanel />}
    </div>
  );
}
```

### Header

ナビゲーションタブで `transcript` / `chat` / `settings` を切り替える。

| 要素 | 説明 |
|---|---|
| ロゴ | Kanpe ロゴ |
| Transcript タブ | 字幕 + AI ビュー |
| Chat タブ | 自由入力チャット |
| Settings タブ | 設定画面 |

### TranscriptPanel (`components/TranscriptPanel.tsx`)

字幕のリアルタイム表示。新しい発言が追加されると自動スクロールする。

```typescript
function TranscriptPanel() {
  const utterances = useMeetingStore((s) => s.utterances);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [utterances]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {utterances.length === 0 ? (
        <EmptyState message="Waiting for captions..." />
      ) : (
        utterances.map((u, i) => <UtteranceItem key={i} utterance={u} />)
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

#### UtteranceItem

| プロパティ | 表示 |
|---|---|
| `time` | グレーのタイムスタンプ |
| `speaker` | ボールドの話者名 |
| `text` | 発言テキスト |

### AiActionBar (`components/AiActionBar.tsx`)

4 つの AI アクションボタンを横並びで表示。

```typescript
const AI_ACTIONS = [
  { id: 'recap', label: 'Recap', icon: '📋' },
  { id: 'assist', label: 'Assist', icon: '💡' },
  { id: 'question', label: 'Question', icon: '❓' },
  { id: 'action', label: 'Action', icon: '✅' },
] as const;

function AiActionBar() {
  const { executeAction, isLoading } = useAiAction();

  return (
    <div className="flex gap-2 p-4 border-t">
      {AI_ACTIONS.map((action) => (
        <ActionButton
          key={action.id}
          action={action}
          onClick={() => executeAction(action.id)}
          disabled={isLoading}
        />
      ))}
    </div>
  );
}
```

### AiResponsePanel

AI アクションの結果を表示するパネル。最新のレスポンスを表示する。

```typescript
function AiResponsePanel() {
  const aiResponses = useMeetingStore((s) => s.aiResponses);
  const isAiLoading = useMeetingStore((s) => s.isAiLoading);
  const latest = aiResponses[aiResponses.length - 1];

  if (isAiLoading) return <LoadingIndicator />;
  if (!latest) return null;

  return (
    <div className="p-4 border-t bg-gray-50">
      <div className="text-sm font-medium text-gray-500 mb-2">
        {latest.action}
      </div>
      <div className="prose prose-sm">{latest.content}</div>
    </div>
  );
}
```

### ChatPanel (`components/ChatPanel.tsx`)

自由入力チャットの UI。チャット履歴とテキスト入力フォームで構成。

```typescript
function ChatPanel() {
  const { chatHistory, sendMessage, isLoading } = useChat();

  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {isLoading && <LoadingIndicator />}
      </div>
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
```

#### ChatInput

テキスト入力と送信ボタン。Enter キーで送信、Shift+Enter で改行。

### SettingsPanel (`components/SettingsPanel.tsx`)

API キーの入力・保存 UI。

```typescript
function SettingsPanel() {
  const { apiKey, saveApiKey, isValid, isSaving } = useSettings();

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Settings</h2>
      <ApiKeyForm
        value={apiKey}
        onSave={saveApiKey}
        isValid={isValid}
        isSaving={isSaving}
      />
    </div>
  );
}
```

#### ApiKeyForm

| 要素 | 説明 |
|---|---|
| テキスト入力 | `type="password"` で API キーを入力 |
| Save ボタン | キーを保存 |
| バリデーション表示 | `sk-ant-` プレフィックスチェック結果 |
| ステータス | 保存成功/失敗のフィードバック |

## Hooks 設計

### useTranscript (`hooks/useTranscript.ts`)

字幕データの購読と Background からのメッセージ受信を管理。

```typescript
export function useTranscript() {
  const utterances = useMeetingStore((s) => s.utterances);

  useEffect(() => {
    // Background からの字幕転送を受信
    messenger.onMessage('caption:relay', (data) => {
      useMeetingStore.getState().addUtterance(data);
    });
  }, []);

  return { utterances };
}
```

### useAiAction (`hooks/useAiAction.ts`)

AI アクションボタンの実行ロジック。

```typescript
export function useAiAction() {
  const utterances = useMeetingStore((s) => s.utterances);
  const isLoading = useMeetingStore((s) => s.isAiLoading);

  const executeAction = async (action: 'recap' | 'assist' | 'question' | 'action') => {
    useMeetingStore.getState().setAiLoading(true);
    try {
      const response = await messenger.sendMessage('ai:request', {
        action,
        utterances,
      });
      if (response.error) {
        // エラーハンドリング
        return;
      }
      useMeetingStore.getState().addAiResponse({
        action,
        content: response.content,
        timestamp: new Date().toISOString(),
      });
    } finally {
      useMeetingStore.getState().setAiLoading(false);
    }
  };

  return { executeAction, isLoading };
}
```

### useChat (`hooks/useChat.ts`)

自由入力チャットの送受信ロジック。

```typescript
export function useChat() {
  const chatHistory = useMeetingStore((s) => s.chatHistory);
  const utterances = useMeetingStore((s) => s.utterances);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (message: string) => {
    const store = useMeetingStore.getState();
    store.addChatMessage({ role: 'user', content: message });
    setIsLoading(true);

    try {
      const response = await messenger.sendMessage('chat:send', {
        message,
        utterances,
        history: store.chatHistory,
      });
      if (response.error) {
        // エラーハンドリング
        return;
      }
      store.addChatMessage({ role: 'assistant', content: response.content });
    } finally {
      setIsLoading(false);
    }
  };

  return { chatHistory, sendMessage, isLoading };
}
```

### useSettings (`hooks/useSettings.ts`)

API キーの読み込み・保存・バリデーション。

```typescript
export function useSettings() {
  const [apiKey, setApiKey] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    messenger.sendMessage('settings:getApiKey').then((key) => {
      if (key) setApiKey(key);
    });
  }, []);

  const saveApiKey = async (key: string) => {
    const valid = key.startsWith('sk-ant-');
    setIsValid(valid);
    if (!valid) return;

    setIsSaving(true);
    try {
      await messenger.sendMessage('settings:setApiKey', key);
      setApiKey(key);
    } finally {
      setIsSaving(false);
    }
  };

  return { apiKey, saveApiKey, isValid, isSaving };
}
```
