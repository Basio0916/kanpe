import { useState } from "react"
import { Search, MoreHorizontal, Mic } from "lucide-react"
import type { Dict } from "@/lib/i18n"

interface Session {
  id: string
  title: string
  duration: string
  time: string
  isActive?: boolean
}

const MOCK_SESSIONS: { group: "today" | "yesterday"; sessions: Session[] }[] = [
  {
    group: "today",
    sessions: [
      { id: "1", title: "Untitled session", duration: "1:59", time: "1:59am", isActive: true },
      { id: "2", title: "Untitled session", duration: "10:00", time: "1:49am" },
      { id: "3", title: "Untitled session", duration: "10:00", time: "1:35am" },
      { id: "4", title: "Quick approval chat", duration: "0:32", time: "1:20am" },
      { id: "5", title: "Pronunciation check", duration: "10:58", time: "1:04am" },
      { id: "6", title: "Weekly Sprint Review", duration: "4:48", time: "12:46am" },
      { id: "7", title: "Untitled session", duration: "0:59", time: "12:46am" },
    ],
  },
  {
    group: "yesterday",
    sessions: [
      { id: "8", title: "Voice integration consult", duration: "56:39", time: "11:31pm" },
      { id: "9", title: "Untitled session", duration: "1:46", time: "11:27pm" },
      { id: "10", title: "Unusual AI conversation", duration: "2:21", time: "10:23pm" },
      { id: "11", title: "Untitled session", duration: "0:09", time: "10:22pm" },
      { id: "12", title: "Untitled session", duration: "2:38", time: "10:17pm" },
    ],
  },
]

interface ScreenSessionListProps {
  dict: Dict
  onSelectSession: (id: string) => void
  onOpenSettings: () => void
  onStartKanpe?: () => void
  startError?: string | null
}

export function ScreenSessionList({
  dict: d,
  onSelectSession,
  onOpenSettings,
  onStartKanpe,
  startError = null,
}: ScreenSessionListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const groupLabel = (g: "today" | "yesterday") => (g === "today" ? d.today : d.yesterday)

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header with search */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {/* Centered search */}
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={d.searchPlaceholder}
              className="w-full rounded-lg bg-secondary/60 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none border border-transparent focus:border-primary/30 transition-colors"
            />
          </div>
        </div>
        {/* Avatar / Settings */}
        <button
          onClick={onOpenSettings}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden ring-2 ring-transparent hover:ring-primary/30 transition-all"
          aria-label={d.settings}
        >
          <span className="text-[11px] font-bold text-primary-foreground">M</span>
        </button>
      </div>

      {/* Header area */}
      <div className="flex items-center justify-between px-6 pt-5 pb-1">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Kanpe</h1>
        <button
          onClick={onStartKanpe}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
        >
          <Mic className="h-4 w-4" />
          {d.start}
        </button>
      </div>

      {/* Subtitle */}
      <div className="px-6 pt-1 pb-4">
        <p className="text-xs text-muted-foreground">{d.noUpcomingMeetings}</p>
        {startError && (
          <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {startError}
          </div>
        )}
      </div>

      {/* Session list */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {MOCK_SESSIONS.map((group) => (
          <div key={group.group}>
            <div className="px-6 pt-4 pb-1.5">
              <span className="text-xs font-medium text-muted-foreground">{groupLabel(group.group)}</span>
            </div>
            {group.sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                onMouseEnter={() => setHoveredId(session.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`flex items-center w-full px-6 py-2.5 text-left transition-colors ${
                  hoveredId === session.id ? "bg-secondary/50" : ""
                }`}
              >
                <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
                  {session.title}
                </span>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-xs text-muted-foreground font-mono tabular-nums w-12 text-right">
                    {session.duration}
                  </span>
                  {hoveredId === session.id ? (
                    <button
                      onClick={(e) => { e.stopPropagation() }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {session.time}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom recording card */}
      <div className="border-t border-border px-5 py-3 mt-auto">
        <div className="flex items-center gap-3 rounded-xl bg-secondary/60 border border-[var(--glass-border)] px-4 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground truncate">{d.untitledSession}</h4>
            <span className="text-xs text-muted-foreground">{`${d.recording} \u00b7 0:19`}</span>
          </div>
          <button className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20" aria-label={d.stopRecording}>
            <span className="h-3 w-3 rounded-sm bg-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}
