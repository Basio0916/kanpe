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
    set((state) => {
      const captions = [...state.captions];
      const hasInterimTail =
        captions.length > 0 &&
        captions[captions.length - 1].status === "interim";
      if (hasInterimTail) {
        captions[captions.length - 1] = caption;
      } else {
        captions.push(caption);
      }
      return { captions };
    }),
  addAiResponse: (_response) => {
    // AI responses are handled by components directly
  },
  clearCaptions: () => set({ captions: [] }),
}));
