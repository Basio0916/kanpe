
import { useState, useRef, useEffect } from "react"
import {
  ChevronDown,
  Pause,
  Play,
  Square,
  Send,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  MessageSquareText,
  Lightbulb,
  HelpCircle,
  ListChecks,
  Sparkles,
} from "lucide-react"
import type { Dict } from "@/lib/i18n"
import { getActiveSessionId, sendAiQuery } from "@/lib/tauri"
import type { OverlayVisualMode } from "@/stores/ui-settings-store"
import { useSessionStore } from "@/stores/session-store"

type RightPaneAction = "recap" | "assist" | "question" | "action"

interface LLMMessage {
  role: "user" | "assistant"
  content: string
}

interface OverlayExpandedProps {
  dict: Dict
  recording: "recording" | "paused"
  connection: "connected" | "reconnecting" | "disconnected"
  overlayVisualMode: OverlayVisualMode
  permissionMissing?: boolean
  onCollapse: () => void
  onToggleRecording: () => void
  onStopSession: () => void
  onStartDrag: () => void
}

function getActionConfig(d: Dict) {
  return {
    recap: {
      label: "Recap",
      icon: RefreshCw,
      prompt: "Please summarize the conversation so far concisely.",
    },
    assist: {
      label: "Assist",
      icon: Lightbulb,
      prompt: "Based on the conversation flow, suggest what I should say next.",
    },
    question: {
      label: "Question",
      icon: HelpCircle,
      prompt: "Suggest questions I should ask the other person based on the conversation.",
    },
    action: {
      label: "Action",
      icon: ListChecks,
      prompt: "Organize the action items from this conversation.",
    },
  } as const
}

export function OverlayExpanded({
  dict: d,
  recording,
  connection,
  overlayVisualMode,
  permissionMissing = false,
  onCollapse,
  onToggleRecording,
  onStopSession,
  onStartDrag,
}: OverlayExpandedProps) {
  const ACTION_CONFIG = getActionConfig(d)
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<LLMMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeAction, setActiveAction] = useState<RightPaneAction | null>(null)
  const captions = useSessionStore((s) => s.captions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const captionEndRef = useRef<HTMLDivElement>(null)
  const lastUserMsgRef = useRef<HTMLDivElement>(null)
  const chatScrollContainerRef = useRef<HTMLDivElement>(null)
  const surfaceClassName =
    overlayVisualMode === "blur"
      ? "bg-[rgba(24,24,28,0.56)] backdrop-blur-2xl"
      : "bg-[rgba(24,24,28,0.78)] backdrop-blur-none"

  const sourceBadgeClass = (source: string) => {
    if (source === "MIC") return "bg-primary/15 text-primary"
    if (source === "SYS") return "bg-success/15 text-success"
    if (source === "SPK1") return "bg-primary/15 text-primary"
    if (source === "SPK2") return "bg-success/15 text-success"
    if (source === "SPK3") return "bg-warning/15 text-warning"
    if (source === "SPK4") return "bg-accent/20 text-accent-foreground"
    return "bg-secondary text-foreground"
  }

  useEffect(() => {
    captionEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [captions.length])

  // Scroll so the latest user message is pinned at the top of the chat viewport
  useEffect(() => {
    const container = chatScrollContainerRef.current
    const userEl = lastUserMsgRef.current
    if (container && userEl) {
      const offset = userEl.offsetTop - container.offsetTop
      container.scrollTo({ top: offset, behavior: "smooth" })
    }
  }, [messages])

  const resolveSessionId = async (): Promise<string | null> => {
    if (activeSessionId) return activeSessionId
    try {
      const hydrated = await getActiveSessionId()
      if (hydrated) {
        useSessionStore.setState({ activeSessionId: hydrated })
        return hydrated
      }
    } catch {
      // ignore and fallback to null handling
    }
    return null
  }

  const handleActionClick = async (action: RightPaneAction) => {
    if (isGenerating) return
    setActiveAction(action)
    const userMsg: LLMMessage = {
      role: "user",
      content: ACTION_CONFIG[action].label,
    }
    setMessages((prev) => [...prev, userMsg])
    const sessionId = await resolveSessionId()
    if (!sessionId) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "セッションが開始されていません。Start Kanpe を押してから再試行してください。",
        },
      ])
      return
    }
    setIsGenerating(true)

    try {
      const response = await sendAiQuery(sessionId, ACTION_CONFIG[action].prompt, action)
      const assistantMsg: LLMMessage = {
        role: "assistant",
        content: response,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `LLM呼び出しに失敗しました: ${message}`,
        },
      ])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSendFreeform = async () => {
    if (!inputValue.trim()) return
    if (isGenerating) return
    const query = inputValue
    const userMsg: LLMMessage = {
      role: "user",
      content: query,
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue("")
    setActiveAction(null)
    const sessionId = await resolveSessionId()
    if (!sessionId) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "セッションが開始されていません。Start Kanpe を押してから再試行してください。",
        },
      ])
      return
    }
    setIsGenerating(true)

    try {
      const response = await sendAiQuery(sessionId, query)
      const assistantMsg: LLMMessage = {
        role: "assistant",
        content: response,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `LLM呼び出しに失敗しました: ${message}`,
        },
      ])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSendFreeform()
    }
  }

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-2xl ${surfaceClassName}`}
      style={{ minHeight: 340 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] cursor-move select-none"
        onMouseDown={onStartDrag}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
              <span className="text-[10px] font-bold text-primary-foreground">K</span>
            </div>
            <span className="text-sm font-semibold text-foreground">Kanpe</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            {recording === "recording" ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
                <span className="text-xs text-destructive font-medium">{d.rec}</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="text-xs text-muted-foreground">{d.paused}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 cursor-default" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 mr-2">
            {connection === "connected" && <Wifi className="h-3 w-3 text-success" />}
            {connection === "reconnecting" && <Loader2 className="h-3 w-3 text-warning animate-spin" />}
            {connection === "disconnected" && <WifiOff className="h-3 w-3 text-destructive" />}
          </div>
          <button
            onClick={onToggleRecording}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--glass-hover)] hover:text-foreground"
            aria-label={recording === "recording" ? d.pause : d.resume}
          >
            {recording === "recording" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={onCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--glass-hover)] hover:text-foreground"
            aria-label={d.collapse}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={onStopSession}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-destructive/15 px-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/25"
            aria-label={d.stopRecording}
          >
            <Square className="h-3 w-3 fill-current" />
            {d.stopRecording}
          </button>
        </div>
      </div>

      {/* Reconnecting banner */}
      {connection === "reconnecting" && (
        <div className="flex items-center gap-2 bg-warning/10 border-b border-warning/20 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
          <span className="text-xs text-warning">{d.retrying}</span>
          <button className="ml-auto text-xs text-warning underline hover:no-underline">{d.reconnect}</button>
        </div>
      )}

      {/* Permission missing banner */}
      {permissionMissing && (
        <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/20 px-4 py-2">
          <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
          <span className="text-xs text-destructive">{d.permissionMissing}</span>
          <button className="ml-auto text-xs text-destructive underline hover:no-underline">{d.openSettings}</button>
        </div>
      )}

      {/* Two-pane body */}
      <div className="flex flex-1 min-h-0" style={{ height: 140 }}>
        {/* Left pane: Live Caption */}
        <div className="flex w-[340px] shrink-0 flex-col border-r border-[var(--glass-border)]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--glass-border)]">
            <MessageSquareText className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">{d.liveCaption}</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              {captions.length} {d.entries}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-0.5 p-2">
              {captions.length === 0 && (
                <div className="rounded-lg px-2 py-2 text-xs text-muted-foreground">
                  Waiting for live captions...
                </div>
              )}
              {captions.map((entry, i) => (
                <div
                  key={`${entry.time}-${i}`}
                  className={`flex items-start gap-1.5 rounded-lg px-2 py-1.5 ${
                    entry.status === "interim" ? "bg-primary/5" : "bg-transparent"
                  }`}
                >
                  <span className="shrink-0 text-[10px] font-mono text-muted-foreground pt-0.5 leading-5">
                    {entry.time}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold leading-none mt-1 ${
                      sourceBadgeClass(entry.source)
                    }`}
                  >
                    {entry.source}
                  </span>
                  <span
                    className={`text-[13px] leading-5 ${
                      entry.status === "interim" ? "text-muted-foreground italic" : "text-foreground"
                    }`}
                  >
                    {entry.text}
                  </span>
                </div>
              ))}
              <div ref={captionEndRef} />
            </div>
          </div>
        </div>

        {/* Right pane: Assist */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--glass-border)]">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">{d.assist}</span>
          </div>

          {/* Chat area - fixed scroll container */}
          <div ref={chatScrollContainerRef} className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  {d.askAnything}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 p-3">
                {messages.map((msg, i) => {
                  const lastUserIdx = messages.reduce((acc, m, idx) => m.role === "user" ? idx : acc, -1)
                  const isLastUser = msg.role === "user" && i === lastUserIdx
                  return (
                    <div
                      key={i}
                      ref={isLastUser ? lastUserMsgRef : undefined}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-secondary text-foreground rounded-bl-md"
                        }`}
                      >
                        {msg.content.split("\n").map((line, li) => (
                          <p key={li} className={li > 0 ? "mt-1" : ""}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {isGenerating && (
                  <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
                    <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                    <span className="text-xs text-muted-foreground">{d.generating}</span>
                  </div>
                )}
                {/* Spacer so the last user message can scroll to the top */}
                <div style={{ minHeight: "60%" }} />
              </div>
            )}
          </div>

          {/* Bottom: action buttons + input */}
          <div className="border-t border-[var(--glass-border)]">
            <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-2">
              {(Object.keys(ACTION_CONFIG) as RightPaneAction[]).map((key) => {
                const config = ACTION_CONFIG[key]
                const Icon = config.icon
                return (
                  <button
                    key={key}
                    onClick={() => void handleActionClick(key)}
                    disabled={isGenerating}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                      activeAction === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 px-3 pb-2.5">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={d.askPlaceholder}
                disabled={isGenerating}
                className="flex-1 rounded-lg bg-secondary/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-transparent focus:ring-primary/30 transition-shadow disabled:opacity-50"
              />
              <button
                onClick={() => void handleSendFreeform()}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
                disabled={!inputValue.trim() || isGenerating}
                aria-label={d.send}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
