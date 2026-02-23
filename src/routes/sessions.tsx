import { useState } from "react";
import { useNavigate } from "react-router";
import { ScreenSessionList } from "@/components/kanpe/screen-session-list";
import { ScreenSettings } from "@/components/kanpe/screen-settings";
import { useAppStore } from "@/stores/app-store";
import { useSessionStore } from "@/stores/session-store";
import { useTauriEvents } from "@/hooks/use-tauri-events";
import { showOverlay, startRecording } from "@/lib/tauri";
import { t } from "@/lib/i18n";

export function SessionsPage() {
  const navigate = useNavigate();
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const d = t(locale);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useTauriEvents();

  const extractErrorMessage = (error: unknown): string => {
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const candidate = error as { message?: unknown };
      if (typeof candidate.message === "string") return candidate.message;
      try {
        return JSON.stringify(error);
      } catch {
        // fallthrough
      }
    }
    return "Start Kanpeに失敗しました。設定を確認してください。";
  };

  const handleStartKanpe = async () => {
    try {
      setStartError(null);
      useSessionStore.getState().clearCaptions();
      const sessionId = await startRecording();
      useSessionStore.setState({ activeSessionId: sessionId });
      await showOverlay();
    } catch (error) {
      console.error("Failed to start Kanpe:", error);
      setStartError(extractErrorMessage(error));
    }
  };

  return (
    <>
      <ScreenSessionList
        dict={d}
        onSelectSession={(id) => navigate(`/sessions/${id}`)}
        onOpenSettings={() => setSettingsOpen(true)}
        onStartKanpe={handleStartKanpe}
        startError={startError}
      />

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
          />
          {/* Modal */}
          <div className="relative w-full max-w-3xl h-[520px] rounded-2xl border border-[var(--glass-border)] bg-card overflow-hidden shadow-2xl shadow-black/50">
            <ScreenSettings
              dict={d}
              locale={locale}
              onLocaleChange={setLocale}
              onClose={() => setSettingsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
