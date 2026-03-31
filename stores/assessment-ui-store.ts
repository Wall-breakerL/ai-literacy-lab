"use client";

import { create } from "zustand";
import {
  GetSessionResponseSchema,
  TurnRequestSchema,
  TurnResponseSchema,
  type SessionReplay,
  type SessionState,
} from "@/domain";

interface AssessmentUiState {
  snapshot: SessionState | null;
  events: SessionReplay["events"];
  loading: boolean;
  error: string | null;
  loadSession: (sessionId: string) => Promise<void>;
  sendTurn: (sessionId: string, userMessage: string) => Promise<void>;
  reset: () => void;
}

async function fetchReplay(sessionId: string): Promise<SessionReplay> {
  const response = await fetch(`/api/session/${sessionId}`, { method: "GET" });
  if (!response.ok) {
    throw new Error("加载会话失败");
  }
  return GetSessionResponseSchema.parse(await response.json());
}

async function postTurn(sessionId: string, userMessage: string): Promise<void> {
  const requestBody = TurnRequestSchema.parse({ sessionId, userMessage });
  const response = await fetch(`/api/session/${sessionId}/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    throw new Error("提交会话动作失败");
  }
  TurnResponseSchema.parse(await response.json());
}

export const useAssessmentUiStore = create<AssessmentUiState>((set) => ({
  snapshot: null,
  events: [],
  loading: false,
  error: null,
  reset: () => set({ snapshot: null, events: [], loading: false, error: null }),
  loadSession: async (sessionId) => {
    set({ loading: true, error: null });
    try {
      const replay = await fetchReplay(sessionId);
      set({ snapshot: replay.snapshot, events: replay.events, loading: false, error: null });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "未知错误",
      });
    }
  },
  sendTurn: async (sessionId, userMessage) => {
    set({ loading: true, error: null });
    try {
      await postTurn(sessionId, userMessage);
      const replay = await fetchReplay(sessionId);
      set({ snapshot: replay.snapshot, events: replay.events, loading: false, error: null });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "未知错误",
      });
    }
  },
}));
