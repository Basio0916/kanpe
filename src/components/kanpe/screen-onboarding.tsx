import { useState, useEffect, useCallback } from "react"
import { Mic, Monitor, Layers, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Loader2 } from "lucide-react"
import { checkPermissions, requestPermission, openSystemSettings } from "@/lib/tauri"
import type { Dict } from "@/lib/i18n"
import { getCurrentWindow } from "@tauri-apps/api/window"

type PermissionState = "granted" | "denied" | "unknown"

interface PermissionItem {
  id: string
  backendKey: "microphone" | "screen_audio" | "overlay"
  settingsPanel: string
  label: string
  description: string
  icon: React.ReactNode
  state: PermissionState
}

interface ScreenOnboardingProps {
  dict: Dict
  onComplete?: () => void
}

export function ScreenOnboarding({ dict: d, onComplete }: ScreenOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [permissions, setPermissions] = useState<PermissionItem[]>([
    {
      id: "microphone",
      backendKey: "microphone",
      settingsPanel: "microphone",
      label: d.micPermissionLabel,
      description: d.micPermissionDesc,
      icon: <Mic className="h-5 w-5" />,
      state: "unknown",
    },
    {
      id: "screen-audio",
      backendKey: "screen_audio",
      settingsPanel: "screen_audio",
      label: d.screenAudioLabel,
      description: d.screenAudioDesc,
      icon: <Monitor className="h-5 w-5" />,
      state: "unknown",
    },
    {
      id: "overlay",
      backendKey: "overlay",
      settingsPanel: "overlay",
      label: d.overlayLabel,
      description: d.overlayDesc,
      icon: <Layers className="h-5 w-5" />,
      state: "unknown",
    },
  ])

  const refreshPermissions = useCallback(async () => {
    try {
      const status = await checkPermissions()
      setPermissions((prev) =>
        prev.map((p) => ({
          ...p,
          state: status[p.backendKey] as PermissionState,
        }))
      )
    } catch (err) {
      console.error("Failed to check permissions:", err)
    }
  }, [])

  // Check permissions on mount
  useEffect(() => {
    refreshPermissions()
  }, [refreshPermissions])

  // Re-check permissions when window regains focus
  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) {
        refreshPermissions()
      }
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [refreshPermissions])

  const handleRequest = async (perm: PermissionItem) => {
    setLoading(true)
    try {
      await requestPermission(perm.backendKey)
      // Re-check all permissions after request
      await refreshPermissions()
    } catch (err) {
      console.error("Failed to request permission:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenSettings = async (perm: PermissionItem) => {
    try {
      await openSystemSettings(perm.settingsPanel)
    } catch (err) {
      console.error("Failed to open system settings:", err)
    }
  }

  const handleRecheck = async () => {
    setLoading(true)
    try {
      await refreshPermissions()
    } finally {
      setLoading(false)
    }
  }

  const allGranted = permissions.every((p) => p.state === "granted")
  const currentPerm = permissions[currentStep]

  return (
    <div className="w-full max-w-lg">
      <div className="flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <span className="text-lg font-bold text-primary-foreground">K</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{d.setup}</h1>
            <p className="text-sm text-muted-foreground">{d.setupDesc}</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {permissions.map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  i < currentStep
                    ? "bg-success text-background"
                    : i === currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {i < currentStep ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < permissions.length - 1 && (
                <div
                  className={`h-0.5 w-8 rounded-full transition-colors ${
                    i < currentStep ? "bg-success" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Current permission card */}
        {currentPerm && (
          <div className="rounded-xl border border-border bg-secondary/50 p-5 mb-6">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  currentPerm.state === "granted"
                    ? "bg-success/15 text-success"
                    : currentPerm.state === "denied"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-primary/15 text-primary"
                }`}
              >
                {currentPerm.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-foreground">{currentPerm.label}</h3>
                  {currentPerm.state === "granted" && (
                    <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      {d.granted}
                    </span>
                  )}
                  {currentPerm.state === "denied" && (
                    <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {d.denied}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {currentPerm.description}
                </p>
                <div className="flex items-center gap-2">
                  {currentPerm.state !== "granted" && (
                    <button
                      onClick={() => handleRequest(currentPerm)}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                      {d.requestPermission}
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenSettings(currentPerm)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {d.openSystemSettings}
                  </button>
                  <button
                    onClick={handleRecheck}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                    {d.recheck}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All permissions overview */}
        <div className="flex flex-col gap-2 mb-6">
          {permissions.map((p, i) => {
            if (i === currentStep) return null
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 bg-secondary/30"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    p.state === "granted" ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {p.icon}
                </div>
                <span className="flex-1 text-sm text-muted-foreground">{p.label}</span>
                {p.state === "granted" && <CheckCircle2 className="h-4 w-4 text-success" />}
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <button
          onClick={() => {
            if (allGranted) {
              onComplete?.()
            } else if (currentStep < permissions.length - 1) {
              setCurrentStep(currentStep + 1)
            }
          }}
          disabled={currentPerm?.state !== "granted"}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {allGranted ? d.getStarted : d.next}
        </button>
      </div>
    </div>
  )
}
