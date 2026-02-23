import { create } from "zustand";
import type { Locale } from "@/lib/i18n";

interface AppState {
  locale: Locale;
  onboardingComplete: boolean;
  setLocale: (locale: Locale) => void;
  setOnboardingComplete: (complete: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  locale: "en",
  onboardingComplete: false,
  setLocale: (locale) => set({ locale }),
  setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
}));
