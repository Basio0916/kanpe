import { create } from "zustand";

type RecordingStatus = "recording" | "paused";
type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface OverlayState {
  recording: RecordingStatus;
  connection: ConnectionStatus;
}

export const useOverlayStore = create<OverlayState>(() => ({
  recording: "paused",
  connection: "disconnected",
}));
