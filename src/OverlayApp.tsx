import { useEffect, useState } from "react";
import { OverlayMinibar } from "./components/kanpe/overlay-minibar";
import { OverlayExpanded } from "./components/kanpe/overlay-expanded";
import { useOverlayStore } from "./stores/overlay-store";
import { useAppStore } from "./stores/app-store";
import { useUiSettingsStore } from "./stores/ui-settings-store";
import { t } from "./lib/i18n";

const OVERLAY_MINIBAR_SIZE = { width: 460, height: 54 };
const OVERLAY_EXPANDED_SIZE = { width: 780, height: 360 };

export default function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const { recording, connection } = useOverlayStore();
  const locale = useAppStore((s) => s.locale);
  const overlayVisualMode = useUiSettingsStore((s) => s.overlayVisualMode);
  const d = t(locale);

  const toggleRecording = () => {
    useOverlayStore.setState({
      recording: recording === "recording" ? "paused" : "recording",
    });
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    } catch {
      // fallback for dev mode
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
        onClose={handleClose}
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
      onClose={handleClose}
      onStartDrag={handleStartDrag}
      overlayVisualMode={overlayVisualMode}
    />
  );
}
