import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type OverlayVisualMode = "translucent" | "blur";

interface UiSettingsState {
  overlayVisualMode: OverlayVisualMode;
  setOverlayVisualMode: (mode: OverlayVisualMode) => void;
}

export const useUiSettingsStore = create<UiSettingsState>()(
  persist(
    (set) => ({
      overlayVisualMode: "translucent",
      setOverlayVisualMode: (mode) => set({ overlayVisualMode: mode }),
    }),
    {
      name: "kanpe-ui-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
