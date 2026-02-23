import { useState } from "react";
import { OverlayMinibar } from "./components/kanpe/overlay-minibar";
import { OverlayExpanded } from "./components/kanpe/overlay-expanded";
import { useOverlayStore } from "./stores/overlay-store";
import { useAppStore } from "./stores/app-store";
import { t } from "./lib/i18n";

export default function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const { recording, connection } = useOverlayStore();
  const locale = useAppStore((s) => s.locale);
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

  if (!expanded) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        data-tauri-drag-region
      >
        <OverlayMinibar
          dict={d}
          recording={recording}
          connection={connection}
          onExpand={() => setExpanded(true)}
          onToggleRecording={toggleRecording}
          onClose={handleClose}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-start justify-center p-4 min-h-screen"
      data-tauri-drag-region
    >
      <OverlayExpanded
        dict={d}
        recording={recording}
        connection={connection}
        onCollapse={() => setExpanded(false)}
        onToggleRecording={toggleRecording}
        onClose={handleClose}
      />
    </div>
  );
}
