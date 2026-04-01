"use client";

import { create } from "zustand";
import type { TurnOutput } from "@/domain";

interface LabUiState {
  isDebugOpen: boolean;
  isDebugCapable: boolean;
  isLeftDrawerOpen: boolean;
  isRightDrawerOpen: boolean;
  isThinking: boolean;
  transitionError: string | null;
  lastTurnOutput: TurnOutput | null;
  setDebugOpen: (open: boolean) => void;
  setDebugCapable: (capable: boolean) => void;
  setLeftDrawerOpen: (open: boolean) => void;
  setRightDrawerOpen: (open: boolean) => void;
  setThinking: (thinking: boolean) => void;
  setTransitionError: (message: string | null) => void;
  setLastTurnOutput: (output: TurnOutput | null) => void;
  resetLabUi: () => void;
}

const initialState = {
  isDebugOpen: false,
  isDebugCapable: false,
  isLeftDrawerOpen: false,
  isRightDrawerOpen: false,
  isThinking: false,
  transitionError: null,
  lastTurnOutput: null,
};

export const useLabUiStore = create<LabUiState>((set) => ({
  ...initialState,
  setDebugOpen: (open) => set({ isDebugOpen: open }),
  setDebugCapable: (capable) => set({ isDebugCapable: capable }),
  setLeftDrawerOpen: (open) => set({ isLeftDrawerOpen: open }),
  setRightDrawerOpen: (open) => set({ isRightDrawerOpen: open }),
  setThinking: (thinking) => set({ isThinking: thinking }),
  setTransitionError: (message) => set({ transitionError: message }),
  setLastTurnOutput: (output) => set({ lastTurnOutput: output }),
  resetLabUi: () => set({ ...initialState }),
}));
