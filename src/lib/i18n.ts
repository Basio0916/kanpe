export type Locale = "en" | "ja"

const en = {
  // Common
  appName: "Kanpe",
  start: "Start Kanpe",
  settings: "Settings",
  send: "Send",
  stop: "Stop",
  close: "Close",
  back: "Back",
  next: "Next",
  getStarted: "Get Started",
  share: "Share",

  // Recording
  rec: "REC",
  paused: "PAUSED",
  recording: "Recording",
  pauseLabel: "Paused",
  pause: "Pause",
  resume: "Resume",

  // Connection
  connected: "Connected",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
  reconnect: "Reconnect",
  retrying: "Retrying connection...",

  // Overlay
  collapse: "Collapse",
  expand: "Expand",
  liveCaption: "Live Caption",
  entries: "entries",
  assist: "Assist",
  askAnything: "Press a button below or type a question to ask AI",
  askPlaceholder: "Ask a question...",
  generating: "Generating...",
  permissionMissing: "Audio permission is missing",
  openSettings: "Open Settings",

  // Overlay minibar
  overlayMinibar: "Overlay Minibar",
  overlayMinibarDesc: "Compact status bar displayed on top",
  overlayExpanded: "Overlay Expanded",
  overlayExpandedDesc: "Live caption and AI assist view",

  // Session list
  searchPlaceholder: "Search or ask anything...",
  noUpcomingMeetings: "You have no upcoming meetings.",
  today: "Today",
  yesterday: "Yesterday",
  untitledSession: "Untitled session",
  stopRecording: "Stop recording",

  // Session detail
  sessionDetail: "Session Detail",
  sessionDetailDesc: "Caption, AI log, and usage review",
  summary: "Summary",
  caption: "Caption",
  aiLog: "AI Log",
  usage: "Usage",
  meetingSummary: "Meeting Summary",
  callDuration: "Call Duration",
  participants: "Participants",
  aiAssists: "AI Assists",
  persons: "people",
  times: "times",
  interim: "interim",
  recap: "Recap",
  nextSpeak: "Next to Say",
  followup: "Follow-up",
  questions: "Questions",
  noData: "No data available",
  copyAll: "Copy Full Text",
  export: "Export",
  deleteSession: "Delete Session",
  deleteSessionFailed: "Failed to delete the session.",

  // Settings
  settingsTitle: "Settings",
  general: "General",
  permissions: "Permissions",
  audio: "Audio",
  stt: "STT",
  hotkeys: "Hotkeys",
  data: "Data",
  language: "Language",

  // General settings
  generalSettings: "General Settings",
  generalDesc: "Change basic application settings.",
  autoStart: "Auto-start on launch",
  autoStartDesc: "Automatically start recording when the app launches.",
  startOnLogin: "Start on login",
  startOnLoginDesc: "Automatically launch Kanpe on macOS startup.",
  notifications: "Notifications",
  notificationsDesc: "Show AI assist notifications.",
  overlayVisualMode: "Overlay Visual",
  overlayVisualModeDesc: "Fix overlay rendering mode to avoid mixed transparency/blur behavior.",
  overlayVisualTranslucent: "Translucent (No Blur)",
  overlayVisualBlur: "Blur",

  // Language settings
  languageSettings: "Language Settings",
  languageDesc: "Configure display, recognition, and output languages.",
  systemLanguage: "System Language",
  systemLanguageDesc: "Interface display language.",
  sttLanguage: "Speech Recognition Language",
  sttLanguageDesc: "Language used for real-time speech-to-text.",
  llmLanguage: "LLM Output Language",
  llmLanguageDesc: "Language for AI assistant responses.",

  // Permissions
  permissionManagement: "Permission Management",
  permissionDesc: "Check and manage macOS permissions.",
  micPermission: "Microphone Permission",
  screenAudioPermission: "Screen Recording / System Audio",
  overlayPermission: "Overlay Display",
  granted: "Granted",
  denied: "Denied",

  // Audio settings
  audioSettings: "Audio Settings",
  audioDesc: "Configure audio input/output devices.",
  micInput: "Microphone Input",
  micInputDesc: "Select the microphone device to use",
  systemAudio: "System Audio",
  systemAudioDesc: "Method for capturing the other party's audio",
  noiseSuppression: "Noise Suppression",
  noiseSuppressionDesc: "Reduce background noise.",
  macbookMic: "MacBook Pro Microphone",
  externalMic: "External Microphone",
  screenCapture: "Via Screen Recording",
  virtualAudio: "Virtual Audio",

  // STT settings
  sttSettings: "STT Settings",
  sttDesc: "Change Deepgram speech recognition settings.",
  deepgram: "Deepgram",
  deepgramDesc: "Real-time speech recognition provider",
  connectedStatus: "Connected",
  model: "Model",
  modelDesc: "Deepgram model to use",
  languageLabel: "Language",
  languageLabelDesc: "Recognition target language",
  interimResults: "interim_results",
  interimResultsDesc: "Show interim results.",
  endpointing: "endpointing",
  endpointingDesc: "Utterance boundary threshold (ms)",

  // Hotkeys
  hotkeysSettings: "Hotkeys",
  hotkeysDesc: "Configure global shortcuts.",
  toggleOverlay: "Toggle Overlay",
  startStopRecording: "Start / Stop Recording",
  pauseResumeRecording: "Pause / Resume",
  aiAssist: "AI Assist",

  // Data settings
  dataManagement: "Data Management",
  dataDesc: "Manage session data storage and export.",
  storageUsage: "Storage Usage",
  autoDelete: "Auto Delete",
  autoDeleteDesc: "Automatically delete old sessions.",
  after30days: "After 30 days",
  after90days: "After 90 days",
  neverDelete: "Never",
  exportAll: "Export All Data",
  deleteAll: "Delete All Data",

  // Onboarding
  setup: "Setup",
  onboarding: "Onboarding",
  onboardingDesc: "Step-by-step macOS permission wizard",
  setupDesc: "Please grant the following permissions to use Kanpe.",
  micPermissionLabel: "Microphone Permission",
  micPermissionDesc: "Required to capture your voice in real time.",
  screenAudioLabel: "Screen Recording / System Audio",
  screenAudioDesc: "Required to capture the other party's audio.",
  overlayLabel: "Overlay Display",
  overlayDesc: "Permission to display an overlay on top of other apps.",
  requestPermission: "Request Permission",
  openSystemSettings: "Open System Settings",
  recheck: "Re-check",

  // Nav
  navRecording: "Recording:",
  navRecordingActive: "Recording",
  navPaused: "Paused",
  navConnection: "Connection:",
  navConnected: "Connected",
  navReconnecting: "Reconnecting",
  navDisconnected: "Disconnected",
  sessionList: "Session List",
  sessionListDesc: "Home screen for recorded sessions",
  settingsDesc: "Sidebar + content pane settings screen",

  // Session detail mock
  summaryMock: "During the sprint review, the dashboard redesign and API optimization were discussed. For the dashboard, KPI visibility improvements, chart layout changes, and real-time update features were completed. For the API, response time optimization and caching strategy implementation are in progress.",
  monday: "Monday",
  date: "Feb 23",
  sessionTitle: "Weekly Sprint Review",

  // Usage
  sttProcessingTime: "STT Processing Time",
  aiInferenceCount: "AI Inference Count",
  audioDataSize: "Audio Data Size",
  tokenUsage: "Token Usage",
} as const

type DictKeys = keyof typeof en

const ja: Record<DictKeys, string> = {
  // Common
  appName: "Kanpe",
  start: "Kanpe を開始",
  settings: "設定",
  send: "送信",
  stop: "停止",
  close: "閉じる",
  back: "戻る",
  next: "次へ",
  getStarted: "始める",
  share: "共有",

  // Recording
  rec: "REC",
  paused: "PAUSED",
  recording: "録音中",
  pauseLabel: "一時停止",
  pause: "一時停止",
  resume: "再開",

  // Connection
  connected: "接続中",
  reconnecting: "再接続中",
  disconnected: "切断",
  reconnect: "再接続",
  retrying: "接続を再試行しています...",

  // Overlay
  collapse: "折りたたむ",
  expand: "展開",
  liveCaption: "Live Caption",
  entries: "件",
  assist: "Assist",
  askAnything: "下のボタンを押すか、入力欄からAIに質問できます",
  askPlaceholder: "自由に質問を入力...",
  generating: "生成中...",
  permissionMissing: "音声権限が不足しています",
  openSettings: "設定を開く",

  // Overlay minibar
  overlayMinibar: "Overlay ミニバー",
  overlayMinibarDesc: "最前面に表示されるコンパクトなステータスバー",
  overlayExpanded: "Overlay 展開",
  overlayExpandedDesc: "ライブキャプションとAIアシストを表示",

  // Session list
  searchPlaceholder: "検索...",
  noUpcomingMeetings: "予定されているミーティングはありません。",
  today: "今日",
  yesterday: "昨日",
  untitledSession: "無題のセッション",
  stopRecording: "録音を停止",

  // Session detail
  sessionDetail: "セッション詳細",
  sessionDetailDesc: "キャプション、AIログ、使用量の確認",
  summary: "サマリー",
  caption: "キャプション",
  aiLog: "AIログ",
  usage: "使用量",
  meetingSummary: "会議サマリー",
  callDuration: "通話時間",
  participants: "参加者",
  aiAssists: "AIアシスト",
  persons: "人",
  times: "回",
  interim: "interim",
  recap: "Recap",
  nextSpeak: "次に話す",
  followup: "Follow-up",
  questions: "質問",
  noData: "データがありません",
  copyAll: "全文コピー",
  export: "エクスポート",
  deleteSession: "セッション削除",
  deleteSessionFailed: "セッションの削除に失敗しました。",

  // Settings
  settingsTitle: "設定",
  general: "一般",
  permissions: "権限",
  audio: "音声",
  stt: "STT",
  hotkeys: "ホットキー",
  data: "データ",
  language: "言語",

  // General settings
  generalSettings: "一般設定",
  generalDesc: "アプリケーションの基本設定を変更します。",
  autoStart: "起動時に自動開始",
  autoStartDesc: "アプリ起動時に自動で録音を開始します。",
  startOnLogin: "ログイン時に起動",
  startOnLoginDesc: "macOS起動時にKanpeを自動起動します。",
  notifications: "通知",
  notificationsDesc: "AIアシストの通知を表示します。",
  overlayVisualMode: "オーバーレイ表示モード",
  overlayVisualModeDesc: "半透明とブラーの挙動を固定します。",
  overlayVisualTranslucent: "半透明（ブラーなし）",
  overlayVisualBlur: "ブラー",

  // Language settings
  languageSettings: "言語設定",
  languageDesc: "表示言語、音声認識言語、出力言語を設定します。",
  systemLanguage: "システム言語",
  systemLanguageDesc: "インターフェースの表示言語。",
  sttLanguage: "音声認識の言語",
  sttLanguageDesc: "リアルタイム音声認識に使用する言語。",
  llmLanguage: "LLM出力言語",
  llmLanguageDesc: "AIアシスタントの応答言語。",

  // Permissions
  permissionManagement: "権限管理",
  permissionDesc: "macOSの権限設定を確認・管理します。",
  micPermission: "マイク権限",
  screenAudioPermission: "画面収録 / システム音声",
  overlayPermission: "オーバーレイ表示",
  granted: "許可済み",
  denied: "拒否",

  // Audio settings
  audioSettings: "音声設定",
  audioDesc: "音声入出力デバイスを設定します。",
  micInput: "マイク入力",
  micInputDesc: "使用するマイクデバイス",
  systemAudio: "システム音声",
  systemAudioDesc: "相手の音声のキャプチャ方式",
  noiseSuppression: "ノイズ抑制",
  noiseSuppressionDesc: "背景ノイズを軽減します。",
  macbookMic: "MacBook Pro マイク",
  externalMic: "外部マイク",
  screenCapture: "画面収録経由",
  virtualAudio: "仮想オーディオ",

  // STT settings
  sttSettings: "STT 設定",
  sttDesc: "Deepgram の音声認識設定を変更します。",
  deepgram: "Deepgram",
  deepgramDesc: "リアルタイム音声認識プロバイダー",
  connectedStatus: "接続済み",
  model: "Model",
  modelDesc: "使用するDeepgramモデル",
  languageLabel: "Language",
  languageLabelDesc: "認識対象言語",
  interimResults: "interim_results",
  interimResultsDesc: "中間結果を表示します。",
  endpointing: "endpointing",
  endpointingDesc: "発話区切りの閾値（ミリ秒）",

  // Hotkeys
  hotkeysSettings: "ホットキー",
  hotkeysDesc: "グローバルショートカットを設定します。",
  toggleOverlay: "オーバーレイ表示/非表示",
  startStopRecording: "録音開始/停止",
  pauseResumeRecording: "一時停止/再開",
  aiAssist: "AIアシスト",

  // Data settings
  dataManagement: "データ管理",
  dataDesc: "セッションデータの保存とエクスポートを管理します。",
  storageUsage: "ストレージ使用量",
  autoDelete: "自動削除",
  autoDeleteDesc: "古いセッションを自動で削除します。",
  after30days: "30日後",
  after90days: "90日後",
  neverDelete: "削除しない",
  exportAll: "全データエクスポート",
  deleteAll: "全データ削除",

  // Onboarding
  setup: "セットアップ",
  onboarding: "オンボーディング",
  onboardingDesc: "macOS権限設定のステップ形式ウィザード",
  setupDesc: "Kanpe を使用するために以下の権限を許可してください。",
  micPermissionLabel: "マイク権限",
  micPermissionDesc: "会話音声をリアルタイムで取得するために必要です。",
  screenAudioLabel: "画面収録 / システム音声",
  screenAudioDesc: "相手の音声を取得するために画面収録権限が必要です。",
  overlayLabel: "オーバーレイ表示",
  overlayDesc: "他のアプリの上にオーバーレイを表示するための権限です。",
  requestPermission: "権限をリクエスト",
  openSystemSettings: "システム設定を開く",
  recheck: "再チェック",

  // Nav
  navRecording: "録音:",
  navRecordingActive: "録音中",
  navPaused: "一時停止",
  navConnection: "接続:",
  navConnected: "接続",
  navReconnecting: "再接続",
  navDisconnected: "切断",
  sessionList: "セッション一覧",
  sessionListDesc: "録音セッションの一覧ホーム画面",
  settingsDesc: "サイドバー + 右ペイン構成の設定画面",

  // Session detail mock
  summaryMock: "スプリントレビューでは、ダッシュボードのリデザインとAPI最適化について議論。ダッシュボードではKPI視認性の改善、チャートレイアウトの変更、リアルタイム更新機能の追加が完了。APIについてはレスポンスタイムの最適化とキャッシュ戦略の導入が進行中。",
  monday: "月曜日",
  date: "2月23日",
  sessionTitle: "週次スプリントレビュー",

  // Usage
  sttProcessingTime: "STT処理時間",
  aiInferenceCount: "AI推論回数",
  audioDataSize: "音声データ量",
  tokenUsage: "トークン使用量",
}

const dictionaries: Record<Locale, Record<DictKeys, string>> = { en, ja }

export function t(locale: Locale): Record<DictKeys, string> {
  return dictionaries[locale]
}

export type Dict = Record<DictKeys, string>
