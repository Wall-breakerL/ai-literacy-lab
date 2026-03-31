import type { SessionEvent, SessionState } from "@/domain";
import type { SceneId } from "@/domain/scenes/types";

type ReplayItemType = "user" | "agent" | "stage_changed" | "probe";

export interface ReplayTurnItem {
  eventId: string;
  timestamp: string;
  sceneId: SceneId;
  type: ReplayItemType;
  content: string;
  stageFrom?: string;
  stageTo?: string;
  probeId?: string;
  mbtiDeltas?: Record<string, number>;
  faaScores?: Record<string, number>;
}

export interface ReplaySceneBlock {
  sceneId: SceneId;
  title: string;
  items: ReplayTurnItem[];
}

export interface SessionReplayView {
  sessionId: string;
  assessmentState: string;
  scenes: ReplaySceneBlock[];
  dividers: Array<{ fromSceneId: SceneId; toSceneId: SceneId; timestamp: string }>;
}

function sceneTitle(sceneId: SceneId): string {
  return sceneId === "apartment-tradeoff" ? "Apartment Trade-off" : "Brand Naming Sprint";
}

export function buildReplayView(sessionId: string, snapshot: SessionState, events: SessionEvent[]): SessionReplayView {
  const sceneMap: Record<SceneId, ReplaySceneBlock> = {
    "apartment-tradeoff": { sceneId: "apartment-tradeoff", title: sceneTitle("apartment-tradeoff"), items: [] },
    "brand-naming-sprint": { sceneId: "brand-naming-sprint", title: sceneTitle("brand-naming-sprint"), items: [] },
  };
  const dividers: Array<{ fromSceneId: SceneId; toSceneId: SceneId; timestamp: string }> = [];

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.type === "USER_MESSAGE") {
      sceneMap[event.payload.sceneId].items.push({
        eventId: event.id,
        timestamp: event.timestamp,
        sceneId: event.payload.sceneId,
        type: "user",
        content: event.payload.message,
      });
    } else if (event.type === "AGENT_A_MESSAGE") {
      sceneMap[event.payload.sceneId].items.push({
        eventId: event.id,
        timestamp: event.timestamp,
        sceneId: event.payload.sceneId,
        type: "agent",
        content: event.payload.message,
      });
    } else if (event.type === "STAGE_CHANGED") {
      sceneMap[event.payload.sceneId].items.push({
        eventId: event.id,
        timestamp: event.timestamp,
        sceneId: event.payload.sceneId,
        type: "stage_changed",
        content: `${event.payload.fromStage} -> ${event.payload.toStage}`,
        stageFrom: event.payload.fromStage,
        stageTo: event.payload.toStage,
      });
    } else if (event.type === "PROBE_CLOSED" && event.payload.scoreApplied) {
      sceneMap[event.payload.sceneId].items.push({
        eventId: event.id,
        timestamp: event.timestamp,
        sceneId: event.payload.sceneId,
        type: "probe",
        content: event.payload.evidenceExcerpt,
        probeId: event.payload.probeId,
        mbtiDeltas: event.payload.mbtiDeltas as Record<string, number>,
        faaScores: event.payload.faaScores as Record<string, number>,
      });
    } else if (event.type === "EVALUATION_SCORE_APPLIED") {
      sceneMap[event.payload.sceneId].items.push({
        eventId: event.id,
        timestamp: event.timestamp,
        sceneId: event.payload.sceneId,
        type: "probe",
        content: event.payload.reason,
        probeId: "agent_b_signal",
        mbtiDeltas: event.payload.mbtiDeltas as Record<string, number>,
        faaScores: event.payload.faaScores as Record<string, number>,
      });
    } else if (event.type === "SCENE_COMPLETED") {
      const next = events.slice(i + 1).find((item) => item.type === "SCENE_ENTERED");
      if (next && next.type === "SCENE_ENTERED") {
        dividers.push({
          fromSceneId: event.payload.sceneId,
          toSceneId: next.payload.sceneId,
          timestamp: next.timestamp,
        });
      }
    }
  }

  return {
    sessionId,
    assessmentState: snapshot.assessmentState,
    scenes: [sceneMap["apartment-tradeoff"], sceneMap["brand-naming-sprint"]],
    dividers,
  };
}

