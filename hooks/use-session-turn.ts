"use client";

import { useCallback } from "react";
import { TurnResponseSchema, type TurnOutput } from "@/domain";
import { useAssessmentUiStore } from "@/stores/assessment-ui-store";
import { useLabUiStore } from "@/stores/lab-ui-store";

async function postTurn(sessionId: string, userMessage: string): Promise<TurnOutput> {
  const response = await fetch(`/api/session/${sessionId}/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId, userMessage }),
  });
  if (!response.ok) {
    throw new Error("提交会话动作失败");
  }
  return TurnResponseSchema.parse(await response.json());
}

export function useSessionTurn(sessionId: string) {
  const { loadSession } = useAssessmentUiStore();
  const { setThinking, setLastTurnOutput, setTransitionError } = useLabUiStore();

  const submitTurn = useCallback(
    async (userMessage: string) => {
      const trimmed = userMessage.trim();
      if (!trimmed) return false;

      setThinking(true);
      setTransitionError(null);
      try {
        const output = await postTurn(sessionId, trimmed);
        setLastTurnOutput(output);
        await loadSession(sessionId);
        return true;
      } catch {
        return false;
      } finally {
        setThinking(false);
      }
    },
    [loadSession, sessionId, setLastTurnOutput, setThinking, setTransitionError],
  );

  return { submitTurn };
}
