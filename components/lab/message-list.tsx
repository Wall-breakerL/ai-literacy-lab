import type { ReactElement } from "react";
import type { SceneId, SessionEvent } from "@/domain";
import { SceneDivider } from "@/components/lab/scene-divider";
import { MessageCard } from "@/components/lab/message-card";
import { TypingIndicator } from "@/components/lab/typing-indicator";

const SCENE_LABEL: Record<SceneId, string> = {
  "apartment-tradeoff": "任务 1：租房权衡",
  "brand-naming-sprint": "任务 2：品牌命名",
};

interface MessageListProps {
  events: SessionEvent[];
  stageByScene: Partial<Record<SceneId, string>>;
  isThinking: boolean;
}

export function MessageList({ events, stageByScene, isThinking }: MessageListProps) {
  const nodes: Array<ReactElement> = [];

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.type === "USER_MESSAGE") {
      nodes.push(
        <MessageCard
          content={event.payload.message}
          key={event.id}
          role="user"
          sceneLabel={SCENE_LABEL[event.payload.sceneId]}
          stageLabel={stageByScene[event.payload.sceneId]}
          timestamp={event.timestamp}
        />,
      );
      continue;
    }

    if (event.type === "AGENT_A_MESSAGE") {
      nodes.push(
        <MessageCard
          content={event.payload.message}
          key={event.id}
          role="agent"
          sceneLabel={SCENE_LABEL[event.payload.sceneId]}
          stageLabel={stageByScene[event.payload.sceneId]}
          timestamp={event.timestamp}
        />,
      );
      continue;
    }

    if (event.type === "SCENE_COMPLETED") {
      const entered = events.slice(i + 1).find((next) => next.type === "SCENE_ENTERED");
      if (entered && entered.type === "SCENE_ENTERED") {
        nodes.push(
          <SceneDivider
            fromSceneId={event.payload.sceneId}
            key={`divider-${event.id}`}
            timestamp={entered.timestamp}
            toSceneId={entered.payload.sceneId}
          />,
        );
      }
    }
  }

  return (
    <div className="space-y-3">
      {nodes.length > 0 ? nodes : <p className="text-sm text-lab-muted">等待实验消息开始...</p>}
      {isThinking ? <TypingIndicator /> : null}
    </div>
  );
}
