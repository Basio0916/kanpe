import { useEffect, useState } from "react"
import { ArrowLeft, Share2, Copy, Download, Trash2 } from "lucide-react"
import type { Dict } from "@/lib/i18n"
import { getSettings } from "@/lib/tauri"
import type { SessionDetail } from "@/lib/tauri"

type DetailTab = "summary" | "caption" | "ai-log"

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
  const [selfSpeakerTags, setSelfSpeakerTags] = useState<string[]>([])

  const sourceBadgeClass = (source: string) => {
    if (source === "MIC") return "bg-primary/15 text-primary"
    if (source === "SYS") return "bg-success/15 text-success"
    if (source === "SPK1") return "bg-primary/15 text-primary"
    if (source === "SPK2") return "bg-success/15 text-success"
    if (source === "SPK3") return "bg-warning/15 text-warning"
    if (source === "SPK4") return "bg-accent/20 text-accent-foreground"
    return "bg-secondary text-foreground"
  }

  const normalizeSource = (source: string) => source.trim().toUpperCase()
  const isSelfSource = (source: string) =>
    selfSpeakerTags.some((tag) => normalizeSource(tag) === normalizeSource(source))

  useEffect(() => {
    let mounted = true
    const loadSelfSpeakerTags = async () => {
      try {
        const settings = await getSettings()
        if (!mounted) return
        const tags =
          Array.isArray(settings.self_speaker_tags) && settings.self_speaker_tags.length > 0
            ? settings.self_speaker_tags
            : settings.self_speaker_tag
              ? [settings.self_speaker_tag]
              : []
        const normalized = tags
          .map((tag) => normalizeSource(tag))
          .filter((tag, index, array) => !!tag && array.indexOf(tag) === index)
        setSelfSpeakerTags(normalized)
      } catch (error) {
        console.error("Failed to load self speaker tags for session detail:", error)
      }
    }
    void loadSelfSpeakerTags()
    return () => {
      mounted = false
    }
  }, [])

  const TAB_LABELS: Record<DetailTab, string> = {
    summary: d.summary,
    caption: d.caption,
    "ai-log": d.aiLog,
  }

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
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${sourceBadgeClass(
                    entry.source,
                  )} ${
                    isSelfSource(entry.source) ? "ring-1 ring-primary bg-primary/25 text-primary-foreground" : ""
                  }`}
                >
                  {entry.source}
                  {isSelfSource(entry.source) ? " ME" : ""}
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
          <div className="flex flex-col gap-2.5 p-4">
            {session.ai_logs.length === 0 && (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                {d.noData}
              </div>
            )}
            {session.ai_logs.map((log, i) => {
              const isUser = log.role === "user"
              return (
                <div
                  key={`${log.time}-${i}`}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl border px-3 py-2 text-[13px] leading-relaxed ${
                      isUser
                        ? "bg-primary text-primary-foreground border-primary rounded-br-md"
                        : "bg-secondary text-foreground border-border rounded-bl-md"
                    }`}
                  >
                    <span
                      className={`mb-1 block text-[10px] font-mono ${
                        isUser ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {log.time} · {isUser ? "You" : "Kanpe"}
                    </span>
                    {log.text.split("\n").map((line, lineIndex) => (
                      <p key={lineIndex} className={lineIndex > 0 ? "mt-1" : ""}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
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
