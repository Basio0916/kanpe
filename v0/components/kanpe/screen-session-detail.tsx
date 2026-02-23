"use client"

import { useState } from "react"
import { ArrowLeft, Share2, Copy, Download, Trash2 } from "lucide-react"
import { MacOSWindow } from "./macos-window"
import type { Dict } from "@/lib/i18n"

type DetailTab = "summary" | "caption" | "ai-log" | "usage"
type AILogTab = "recap" | "next-speak" | "followup" | "questions"

interface CaptionEntry {
  time: string
  source: "MIC" | "SYS"
  status: "interim" | "final"
  text: string
}

interface AILogEntry {
  time: string
  type: AILogTab
  text: string
}

const MOCK_CAPTIONS: CaptionEntry[] = [
  { time: "14:00:01", source: "MIC", status: "final", text: "Hello everyone. Let's start the sprint review." },
  { time: "14:00:08", source: "SYS", status: "final", text: "Sure, let's begin." },
  { time: "14:00:15", source: "MIC", status: "final", text: "This sprint, we mainly worked on dashboard redesign and API optimization." },
  { time: "14:00:28", source: "SYS", status: "final", text: "Tell us more about the dashboard." },
  { time: "14:00:35", source: "MIC", status: "final", text: "We significantly improved KPI visibility based on user feedback." },
  { time: "14:00:48", source: "SYS", status: "final", text: "What specific changes were made?" },
  { time: "14:00:55", source: "MIC", status: "final", text: "We changed chart layouts and added real-time updates." },
  { time: "14:01:05", source: "MIC", status: "interim", text: "As for performance..." },
]

const MOCK_AI_LOGS: AILogEntry[] = [
  { time: "14:01:00", type: "recap", text: "Sprint review started. Dashboard redesign and API optimization are main achievements. KPI visibility improved, chart layout changed, real-time updates implemented." },
  { time: "14:01:00", type: "next-speak", text: "It would be good to explain the API optimization results (response time improvements, caching introduction, etc.)." },
  { time: "14:01:00", type: "followup", text: "What is the technical implementation for real-time updates? WebSocket or SSE?" },
  { time: "14:01:00", type: "questions", text: "What are the performance test results? How much improvement compared to before?" },
]

interface ScreenSessionDetailProps {
  dict: Dict
  onBack: () => void
}

export function ScreenSessionDetail({ dict: d, onBack }: ScreenSessionDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("caption")
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
  }

  return (
    <MacOSWindow className="w-full max-w-2xl">
      <div className="flex flex-col">
        {/* Header */}
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
              <span className="block text-xs text-muted-foreground">{`${d.date} ${d.monday}`}</span>
              <h1 className="text-lg font-semibold text-foreground">{d.sessionTitle}</h1>
            </div>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label={d.share}>
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
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

        {/* Content */}
        <div className="flex flex-col max-h-[420px] overflow-y-auto">
          {activeTab === "summary" && (
            <div className="p-5">
              <div className="rounded-xl bg-secondary/50 border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">{d.meetingSummary}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{d.summaryMock}</p>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
                  <div>
                    <span className="block text-xs text-muted-foreground">{d.callDuration}</span>
                    <span className="text-sm font-semibold text-foreground">32:15</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">{d.participants}</span>
                    <span className="text-sm font-semibold text-foreground">{`3 ${d.persons}`}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">{d.aiAssists}</span>
                    <span className="text-sm font-semibold text-foreground">{`12 ${d.times}`}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "caption" && (
            <div className="flex flex-col gap-0.5 p-3">
              {MOCK_CAPTIONS.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 ${
                    entry.status === "interim" ? "bg-primary/5" : "hover:bg-secondary/30"
                  } transition-colors`}
                >
                  <span className="shrink-0 w-16 text-[11px] font-mono text-muted-foreground pt-0.5">
                    {entry.time}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      entry.source === "MIC"
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

          {activeTab === "ai-log" && (
            <div className="flex flex-col">
              <div className="flex items-center gap-1 px-4 py-2 border-b border-border">
                {(Object.keys(AI_LOG_TAB_LABELS) as AILogTab[]).map((tab) => (
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
                {MOCK_AI_LOGS.filter((l) => l.type === activeAILogTab).map((log, i) => (
                  <div key={i} className="rounded-xl bg-secondary/50 border border-border p-3.5">
                    <span className="block text-[10px] font-mono text-muted-foreground mb-1.5">
                      {log.time}
                    </span>
                    <p className="text-sm text-foreground leading-relaxed">{log.text}</p>
                  </div>
                ))}
                {MOCK_AI_LOGS.filter((l) => l.type === activeAILogTab).length === 0 && (
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    {d.noData}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "usage" && (
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: d.sttProcessingTime, value: "32:15" },
                  { label: d.aiInferenceCount, value: "12" },
                  { label: d.audioDataSize, value: "48.2 MB" },
                  { label: d.tokenUsage, value: "3,240" },
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

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border">
          <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary">
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
    </MacOSWindow>
  )
}
