import { useMemo, useState } from "react"
import { ArrowLeft, Share2, Copy, Download, Trash2 } from "lucide-react"
import type { Dict } from "@/lib/i18n"
import type { SessionDetail } from "@/lib/tauri"

type DetailTab = "summary" | "caption" | "ai-log" | "usage"
type AILogTab = "recap" | "next-speak" | "followup" | "questions" | "freeform"

interface ScreenSessionDetailProps {
  dict: Dict
  session: SessionDetail | null
  loading: boolean
  onBack: () => void
}

function formatCreatedAt(createdAt: string): string {
  const dt = new Date(createdAt)
  if (Number.isNaN(dt.getTime())) return createdAt
  return dt.toLocaleString()
}

export function ScreenSessionDetail({
  dict: d,
  session,
  loading,
  onBack,
}: ScreenSessionDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("summary")
  const [activeAILogTab, setActiveAILogTab] = useState<AILogTab>("recap")

  const TAB_LABELS: Record<DetailTab, string> = {
    summary: d.summary,
    caption: d.caption,
    "ai-log": d.aiLog,
    usage: d.usage,
  }

  const AI_LOG_TAB_LABELS: Record<AILogTab, string> = {
    recap: d.recap,
    "next-speak": d.nextSpeak,
    followup: d.followup,
    questions: d.questions,
    freeform: d.assist,
  }

  const aiLogTypes = useMemo<AILogTab[]>(() => {
    const defaults: AILogTab[] = ["recap", "next-speak", "followup", "questions"]
    if (!session) return defaults
    const found = new Set<AILogTab>()
    for (const log of session.ai_logs) {
      const type = (log.type as AILogTab) || "freeform"
      if (
        type === "recap" ||
        type === "next-speak" ||
        type === "followup" ||
        type === "questions" ||
        type === "freeform"
      ) {
        found.add(type)
      }
    }
    if (found.size === 0) return defaults
    if (found.has("freeform")) {
      found.add("freeform")
    }
    const ordered: AILogTab[] = ["recap", "next-speak", "followup", "questions", "freeform"]
    return ordered.filter((t) => found.has(t))
  }, [session])

  const filteredLogs = useMemo(() => {
    if (!session) return []
    return session.ai_logs.filter((log) => (log.type as AILogTab) === activeAILogTab)
  }, [session, activeAILogTab])

  const handleCopyAll = async () => {
    if (!session) return
    const allText = session.captions.map((c) => `[${c.time}] ${c.source}: ${c.text}`).join("\n")
    if (!allText.trim()) return
    try {
      await navigator.clipboard.writeText(allText)
    } catch (error) {
      console.error("Failed to copy text:", error)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={d.back}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <span className="block text-xs text-muted-foreground">
              {session ? formatCreatedAt(session.created_at) : ""}
            </span>
            <h1 className="text-lg font-semibold text-foreground">
              {session?.title || d.untitledSession}
            </h1>
          </div>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={d.share}
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-5 py-2.5 border-b border-border">
        {(Object.keys(TAB_LABELS) as DetailTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto">
        {loading && <div className="p-5 text-sm text-muted-foreground">{d.generating}</div>}
        {!loading && !session && <div className="p-5 text-sm text-muted-foreground">{d.noData}</div>}

        {!loading && session && activeTab === "summary" && (
          <div className="p-5">
            <div className="rounded-xl bg-secondary/50 border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">{d.meetingSummary}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {session.summary || d.noData}
              </p>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
                <div>
                  <span className="block text-xs text-muted-foreground">{d.callDuration}</span>
                  <span className="text-sm font-semibold text-foreground">{session.duration}</span>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">{d.participants}</span>
                  <span className="text-sm font-semibold text-foreground">{`${session.participants} ${d.persons}`}</span>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">{d.aiAssists}</span>
                  <span className="text-sm font-semibold text-foreground">{`${session.ai_assists} ${d.times}`}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && session && activeTab === "caption" && (
          <div className="flex flex-col gap-0.5 p-3">
            {session.captions.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground">{d.noData}</div>
            )}
            {session.captions.map((entry, i) => (
              <div
                key={`${entry.time}-${i}`}
                className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 ${
                  entry.status === "interim" ? "bg-primary/5" : "hover:bg-secondary/30"
                } transition-colors`}
              >
                <span className="shrink-0 w-16 text-[11px] font-mono text-muted-foreground pt-0.5">
                  {entry.time}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    entry.source.startsWith("SPK") || entry.source === "MIC"
                      ? "bg-primary/15 text-primary"
                      : "bg-success/15 text-success"
                  }`}
                >
                  {entry.source}
                </span>
                {entry.status === "interim" && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-warning bg-warning/10 font-medium">
                    {d.interim}
                  </span>
                )}
                <span
                  className={`text-sm leading-relaxed ${
                    entry.status === "interim" ? "text-muted-foreground italic" : "text-foreground"
                  }`}
                >
                  {entry.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {!loading && session && activeTab === "ai-log" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border">
              {aiLogTypes.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveAILogTab(tab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeAILogTab === tab
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {AI_LOG_TAB_LABELS[tab]}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 p-4">
              {filteredLogs.map((log, i) => (
                <div key={`${log.time}-${i}`} className="rounded-xl bg-secondary/50 border border-border p-3.5">
                  <span className="block text-[10px] font-mono text-muted-foreground mb-1.5">
                    {log.time}
                  </span>
                  <p className="text-sm text-foreground leading-relaxed">{log.text}</p>
                </div>
              ))}
              {filteredLogs.length === 0 && (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  {d.noData}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && session && activeTab === "usage" && (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: d.sttProcessingTime, value: session.stt_processing_time },
                { label: d.aiInferenceCount, value: String(session.ai_inference_count) },
                { label: d.audioDataSize, value: session.audio_data_size },
                { label: d.tokenUsage, value: String(session.token_usage) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-secondary/50 border border-border p-4">
                  <span className="block text-xs text-muted-foreground mb-1">{item.label}</span>
                  <span className="text-lg font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 py-3 border-t border-border">
        <button
          onClick={() => void handleCopyAll()}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
        >
          <Copy className="h-3.5 w-3.5" />
          {d.copyAll}
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary">
          <Download className="h-3.5 w-3.5" />
          {d.export}
        </button>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10">
          <Trash2 className="h-3.5 w-3.5" />
          {d.deleteSession}
        </button>
      </div>
    </div>
  )
}
