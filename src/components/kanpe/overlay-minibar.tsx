
import { Pause, Play, ChevronUp, X, Wifi, WifiOff, Loader2 } from "lucide-react"
import type { Dict } from "@/lib/i18n"

type ConnectionStatus = "connected" | "reconnecting" | "disconnected"
type RecordingStatus = "recording" | "paused"

interface OverlayMinibarProps {
  dict: Dict
  recording: RecordingStatus
  connection: ConnectionStatus
  onExpand: () => void
  onToggleRecording: () => void
  onClose: () => void
}

export function OverlayMinibar({
  dict: d,
  recording,
  connection,
  onExpand,
  onToggleRecording,
  onClose,
}: OverlayMinibarProps) {
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl bg-[var(--glass)] px-4 py-2.5 backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl shadow-black/40">
      {/* App name */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
          <span className="text-[10px] font-bold text-primary-foreground">K</span>
        </div>
        <span className="text-sm font-semibold text-foreground">Kanpe</span>
      </div>

      <div className="h-4 w-px bg-[var(--glass-border)]" />

      {/* Recording status */}
      <div className="flex items-center gap-1.5">
        {recording === "recording" ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
            <span className="text-xs text-destructive font-medium">{d.recording}</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-muted-foreground" />
            <span className="text-xs text-muted-foreground">{d.pauseLabel}</span>
          </>
        )}
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        {connection === "connected" && (
          <>
            <Wifi className="h-3 w-3 text-success" />
            <span className="text-xs text-success">{d.connected}</span>
          </>
        )}
        {connection === "reconnecting" && (
          <>
            <Loader2 className="h-3 w-3 text-warning animate-spin" />
            <span className="text-xs text-warning">{d.reconnecting}</span>
          </>
        )}
        {connection === "disconnected" && (
          <>
            <WifiOff className="h-3 w-3 text-destructive" />
            <span className="text-xs text-destructive">{d.disconnected}</span>
          </>
        )}
      </div>

      <div className="h-4 w-px bg-[var(--glass-border)]" />

      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onExpand}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--glass-hover)] hover:text-foreground"
          aria-label={d.expand}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleRecording}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--glass-hover)] hover:text-foreground"
          aria-label={recording === "recording" ? d.pause : d.resume}
        >
          {recording === "recording" ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--glass-hover)] hover:text-foreground"
          aria-label={d.close}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
