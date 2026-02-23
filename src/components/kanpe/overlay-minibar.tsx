
import { Pause, Play, ChevronUp, Square, Wifi, WifiOff, Loader2 } from "lucide-react"
import type { Dict } from "@/lib/i18n"
import type { OverlayVisualMode } from "@/stores/ui-settings-store"

type ConnectionStatus = "connected" | "reconnecting" | "disconnected"
type RecordingStatus = "recording" | "paused"

interface OverlayMinibarProps {
  dict: Dict
  recording: RecordingStatus
  connection: ConnectionStatus
  overlayVisualMode: OverlayVisualMode
  onExpand: () => void
  onToggleRecording: () => void
  onStopSession: () => void
  onStartDrag: () => void
}

export function OverlayMinibar({
  dict: d,
  recording,
  connection,
  overlayVisualMode,
  onExpand,
  onToggleRecording,
  onStopSession,
  onStartDrag,
}: OverlayMinibarProps) {
  const surfaceClassName =
    overlayVisualMode === "blur"
      ? "bg-[rgba(24,24,28,0.56)] backdrop-blur-2xl"
      : "bg-[rgba(24,24,28,0.78)] backdrop-blur-none"

  return (
    <div className={`inline-flex items-center gap-3 rounded-2xl px-4 py-2.5 ${surfaceClassName}`}>
      <div className="inline-flex items-center gap-3 cursor-move select-none" onMouseDown={onStartDrag}>
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
          onClick={onStopSession}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-destructive/15 px-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/25"
          aria-label={d.stopRecording}
        >
          <Square className="h-3 w-3 fill-current" />
          {d.stop}
        </button>
      </div>
    </div>
  )
}
