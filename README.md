# Kanpe

リアルタイム会話アシスタント デスクトップアプリケーション。

会話の音声をキャプチャし、リアルタイムで文字起こし・AI による分析を行うクロスプラットフォーム対応のデスクトップアプリです。

## 主な機能

- **リアルタイム文字起こし** — マイク入力とシステム音声を同時にキャプチャし、Deepgram によるリアルタイム音声認識
- **AI アシスタント** — OpenAI / Anthropic と連携し、会話内容に基づく質問応答・要約を生成
- **オーバーレイ表示** — 常に最前面に表示されるフローティングウィンドウで、録音中のキャプションと AI 操作にアクセス
- **セッション管理** — 会話をセッション単位で記録・保存・エクスポート
- **多言語対応** — 日本語 / 英語の UI 切り替え
- **クロスプラットフォーム** — macOS / Windows / Linux 対応

## スクリーンショット

<!-- TODO: スクリーンショットを追加 -->

## 技術スタック

### フロントエンド

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | React 19 |
| ルーティング | React Router v7 |
| 状態管理 | Zustand |
| UIコンポーネント | shadcn/ui + Radix UI |
| スタイリング | Tailwind CSS v4 |
| ビルドツール | Vite 6 |
| 言語 | TypeScript |

### バックエンド

| カテゴリ | 技術 |
|---------|------|
| デスクトップフレームワーク | Tauri v2 |
| 言語 | Rust |
| 音声キャプチャ | CPAL |
| 音声認識 | Deepgram (WebSocket) |
| LLM | OpenAI / Anthropic |
| データベース | SQLite |
| 非同期ランタイム | Tokio |

## 必要条件

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri v2 の前提条件](https://v2.tauri.app/start/prerequisites/)

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/Basio0916/kanpe.git
cd kanpe
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集し、API キーを設定してください:

```env
DEEPGRAM_API_KEY=your-deepgram-api-key
LLM_PROVIDER=openai          # openai または anthropic
OPENAI_API_KEY=sk-xxx        # OpenAI を使用する場合
ANTHROPIC_API_KEY=sk-ant-xxx # Anthropic を使用する場合
```

### 4. 開発サーバーの起動

```bash
# フロントエンド + Rust バックエンド（ホットリロード対応）
pnpm tauri dev
```

## コマンド一覧

```bash
pnpm install        # 依存関係のインストール
pnpm dev            # フロントエンド開発サーバー (port 1420)
pnpm tauri dev      # Tauri 開発モード（フロントエンド + バックエンド）
pnpm build          # 型チェック + フロントエンドビルド
pnpm tauri build    # 配布可能なデスクトップアプリをビルド
```

## アーキテクチャ

### 2ウィンドウシステム

アプリは2つの独立したウィンドウで構成されています:

- **メインウィンドウ** — セッション一覧、セッション詳細、設定、オンボーディング
- **オーバーレイウィンドウ** — 録音中にフローティング表示されるキャプション + AI コントロール

### ディレクトリ構成

```
kanpe/
├── src/                    # React フロントエンド
│   ├── components/
│   │   ├── kanpe/          # アプリ固有のコンポーネント
│   │   └── ui/             # shadcn/ui コンポーネント
│   ├── hooks/              # カスタムフック
│   ├── lib/                # ユーティリティ (tauri.ts, i18n.ts)
│   ├── routes/             # ページコンポーネント
│   ├── stores/             # Zustand ストア
│   ├── App.tsx             # メインウィンドウのルート
│   └── OverlayApp.tsx      # オーバーレイウィンドウのルート
├── src-tauri/              # Rust バックエンド
│   └── src/
│       ├── commands/       # Tauri コマンド（録音、セッション、AI 等）
│       ├── llm/            # LLM プロバイダー抽象化
│       ├── audio.rs        # 音声キャプチャ・ミキシング
│       └── state.rs        # 共有状態管理
├── index.html              # メインウィンドウ エントリーポイント
├── overlay.html            # オーバーレイウィンドウ エントリーポイント
└── package.json
```

## ライセンス

MIT
