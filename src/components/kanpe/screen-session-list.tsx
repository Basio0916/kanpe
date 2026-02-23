import { useMemo, useState } from "react"
import { Search, MoreHorizontal, Mic } from "lucide-react"
import type { Dict } from "@/lib/i18n"
import type { Session } from "@/lib/tauri"

interface SessionGroup {
  key: string
  label: string
  sessions: Session[]
}

interface ScreenSessionListProps {
  dict: Dict
  sessions: Session[]
  onSelectSession: (id: string) => void
  onOpenSettings: () => void
  onStartKanpe?: () => void
  onStopSession?: () => void
  startError?: string | null
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`
}

function buildSessionGroups(sessions: Session[], d: Dict): SessionGroup[] {
  const sorted = [...sessions].sort((a, b) => {
    const aTime = Date.parse(a.created_at || "")
    const bTime = Date.parse(b.created_at || "")
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0
    if (Number.isNaN(aTime)) return 1
    if (Number.isNaN(bTime)) return -1
    return bTime - aTime
  })

  const now = new Date()
  const todayKey = toDateKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const yesterdayKey = toDateKey(yesterday)

  const groups = new Map<string, SessionGroup>()

  for (const session of sorted) {
    const created = new Date(session.created_at)
    const key = Number.isNaN(created.getTime()) ? "unknown" : toDateKey(created)
    let label: string
    if (key === todayKey) {
      label = d.today
    } else if (key === yesterdayKey) {
      label = d.yesterday
    } else if (key === "unknown") {
      label = d.noData
    } else {
      label = created.toLocaleDateString()
    }

    const existing = groups.get(key)
    if (existing) {
      existing.sessions.push(session)
    } else {
      groups.set(key, { key, label, sessions: [session] })
    }
  }

  return Array.from(groups.values())
}

export function ScreenSessionList({
  dict: d,
  sessions,
  onSelectSession,
  onOpenSettings,
  onStartKanpe,
  onStopSession,
  startError = null,
}: ScreenSessionListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const groups = useMemo(() => buildSessionGroups(sessions, d), [sessions, d])
  const activeSession = sessions.find((s) => s.is_active)

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
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
        <button
          onClick={onOpenSettings}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden ring-2 ring-transparent hover:ring-primary/30 transition-all"
          aria-label={d.settings}
        >
          <span className="text-[11px] font-bold text-primary-foreground">M</span>
        </button>
      </div>

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

      <div className="px-6 pt-1 pb-4">
        <p className="text-xs text-muted-foreground">{d.noUpcomingMeetings}</p>
        {startError && (
          <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {startError}
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto">
        {groups.length === 0 && (
          <div className="px-6 py-10 text-sm text-muted-foreground">{d.noData}</div>
        )}
        {groups.map((group) => (
          <div key={group.key}>
            <div className="px-6 pt-4 pb-1.5">
              <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
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
                <span className="flex items-center gap-2 flex-1 min-w-0">
                  {session.is_active && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                    </span>
                  )}
                  <span className="text-sm font-medium text-foreground truncate">
                    {session.title}
                  </span>
                </span>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-xs text-muted-foreground font-mono tabular-nums w-12 text-right">
                    {session.duration}
                  </span>
                  {hoveredId === session.id ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
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

      {activeSession && (
        <div className="border-t border-border px-5 py-3 mt-auto">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/60 border border-[var(--glass-border)] px-4 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-foreground truncate">{activeSession.title}</h4>
              <span className="text-xs text-muted-foreground">{`${d.recording} \u00b7 ${activeSession.duration}`}</span>
            </div>
            <button
              onClick={onStopSession}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20"
              aria-label={d.stopRecording}
            >
              <span className="h-3 w-3 rounded-sm bg-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
