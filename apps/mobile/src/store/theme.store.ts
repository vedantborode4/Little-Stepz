import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  /** User preference. "system" follows the OS setting (the default). */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Re-apply the persisted mode to NativeWind (called once on boot). */
  apply: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "system",

      setMode: (mode) => {
        set({ mode });
        colorScheme.set(mode);
      },

      apply: () => {
        colorScheme.set(get().mode);
      },
    }),
    {
      name: "theme-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ mode: state.mode }),
      // Persisted value arrives after first paint — push it into NativeWind.
      onRehydrateStorage: () => (state) => {
        if (state) colorScheme.set(state.mode);
      },
    }
  )
);
