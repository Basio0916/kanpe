# Kanpe v2 — Development Guide

Google Meet AI アシスト Chrome 拡張機能。字幕をリアルタイム取得し、AI が会議コンテキストを理解してユーザーをアシストする。

## Tech Stack

| Layer | Technology |
|---|---|
| Build | WXT (Vite ベース) |
| Package Manager | Bun |
| UI | React 19 + Tailwind CSS v4 |
| State | Zustand |
| Messaging | @webext-core/messaging |
| Lint/Format | Biome |
| Test | Vitest |
| AI | Anthropic Messages API (fetch, BYOK) |

## Directory Structure

```
kanpe-chrome/
├── CLAUDE.md
├── wxt.config.ts
├── biome.json
├── tailwind.config.ts
├── package.json
├── tsconfig.json
├── docs/
│   ├── PRD.md              # プロダクト要件定義
│   ├── architecture.md     # アーキテクチャ設計
│   ├── content-script.md   # Content Script 設計
│   ├── ai-integration.md   # AI 統合設計
│   └── components.md       # コンポーネント設計
├── entrypoints/
│   ├── background.ts               # Service Worker
│   ├── sidepanel/                   # Side Panel (React)
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   └── content.ts                   # Content Script (Google Meet)
├── components/
│   ├── TranscriptPanel.tsx
│   ├── AiActionBar.tsx
│   ├── ChatPanel.tsx
│   ├── SettingsPanel.tsx
│   └── ui/                          # 共通 UI コンポーネント
├── hooks/
│   ├── useTranscript.ts
│   ├── useAiAction.ts
│   ├── useChat.ts
│   └── useSettings.ts
├── stores/
│   └── meetingStore.ts              # Zustand store
├── lib/
│   ├── messaging.ts                 # ProtocolMap 定義
│   ├── anthropic.ts                 # Anthropic API クライアント
│   └── prompts.ts                   # AI プロンプトテンプレート
├── utils/
│   └── caption-parser.ts            # 字幕 DOM パーサー
└── public/
    └── icon/
        ├── 16.png
        ├── 48.png
        └── 128.png
```

## Commands

```bash
bun install          # 依存関係インストール
bun run dev          # 開発モード (HMR)
bun run build        # プロダクションビルド
bun run zip          # 配布用 ZIP 作成
bun run check        # Biome lint + format チェック
bun run check:fix    # Biome 自動修正
bun run test         # Vitest 実行
bun run test:watch   # Vitest ウォッチモード
```

## Design Principles

1. **WXT entrypoints 規約**: `entrypoints/` 配下のファイル名で manifest が自動生成される。手動で manifest.json を編集しない
2. **型安全メッセージング**: `@webext-core/messaging` の `ProtocolMap` で全メッセージ型を一元定義する（`lib/messaging.ts`）
3. **React 外からの状態更新**: Background → Side Panel のデータフローは Zustand `getState().setState()` を活用し、React ツリー外からでも安全に状態更新する
4. **Content Script の最小化**: Content Script は DOM 監視とデータ抽出のみ。ロジックは Background に委譲する
5. **BYOK**: API キーはユーザー自身が設定。`chrome.storage.local` に保存し、Background SW からのみ API 呼び出しを行う

## Documentation

- [PRD](docs/PRD.md) — プロダクト要件定義
- [Architecture](docs/architecture.md) — Extension アーキテクチャ設計
- [Content Script](docs/content-script.md) — 字幕取得・DOM 操作設計
- [AI Integration](docs/ai-integration.md) — Anthropic API 統合設計
- [Components](docs/components.md) — Side Panel コンポーネント設計
