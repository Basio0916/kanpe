import { create } from "zustand";
import type { CaptionEvent, AiResponseEvent, Session } from "@/lib/tauri";

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  captions: CaptionEvent[];
  setSessions: (sessions: Session[]) => void;
  addCaption: (caption: CaptionEvent) => void;
  addAiResponse: (response: AiResponseEvent) => void;
  clearCaptions: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSessionId: null,
  captions: [],
  setSessions: (sessions) => set({ sessions }),
  addCaption: (caption) =>
    set((state) => ({ captions: [...state.captions, caption] })),
  addAiResponse: (_response) => {
    // AI responses are handled by components directly
  },
  clearCaptions: () => set({ captions: [] }),
}));
