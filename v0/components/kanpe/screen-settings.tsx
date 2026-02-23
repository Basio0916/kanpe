"use client"

import { useState } from "react"
import {
  Settings,
  Shield,
  Volume2,
  Mic,
  Keyboard,
  Database,
  CheckCircle2,
  Globe,
} from "lucide-react"
import { MacOSWindow } from "./macos-window"
import type { Dict, Locale } from "@/lib/i18n"

type SettingsSection = "general" | "language" | "permissions" | "audio" | "stt" | "hotkeys" | "data"

interface ScreenSettingsProps {
  dict: Dict
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function ScreenSettings({ dict: d, locale, onLocaleChange }: ScreenSettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general")
  const [sttLang, setSttLang] = useState("en")
  const [llmLang, setLlmLang] = useState("en")

  const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: d.general, icon: <Settings className="h-4 w-4" /> },
    { id: "language", label: d.language, icon: <Globe className="h-4 w-4" /> },
    { id: "permissions", label: d.permissions, icon: <Shield className="h-4 w-4" /> },
    { id: "audio", label: d.audio, icon: <Volume2 className="h-4 w-4" /> },
    { id: "stt", label: d.stt, icon: <Mic className="h-4 w-4" /> },
    { id: "hotkeys", label: d.hotkeys, icon: <Keyboard className="h-4 w-4" /> },
    { id: "data", label: d.data, icon: <Database className="h-4 w-4" /> },
  ]

  const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "ja", label: "Japanese / \u65E5\u672C\u8A9E" },
    { code: "zh", label: "Chinese / \u4E2D\u6587" },
    { code: "ko", label: "Korean / \uD55C\uAD6D\uC5B4" },
    { code: "es", label: "Spanish / Espa\u00F1ol" },
    { code: "fr", label: "French / Fran\u00E7ais" },
    { code: "de", label: "German / Deutsch" },
    { code: "pt", label: "Portuguese / Portugu\u00EAs" },
    { code: "it", label: "Italian / Italiano" },
    { code: "ru", label: "Russian / \u0420\u0443\u0441\u0441\u043A\u0438\u0439" },
    { code: "ar", label: "Arabic / \u0627\u0644\u0639\u0631\u0628\u064A\u0629" },
    { code: "hi", label: "Hindi / \u0939\u093F\u0928\u094D\u0926\u0940" },
    { code: "th", label: "Thai / \u0E44\u0E17\u0E22" },
    { code: "vi", label: "Vietnamese / Ti\u1EBFng Vi\u1EC7t" },
    { code: "id", label: "Indonesian / Bahasa Indonesia" },
    { code: "nl", label: "Dutch / Nederlands" },
    { code: "pl", label: "Polish / Polski" },
    { code: "sv", label: "Swedish / Svenska" },
    { code: "tr", label: "Turkish / T\u00FCrk\u00E7e" },
    { code: "uk", label: "Ukrainian / \u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430" },
  ]

  return (
    <MacOSWindow title={`Kanpe - ${d.settingsTitle}`} className="w-full max-w-3xl">
      <div className="flex min-h-[480px]">
        {/* Sidebar */}
        <div className="flex w-48 shrink-0 flex-col border-r border-border bg-secondary/30 py-2">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2.5 mx-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                activeSection === section.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* General */}
          {activeSection === "general" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">{d.generalSettings}</h2>
                <p className="text-sm text-muted-foreground">{d.generalDesc}</p>
              </div>
              <div className="flex flex-col gap-3">
                <SettingRow label={d.autoStart} description={d.autoStartDesc}>
                  <ToggleSwitch defaultOn={false} />
                </SettingRow>
                <SettingRow label={d.startOnLogin} description={d.startOnLoginDesc}>
                  <ToggleSwitch defaultOn={true} />
                </SettingRow>
                <SettingRow label={d.notifications} description={d.notificationsDesc}>
                  <ToggleSwitch defaultOn={true} />
                </SettingRow>
              </div>
            </div>
          )}

          {/* Language */}
          {activeSection === "language" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">{d.languageSettings}</h2>
                <p className="text-sm text-muted-foreground">{d.languageDesc}</p>
              </div>
              <div className="flex flex-col gap-3">
                <SettingRow label={d.systemLanguage} description={d.systemLanguageDesc}>
                  <select
                    value={locale}
                    onChange={(e) => onLocaleChange(e.target.value as Locale)}
                    className="w-52 rounded-lg bg-secondary border border-border px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/40"
                  >
                    <option value="en">English</option>
                    <option value="ja">{"Japanese / \u65E5\u672C\u8A9E"}</option>
                  </select>
                </SettingRow>
                <SettingRow label={d.sttLanguage} description={d.sttLanguageDesc}>
                  <select
                    value={sttLang}
                    onChange={(e) => setSttLang(e.target.value)}
                    className="w-52 rounded-lg bg-secondary border border-border px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/40"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </SettingRow>
                <SettingRow label={d.llmLanguage} description={d.llmLanguageDesc}>
                  <select
                    value={llmLang}
                    onChange={(e) => setLlmLang(e.target.value)}
                    className="w-52 rounded-lg bg-secondary border border-border px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/40"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </SettingRow>
              </div>
            </div>
          )}

          {/* Permissions */}
          {activeSection === "permissions" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">{d.permissionManagement}</h2>
                <p className="text-sm text-muted-foreground">{d.permissionDesc}</p>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { label: d.micPermission, status: "granted" },
                  { label: d.screenAudioPermission, status: "granted" },
                  { label: d.overlayPermission, status: "granted" },
                ].map((perm) => (
                  <div key={perm.label} className="flex items-center justify-between rounded-xl bg-secondary/50 border border-border px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-sm text-foreground">{perm.label}</span>
                    </div>
                    <span className="text-xs text-success font-medium">{d.granted}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audio */}
          {activeSection === "audio" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">{d.audioSettings}</h2>
                <p className="text-sm text-muted-foreground">{d.audioDesc}</p>
              </div>
              <div className="flex flex-col gap-3">
                <SettingRow label={d.micInput} description={d.micInputDesc}>
                  <select className="rounded-lg bg-secondary border border-border px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/40">
                    <option>{d.macbookMic}</option>
                    <option>{d.externalMic}</option>
                  </select>
                </SettingRow>
                <SettingRow label={d.systemAudio} description={d.systemAudioDesc}>
                  <select className="rounded-lg bg-secondary border border-border px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/40">
                    <option>{d.screenCapture}</option>
                    <option>{d.virtualAudio}</option>
                  </select>
                </SettingRow>
                <SettingRow label={d.noiseSuppression} description={d.noiseSuppressionDesc}>
                  <ToggleSwitch defaultOn={true} />
                </SettingRow>
              </div>
            </div>
          )}

          {/* STT */}
          {activeSection === "stt" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">{d.sttSettings}</h2>
                <p className="text-sm text-muted-foreground">{d.sttDesc}</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-secondary/50 border border-border px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                  <Mic className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="block text-sm font-medium text-foreground">{d.deepgram}</span>
                  <span className="block text-xs text-muted-foreground">{d.deepgramDesc}</span>
                </div>
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-medium text-success">
                  {d.connectedStatus}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <SettingRow label={d.model} description={d.modelDesc}>
                  <div className="rounded-lg bg-secondary border border-border px-3 py-1.5">
                    <span className="text-sm font-mono text-foreground">nova-3</span>
                  </div>
                </SettingRow>
                <SettingRow label={d.languageLabel} description={d.languageLabelDesc}>
                  <div className="rounded-lg bg-secondary border border-border px-3 py-1.5">
                    <span className="text-sm font-mono text-foreground">ja</span>
                  </div>
                </SettingRow>
                <SettingRow label={d.interimResults} description={d.interimResultsDesc}>
                  <ToggleSwitch defaultOn={true} />
                </SettingRow>
                <SettingRow label={d.endpointing} description={d.endpointingDesc}>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-secondary border border-border px-3 py-1.5">
                      <span className="text-sm font-mono text-foreground">300</span>
                    </div>
                    <span className="text-xs text-muted-foreground">ms</span>
                  </div>
                </SettingRow>
              </div>
            </div>
          )}

          {/* Hotkeys */}
          {activeSection === "hotkeys" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">{d.hotkeysSettings}</h2>
                <p className="text-sm text-muted-foreground">{d.hotkeysDesc}</p>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { label: d.toggleOverlay, keys: ["Cmd", "Shift", "K"] },
                  { label: d.startStopRecording, keys: ["Cmd", "Shift", "R"] },
                  { label: d.pauseResumeRecording, keys: ["Cmd", "Shift", "P"] },
                  { label: d.aiAssist, keys: ["Cmd", "Shift", "A"] },
                ].map((hk) => (
                  <div
                    key={hk.label}
                    className="flex items-center justify-between rounded-xl bg-secondary/50 border border-border px-4 py-3"
                  >
                    <span className="text-sm text-foreground">{hk.label}</span>
                    <div className="flex items-center gap-1">
                      {hk.keys.map((key) => (
                        <span
                          key={key}
                          className="rounded-md bg-card border border-border px-2 py-1 text-[11px] font-mono text-muted-foreground"
                        >
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data */}
          {activeSection === "data" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">{d.dataManagement}</h2>
                <p className="text-sm text-muted-foreground">{d.dataDesc}</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="rounded-xl bg-secondary/50 border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">{d.storageUsage}</span>
                    <span className="text-sm text-muted-foreground">1.2 GB / 10 GB</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div className="h-2 w-[12%] rounded-full bg-primary" />
                  </div>
                </div>
                <SettingRow label={d.autoDelete} description={d.autoDeleteDesc}>
                  <select className="rounded-lg bg-secondary border border-border px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/40">
                    <option>{d.after30days}</option>
                    <option>{d.after90days}</option>
                    <option>{d.neverDelete}</option>
                  </select>
                </SettingRow>
                <div className="flex gap-2 mt-2">
                  <button className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary">
                    {d.exportAll}
                  </button>
                  <button className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10">
                    {d.deleteAll}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MacOSWindow>
  )
}

/* Shared sub-components */

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-secondary/50 border border-border px-4 py-3">
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ToggleSwitch({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)

  return (
    <button
      onClick={() => setOn(!on)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        on ? "bg-primary" : "bg-secondary border border-border"
      }`}
      role="switch"
      aria-checked={on}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-primary-foreground shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}
