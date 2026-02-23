import { useEffect } from "react";
import {
  onCaption,
  onAiResponse,
  onRecordingState,
  onConnection,
} from "@/lib/tauri";
import { useSessionStore } from "@/stores/session-store";
import { useOverlayStore } from "@/stores/overlay-store";

export function useTauriEvents() {
  useEffect(() => {
    const unlisteners: Promise<() => void>[] = [];

    unlisteners.push(
      onCaption((event) => {
        useSessionStore.getState().addCaption(event);
      }),
    );

    unlisteners.push(
      onAiResponse((event) => {
        useSessionStore.getState().addAiResponse(event);
      }),
    );

    unlisteners.push(
      onRecordingState((event) => {
        useOverlayStore.setState({
          recording:
            event.state === "stopped" ? "paused" : event.state,
        });
        if (event.state === "recording") {
          const { activeSessionId } = useSessionStore.getState();
          if (activeSessionId !== event.sessionId) {
            useSessionStore.getState().clearCaptions();
          }
          useSessionStore.setState({ activeSessionId: event.sessionId });
        } else if (event.state === "stopped") {
          useSessionStore.setState({ activeSessionId: null });
        }
      }),
    );

    unlisteners.push(
      onConnection((event) => {
        useOverlayStore.setState({ connection: event.status });
      }),
    );

    return () => {
      unlisteners.forEach((p) => p.then((unlisten) => unlisten()));
    };
  }, []);
}
