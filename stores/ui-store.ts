import { create } from "zustand";

type ThemeMode = "dark";

interface UiState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: "dark",
  setTheme: (theme) => set({ theme }),
}));
