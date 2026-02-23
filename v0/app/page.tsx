"use client"

import { useState } from "react"
import { OverlayMinibar } from "@/components/kanpe/overlay-minibar"
import { OverlayExpanded } from "@/components/kanpe/overlay-expanded"
import { ScreenOnboarding } from "@/components/kanpe/screen-onboarding"
import { ScreenSessionList } from "@/components/kanpe/screen-session-list"
import { ScreenSessionDetail } from "@/components/kanpe/screen-session-detail"
import { ScreenSettings } from "@/components/kanpe/screen-settings"
import { t, type Locale, type Dict } from "@/lib/i18n"

type Screen = "overlay-mini" | "overlay-expanded" | "onboarding" | "sessions" | "detail" | "settings"

function getScreenLabels(d: Dict): Record<Screen, string> {
  return {
    "overlay-mini": d.overlayMinibar,
    "overlay-expanded": d.overlayExpanded,
    onboarding: d.onboarding,
    sessions: d.sessionList,
    detail: d.sessionDetail,
    settings: d.settingsTitle,
  }
}

export default function Page() {
  const [activeScreen, setActiveScreen] = useState<Screen>("sessions")
  const [recording, setRecording] = useState<"recording" | "paused">("recording")
  const [connection, setConnection] = useState<"connected" | "reconnecting" | "disconnected">("connected")
  const [locale, setLocale] = useState<Locale>("en")

  const d = t(locale)
  const SCREEN_LABELS = getScreenLabels(d)

  const toggleRecording = () =>
    setRecording((prev) => (prev === "recording" ? "paused" : "recording"))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navigation bar */}
      <nav className="sticky top-0 z-50 flex items-center gap-2 border-b border-border bg-card/80 backdrop-blur-xl px-4 py-3 overflow-x-auto">
        <div className="flex items-center gap-2 mr-4 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <span className="text-xs font-bold text-primary-foreground">K</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Kanpe</span>
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(SCREEN_LABELS) as Screen[]).map((screen) => (
            <button
              key={screen}
              onClick={() => setActiveScreen(screen)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeScreen === screen
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {SCREEN_LABELS[screen]}
            </button>
          ))}
        </div>

        {/* State toggles + locale */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* Language toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border px-2 py-1">
            <button
              onClick={() => setLocale("en")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                locale === "en"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLocale("ja")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                locale === "ja"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              JA
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border px-2 py-1">
            <span className="text-[10px] text-muted-foreground mr-1">{d.navRecording}</span>
            <button
              onClick={() => setRecording("recording")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                recording === "recording"
                  ? "bg-destructive/15 text-destructive"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.navRecordingActive}
            </button>
            <button
              onClick={() => setRecording("paused")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                recording === "paused"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.navPaused}
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border px-2 py-1">
            <span className="text-[10px] text-muted-foreground mr-1">{d.navConnection}</span>
            <button
              onClick={() => setConnection("connected")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                connection === "connected"
                  ? "bg-success/15 text-success"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.navConnected}
            </button>
            <button
              onClick={() => setConnection("reconnecting")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                connection === "reconnecting"
                  ? "bg-warning/15 text-warning"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.navReconnecting}
            </button>
            <button
              onClick={() => setConnection("disconnected")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                connection === "disconnected"
                  ? "bg-destructive/15 text-destructive"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.navDisconnected}
            </button>
          </div>
        </div>
      </nav>

      {/* Main content area */}
      <main className="flex flex-1 items-center justify-center p-6 md:p-10">
        {activeScreen === "overlay-mini" && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h2 className="text-sm font-semibold text-foreground mb-1">{d.overlayMinibar}</h2>
              <p className="text-xs text-muted-foreground">{d.overlayMinibarDesc}</p>
            </div>
            <OverlayMinibar
              dict={d}
              recording={recording}
              connection={connection}
              onExpand={() => setActiveScreen("overlay-expanded")}
              onToggleRecording={toggleRecording}
              onClose={() => {}}
            />
          </div>
        )}

        {activeScreen === "overlay-expanded" && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h2 className="text-sm font-semibold text-foreground mb-1">{d.overlayExpanded}</h2>
              <p className="text-xs text-muted-foreground">{d.overlayExpandedDesc}</p>
            </div>
            <OverlayExpanded
              dict={d}
              recording={recording}
              connection={connection}
              permissionMissing={false}
              onCollapse={() => setActiveScreen("overlay-mini")}
              onToggleRecording={toggleRecording}
              onClose={() => {}}
            />
          </div>
        )}

        {activeScreen === "onboarding" && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h2 className="text-sm font-semibold text-foreground mb-1">{d.onboarding}</h2>
              <p className="text-xs text-muted-foreground">{d.onboardingDesc}</p>
            </div>
            <ScreenOnboarding dict={d} />
          </div>
        )}

        {activeScreen === "sessions" && (
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
            <div className="text-center">
              <h2 className="text-sm font-semibold text-foreground mb-1">{d.sessionList}</h2>
              <p className="text-xs text-muted-foreground">{d.sessionListDesc}</p>
            </div>
            <ScreenSessionList dict={d} onSelectSession={() => setActiveScreen("detail")} onOpenSettings={() => setActiveScreen("settings")} />
          </div>
        )}

        {activeScreen === "detail" && (
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
            <div className="text-center">
              <h2 className="text-sm font-semibold text-foreground mb-1">{d.sessionDetail}</h2>
              <p className="text-xs text-muted-foreground">{d.sessionDetailDesc}</p>
            </div>
            <ScreenSessionDetail dict={d} onBack={() => setActiveScreen("sessions")} />
          </div>
        )}

        {activeScreen === "settings" && (
          <div className="flex flex-col items-center gap-8 w-full max-w-3xl">
            <div className="text-center">
              <h2 className="text-sm font-semibold text-foreground mb-1">{d.settingsTitle}</h2>
              <p className="text-xs text-muted-foreground">{d.settingsDesc}</p>
            </div>
            <ScreenSettings dict={d} locale={locale} onLocaleChange={setLocale} />
          </div>
        )}
      </main>
    </div>
  )
}
