"use client";

import { useEffect } from "react";
import { useAssessmentUiStore } from "@/stores/assessment-ui-store";
import { useLabUiStore } from "@/stores/lab-ui-store";

export function useSessionRecovery(sessionId: string) {
  const { loadSession } = useAssessmentUiStore();
  const { setTransitionError } = useLabUiStore();

  useEffect(() => {
    setTransitionError(null);
    void loadSession(sessionId);
  }, [loadSession, sessionId, setTransitionError]);

  return { reload: () => loadSession(sessionId) };
}
