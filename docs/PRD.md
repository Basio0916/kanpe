# PRD: Kanpe AI (v0 UI準拠, Tauri)

## 1. ドキュメント情報
- 文書名: Kanpe AI PRD
- プロダクト名: Kanpe AI
- バージョン: v1.2
- 更新日: 2026-02-22
- 対象フェーズ: MVP
- ステータス: v0 UI準拠版
- UIソース:
  - `v0/app/page.tsx`
  - `v0/components/kanpe/overlay-minibar.tsx`
  - `v0/components/kanpe/overlay-expanded.tsx`
  - `v0/components/kanpe/screen-onboarding.tsx`
  - `v0/components/kanpe/screen-session-list.tsx`
  - `v0/components/kanpe/screen-session-detail.tsx`
  - `v0/components/kanpe/screen-settings.tsx`

## 2. 背景と目的
日本語会話に強いリアルタイム会話支援アプリ `Kanpe AI` を、TauriデスクトップアプリとしてMVP実装する。  
本版PRDでは、要件の基準をワイヤーフレームではなく `v0/` にある実UIに統一する。

## 3. プロダクトゴール
- 会話中に「邪魔しない」オーバーレイでリアルタイム字幕とAI支援を提供する
- セッション単位で会話履歴とAI出力を振り返れるようにする
- 権限不足・接続不安定時の状態をUIで明確にし、復帰導線を提供する
- STTプロバイダー設定をUIから確認・変更できるようにする

## 4. スコープ
### 4.1 MVPで実装する範囲
- 6画面構成
  - Overlay Minibar
  - Overlay Expanded
  - Onboarding
  - Session List
  - Session Detail
  - Settings
- 録音状態管理: `recording` / `paused`
- 接続状態管理: `connected` / `reconnecting` / `disconnected`
- 文字起こし表示（`MIC` / `SYS`, `interim` / `final`）
- AI支援ショートアクション4種 + 自由入力質問
- 権限セットアップ導線（マイク、画面収録/システム音声、オーバーレイ）
- セッション履歴閲覧、詳細閲覧、エクスポート/削除操作

### 4.2 MVP外
- 組織向け管理（RBAC、監査ログ、SSO）
- 高度なローカルSTT最適化
- 高度な話者分離UI
- 完全自動の議事録生成ワークフロー

## 5. 画面体系（v0準拠）
### 5.1 Overlay系
- `overlay-mini`: 状態監視と最小操作（展開/一時停止/閉じる）
- `overlay-expanded`: 2ペイン（左: Live Caption, 右: Assistチャット）
- Overlay共通ウィンドウ要件:
  - 半透明（ガラス調）で表示する
  - 常に最前面（Always on Top）で表示する
  - ドラッグで移動可能にする

### 5.2 Main系
- `onboarding`: 権限ウィザード
- `sessions`: セッション一覧
- `detail`: セッション詳細（Summary / Caption / AI Log / Usage）
- `settings`: 設定（7セクション）

注記:
- `v0/app/page.tsx` の上部ナビはデモ切り替え用。製品版では通常導線に置き換える。

## 6. 主要ユーザーフロー
1. 初回起動:
   - `onboarding` で権限確認を進める
   - 必要権限が揃ったらホームへ遷移
2. 会話開始:
   - `sessions` の開始ボタンから録音開始
   - `overlay-mini` で状態監視、必要に応じて `overlay-expanded` へ展開
3. 会話中支援:
   - 左ペインで字幕確認
   - 右ペインで Recap / Assist / Question / Action または自由質問
4. 会話後:
   - `detail` で要約・字幕・AIログ・使用量を確認
   - コピー、エクスポート、削除を実行

## 7. 機能要件（Functional Requirements）
### FR-01 グローバル状態
- 録音状態: `recording` / `paused`
- 接続状態: `connected` / `reconnecting` / `disconnected`
- 表示言語: `en` / `ja`

受け入れ条件:
- いずれの対象画面でも状態に応じたバッジ/色/文言が表示される
- 状態変更がオーバーレイUIに即時反映される

### FR-02 Overlay Minibar
- 表示要素:
  - アプリ識別子
  - 録音状態インジケータ
  - 接続状態インジケータ
  - 操作ボタン（展開/録音トグル/閉じる）
- ウィンドウ特性:
  - 半透明表示
  - 最前面固定
  - ドラッグ移動可能

受け入れ条件:
- 展開ボタンで `overlay-expanded` へ遷移できる
- 録音トグルで `recording` と `paused` が切り替わる
- アクティブアプリを切り替えても `overlay-mini` が最前面に残る
- `overlay-mini` をドラッグして任意位置へ移動できる

### FR-03 Overlay Expanded
- ヘッダー:
  - 録音状態、接続状態、操作ボタン（折りたたみ/録音トグル/閉じる）
- ウィンドウ特性:
  - 半透明表示
  - 最前面固定
  - ドラッグ移動可能
- 警告バナー:
  - `reconnecting` 時: 再接続バナー + 再試行操作
  - 権限不足時: 権限不足バナー + 設定遷移操作
- 左ペイン（Live Caption）:
  - エントリ項目: `time`, `source(MIC|SYS)`, `status(interim|final)`, `text`
  - `interim` は視覚的に区別
- 右ペイン（Assist）:
  - クイックアクション: `Recap`, `Assist`, `Question`, `Action`
  - 自由入力質問 + 送信
  - 生成中インジケータ

受け入れ条件:
- クイックアクション押下でユーザー発話とAI応答が時系列で表示される
- Enter送信（Shift+Enterで改行保持）の入力挙動が動作する
- 新規メッセージ表示時にチャットスクロール位置が自動調整される
- アクティブアプリを切り替えても `overlay-expanded` が最前面に残る
- `overlay-expanded` をドラッグして任意位置へ移動できる

### FR-04 Onboarding（権限ウィザード）
- 対象権限:
  - マイク
  - 画面収録/システム音声
  - オーバーレイ表示
- 各ステップで以下を提供:
  - 現在状態（`granted` / `denied` / `unknown`）
  - 権限リクエスト
  - システム設定を開く
  - 再チェック

受け入れ条件:
- 現在ステップが `granted` でないと `次へ` が押下不可
- 全権限が `granted` のとき最終CTAが `始める` になる

### FR-05 Session List
- ヘッダー:
  - 検索入力
  - 設定導線
  - 録音開始CTA
- セッション表示:
  - グルーピング（Today / Yesterday）
  - 行項目（タイトル、時間、長さ）
  - ホバー時の追加操作
- 下部カード:
  - 進行中セッション情報
  - 停止ボタン

受け入れ条件:
- セッション行押下で `detail` へ遷移できる
- 設定アイコン押下で `settings` へ遷移できる

### FR-06 Session Detail
- タブ:
  - `summary`, `caption`, `ai-log`, `usage`
- `caption`:
  - `MIC` / `SYS` タグ付き字幕表示
  - `interim` バッジ表示
- `ai-log`:
  - サブタブ `recap`, `next-speak`, `followup`, `questions`
- フッター操作:
  - 全文コピー
  - エクスポート
  - セッション削除

受け入れ条件:
- タブ切り替えで表示内容が正しく切り替わる
- `ai-log` で該当データがない場合は空状態文言を表示

### FR-07 Settings
- セクション:
  - `general`, `language`, `permissions`, `audio`, `stt`, `hotkeys`, `data`
- 主な設定項目:
  - General: 起動時自動開始、ログイン時起動、通知
  - Language: UI言語、STT言語、LLM出力言語
  - Permissions: 権限状態の表示
  - Audio: マイク入力、システム音声取得方式、ノイズ抑制
  - STT: Provider表示、`model=small`, `language=ja`, `interim_results`, `endpointing=300`
  - Hotkeys: グローバルショートカット一覧
  - Data: ストレージ使用量、自動削除、全体エクスポート/削除

受け入れ条件:
- セクション切り替えで右ペイン内容が同期する
- トグル/セレクトなどのUIコンポーネントが状態を保持できる

### FR-08 データ要件（最小）
- `Session`
  - `id: string`
  - `title: string`
  - `started_at: number`
  - `ended_at?: number`
  - `duration_sec: number`
  - `is_active: boolean`
- `TranscriptEntry`
  - `session_id: string`
  - `time: string`
  - `source: "MIC" | "SYS"`
  - `status: "interim" | "final"`
  - `text: string`
- `AIEntry`
  - `session_id: string`
  - `time: string`
  - `type: "recap" | "assist" | "question" | "action" | "freeform"`
  - `prompt: string`
  - `response: string`

受け入れ条件:
- `final` 字幕とAI応答はセッション詳細で再表示できる形で保存される
- セッション削除時に関連字幕/AIログが一貫して削除される

## 8. 非機能要件（Non-Functional Requirements）
### NFR-01 パフォーマンス
- 字幕更新の体感遅延: 通常時 1.5秒以内
- 画面操作（タブ切り替え、ボタンクリック）のUI応答: 100ms以内を目標

### NFR-02 信頼性
- STT接続断時に指数バックオフで再接続
- 接続状態を常時可視化し、ユーザー手動再試行を提供

### NFR-03 セキュリティ
- STT関連の機密設定はRust側管理（フロント直置き禁止）
- ログに機密情報を出さない

### NFR-04 プライバシー
- セッション保持方針を設定で明示
- ユーザー操作でセッション単位/全件削除を可能にする

### NFR-05 アクセシビリティ
- 主要ボタンに `aria-label` を付与
- キーボード操作（Enter送信など）に対応

## 9. 技術要件・アーキテクチャ
### 9.1 構成
- フロントエンド: Tauri WebView + React
- バックエンド: Rust（音声処理、鍵管理、状態管理）
- 外部:
  - STTプロバイダー（初期実装: faster-whisper）
  - LLM API（AI支援）

### 9.2 データフロー
1. マイク/システム音声を取得
2. ソース識別付きで音声ストリーム化
3. Rust側でSTTプロバイダーへストリーム送信
4. `interim` / `final` をUIへ配信
5. `final` とAI応答をセッション単位で保存
6. Session Detail/Overlayで再利用

### 9.3 固定方針
1. STTはプロバイダー抽象で実装（初期プロバイダー: faster-whisper）
   - 初期値: `model=small`, `language=ja`, `interim_results=true`, `endpointing=300`
2. APIキーはRust側で保持
3. `MIC` / `SYS` は別ソースとして保持

## 10. QA/テスト要件
### 10.1 自動テスト
- 単体:
  - 状態遷移（録音/接続/権限）
  - 字幕エントリ正規化
  - AIアクション種別の振り分け
- 結合:
  - STT接続と字幕反映
  - セッション保存と詳細再表示

### 10.2 手動テスト
- 権限拒否から復帰までの導線
- `connected` / `reconnecting` / `disconnected` の表示確認
- `interim` / `final` の視覚差分確認
- セッションのコピー/エクスポート/削除

## 11. リリース計画（MVP）
### マイルストーン1: UI統合
- v0の6画面をTauri実装へ統合
- 画面遷移と状態管理を接続

### マイルストーン2: データ接続
- STT/AIとOverlay・Detailを接続
- セッション保存/読込を実装

### マイルストーン3: 品質仕上げ
- 権限/再接続の異常系テスト
- パフォーマンス調整と出荷判定

## 12. 未確定事項（要判断）
- Language設定で多言語選択を見せる範囲と、MVP実際対応言語の整合
- Overlayの「閉じる」操作定義（非表示のみか、録音停止を伴うか）
- Session Listの検索仕様（全文検索対象、AIログ含有有無）

## 13. MVP完了定義（Definition of Done）
- FR-01〜FR-08が受け入れ条件を満たす
- 権限拒否/ネットワーク断の主要エラーから復帰可能
- APIキーがフロントエンドに露出しない
- 主要ユースケース（会議開始〜AI支援利用〜履歴確認）を通しで実行可能
