# AI Integration 設計

## 概要

Background Service Worker から Anthropic Messages API を直接 `fetch()` で呼び出す。ユーザーの BYOK（Bring Your Own Key）方式で、API キーは `chrome.storage.local` に保存する。

## Anthropic API 呼び出し

### クライアント (`lib/anthropic.ts`)

```typescript
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

interface AnthropicResponse {
  content: Array<{ type: 'text'; text: string }>;
}

export async function callAnthropic(
  apiKey: string,
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error);
  }

  const data: AnthropicResponse = await response.json();
  return data.content[0].text;
}
```

### API キー管理

```typescript
// lib/anthropic.ts
export async function getApiKey(): Promise<string | null> {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  return apiKey ?? null;
}

export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ apiKey: key });
}

export function validateApiKey(key: string): boolean {
  return key.startsWith('sk-ant-');
}
```

## AI アクション — プロンプト設計

### 共通システムプロンプト

```typescript
// lib/prompts.ts
const SYSTEM_BASE = `You are Kanpe, an AI meeting assistant for Google Meet.
You are given a transcript of the ongoing meeting.
Respond concisely and actionably. Use the same language as the transcript.`;
```

### アクション別プロンプト

#### Recap（会議要約）

```typescript
export const PROMPTS = {
  recap: {
    system: `${SYSTEM_BASE}
Your task is to summarize the meeting so far.
- Highlight key topics discussed
- Note any decisions made
- Keep it concise (3-5 bullet points)`,
    userTemplate: (transcript: string) =>
      `Here is the meeting transcript so far:\n\n${transcript}\n\nPlease provide a recap.`,
  },
```

#### Assist（発言提案）

```typescript
  assist: {
    system: `${SYSTEM_BASE}
Your task is to suggest what the user should say next.
- Consider the flow of the conversation
- Provide 2-3 concrete suggestions
- Each suggestion should be a complete sentence ready to speak`,
    userTemplate: (transcript: string) =>
      `Here is the meeting transcript so far:\n\n${transcript}\n\nWhat should I say next?`,
  },
```

#### Question（質問提案）

```typescript
  question: {
    system: `${SYSTEM_BASE}
Your task is to suggest relevant questions to ask.
- Identify gaps or unclear points in the discussion
- Provide 2-3 specific questions
- Questions should move the meeting forward productively`,
    userTemplate: (transcript: string) =>
      `Here is the meeting transcript so far:\n\n${transcript}\n\nWhat questions should I ask?`,
  },
```

#### Action（TODO 抽出）

```typescript
  action: {
    system: `${SYSTEM_BASE}
Your task is to extract action items and decisions.
- List each action item with the responsible person (if mentioned)
- Include any deadlines mentioned
- Separate decisions from action items
- Format as a clear checklist`,
    userTemplate: (transcript: string) =>
      `Here is the meeting transcript so far:\n\n${transcript}\n\nPlease extract action items and decisions.`,
  },
} as const;
```

### トランスクリプトのフォーマット

```typescript
// lib/prompts.ts
export function formatTranscript(utterances: Utterance[]): string {
  return utterances
    .map((u) => `[${u.time}] ${u.speaker}: ${u.text}`)
    .join('\n');
}
```

出力例:
```
[14:30:15] Tanaka: 今四半期の売上について報告します
[14:30:28] Tanaka: 前年比 120% で推移しています
[14:30:45] Suzuki: それは素晴らしいですね。要因は何ですか？
```

## 自由入力チャット

### コンテキスト構築

```typescript
// lib/prompts.ts
export const CHAT_SYSTEM = `${SYSTEM_BASE}
You are having a conversation with the meeting participant.
Use the provided meeting transcript as context to answer their questions.
If the question is unrelated to the meeting, still try to help but note the context.`;

export function buildChatMessages(
  transcript: string,
  history: ChatMessage[],
  newMessage: string,
): { role: 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  // 最初のメッセージにトランスクリプトを含める
  if (history.length === 0) {
    messages.push({
      role: 'user',
      content: `Meeting transcript:\n\n${transcript}\n\n---\n\n${newMessage}`,
    });
  } else {
    // 2回目以降: 履歴を再現 + 新メッセージ
    messages.push({
      role: 'user',
      content: `Meeting transcript:\n\n${transcript}\n\n---\n\n${history[0].content}`,
    });
    for (let i = 1; i < history.length; i++) {
      messages.push({
        role: history[i].role,
        content: history[i].content,
      });
    }
    messages.push({ role: 'user', content: newMessage });
  }

  return messages;
}
```

### トークン管理

トランスクリプトが長大になる場合の対策:

1. **トランスクリプト長の上限**: 直近 N 件（デフォルト: 200 発話）に制限
2. **古い発話の省略**: 上限超過時は冒頭に `[... earlier conversation omitted ...]` を付与
3. **MVP では固定値**: 設定での変更は Post-MVP

```typescript
export function truncateTranscript(
  utterances: Utterance[],
  maxCount = 200,
): Utterance[] {
  if (utterances.length <= maxCount) return utterances;
  return utterances.slice(-maxCount);
}
```

## エラーハンドリング

### カスタムエラー

```typescript
// lib/anthropic.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Anthropic API error: ${status}`);
    this.name = 'ApiError';
  }
}
```

### エラー分類と UI 表示

| HTTP Status | 原因 | ユーザー向けメッセージ |
|---|---|---|
| 401 | API キー無効 | "API key is invalid. Please check your settings." |
| 429 | レート制限 | "Rate limit exceeded. Please wait a moment." |
| 500+ | サーバーエラー | "AI service is temporarily unavailable." |
| Network Error | 通信失敗 | "Network error. Please check your connection." |
| — | API キー未設定 | "Please set your API key in Settings." |

### Background でのエラーハンドリング

```typescript
// entrypoints/background.ts (onMessage handler)
messenger.onMessage('ai:request', async ({ data }) => {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { error: 'API_KEY_NOT_SET', content: null };
  }

  try {
    const transcript = formatTranscript(data.utterances);
    const prompt = PROMPTS[data.action];
    const result = await callAnthropic(
      apiKey,
      prompt.system,
      [{ role: 'user', content: prompt.userTemplate(transcript) }],
    );
    return { error: null, content: result };
  } catch (e) {
    if (e instanceof ApiError) {
      return { error: classifyApiError(e.status), content: null };
    }
    return { error: 'UNKNOWN_ERROR', content: null };
  }
});
```
