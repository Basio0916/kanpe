import { useEffect, useState } from "react";
import { OverlayMinibar } from "./components/kanpe/overlay-minibar";
import { OverlayExpanded } from "./components/kanpe/overlay-expanded";
import { useOverlayStore } from "./stores/overlay-store";
import { useAppStore } from "./stores/app-store";
import { useSessionStore } from "./stores/session-store";
import { useUiSettingsStore } from "./stores/ui-settings-store";
import { useTauriEvents } from "./hooks/use-tauri-events";
import { getActiveSessionId, pauseRecording, resumeRecording, stopRecording } from "./lib/tauri";
import { t } from "./lib/i18n";

const OVERLAY_MINIBAR_SIZE = { width: 460, height: 54 };
const OVERLAY_EXPANDED_SIZE = { width: 780, height: 360 };

export default function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const { recording, connection } = useOverlayStore();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const locale = useAppStore((s) => s.locale);
  const overlayVisualMode = useUiSettingsStore((s) => s.overlayVisualMode);
  const d = t(locale);

  useTauriEvents();

  const toggleRecording = async () => {
    if (!activeSessionId) return;
    try {
      if (recording === "recording") {
        await pauseRecording(activeSessionId);
      } else {
        await resumeRecording(activeSessionId);
      }
    } catch (error) {
      console.error("Failed to toggle recording:", error);
    }
  };

  const handleStopSession = async () => {
    try {
      const sessionId = activeSessionId ?? (await getActiveSessionId());
      if (!sessionId) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().hide();
        return;
      }
      await stopRecording(sessionId);
      useSessionStore.setState({ activeSessionId: null });
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const handleStartDrag = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startDragging();
    } catch {
      // fallback for dev mode
    }
  };

  useEffect(() => {
    document.documentElement.dataset.overlay = "true";
    document.body.dataset.overlay = "true";
    const root = document.getElementById("root");
    root?.setAttribute("data-overlay", "true");
    return () => {
      delete document.documentElement.dataset.overlay;
      delete document.body.dataset.overlay;
      root?.removeAttribute("data-overlay");
    };
  }, []);

  useEffect(() => {
    const hydrateActiveSession = async () => {
      try {
        const sessionId = await getActiveSessionId();
        if (sessionId) {
          useSessionStore.setState({ activeSessionId: sessionId });
        }
      } catch {
        // ignore and rely on runtime events
      }
    };

    void hydrateActiveSession();
  }, []);

  useEffect(() => {
    const syncVisualModeFromStorage = (event: StorageEvent) => {
      if (event.key !== "kanpe-ui-settings" || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as {
          state?: { overlayVisualMode?: "translucent" | "blur" };
        };
        const mode = parsed.state?.overlayVisualMode;
        if (!mode || (mode !== "translucent" && mode !== "blur")) return;
        const currentMode = useUiSettingsStore.getState().overlayVisualMode;
        if (currentMode === mode) return;
        useUiSettingsStore.getState().setOverlayVisualMode(mode);
      } catch {
        // ignore malformed storage payload
      }
    };

    window.addEventListener("storage", syncVisualModeFromStorage);
    return () => {
      window.removeEventListener("storage", syncVisualModeFromStorage);
    };
  }, []);

  useEffect(() => {
    const syncOverlayWindowSize = async () => {
      try {
        const [{ getCurrentWindow }, { LogicalSize }] = await Promise.all([
          import("@tauri-apps/api/window"),
          import("@tauri-apps/api/dpi"),
        ]);
        const size = expanded ? OVERLAY_EXPANDED_SIZE : OVERLAY_MINIBAR_SIZE;
        await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
      } catch {
        // fallback for dev mode
      }
    };

    void syncOverlayWindowSize();
  }, [expanded]);

  if (!expanded) {
    return (
      <OverlayMinibar
        dict={d}
        recording={recording}
        connection={connection}
        onExpand={() => setExpanded(true)}
        onToggleRecording={toggleRecording}
        onStopSession={handleStopSession}
        onStartDrag={handleStartDrag}
        overlayVisualMode={overlayVisualMode}
      />
    );
  }

  return (
    <OverlayExpanded
      dict={d}
      recording={recording}
      connection={connection}
      onCollapse={() => setExpanded(false)}
      onToggleRecording={toggleRecording}
      onStopSession={handleStopSession}
      onStartDrag={handleStartDrag}
      overlayVisualMode={overlayVisualMode}
    />
  );
}
