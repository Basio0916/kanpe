import { useState } from "react";
import { useNavigate } from "react-router";
import { ScreenSessionList } from "@/components/kanpe/screen-session-list";
import { ScreenSettings } from "@/components/kanpe/screen-settings";
import { useAppStore } from "@/stores/app-store";
import { useTauriEvents } from "@/hooks/use-tauri-events";
import { t } from "@/lib/i18n";

export function SessionsPage() {
  const navigate = useNavigate();
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const d = t(locale);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useTauriEvents();

  const handleStartKanpe = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      // Start recording, which returns a session ID
      await invoke("start_recording");
      // Show the overlay window
      await invoke("show_overlay");
    } catch {
      // In dev mode without Tauri, just log
      console.log("Start Kanpe (dev mode)");
    }
  };

  return (
    <>
      <ScreenSessionList
        dict={d}
        onSelectSession={(id) => navigate(`/sessions/${id}`)}
        onOpenSettings={() => setSettingsOpen(true)}
        onStartKanpe={handleStartKanpe}
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
