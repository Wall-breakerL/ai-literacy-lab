import type { AssessmentFlowState } from "@/domain/assessment/registry";
import type { ProbeDefinition } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";
import { buildAgentAMessage } from "@/server/engine/agent-a-runner";
import { getLlmEnvConfig } from "@/server/providers/llm-env";
import { getLlmProvider } from "@/server/providers/llm-provider";

export async function generateAgentAReply(input: {
  assessmentState: AssessmentFlowState;
  scene: SceneBlueprint;
  stageId: string;
  bridgeToNextScene?: boolean;
  firedProbes: ProbeDefinition[];
  userMessagePreview: string;
  agentBIntentSummary: string;
  llmEnabled: boolean;
}): Promise<string> {
  if (input.bridgeToNextScene) {
    return "你已经完成本段任务。接下来进入下一段场景，请沿用「先约束、再比较、再验证」的协作方式。";
  }

  const cfg = getLlmEnvConfig();
  if (input.llmEnabled && cfg.apiKey) {
    try {
      const provider = getLlmProvider();
      const system =
        "你是 Agent A：面向用户的中文协作助手。语气专业、平静。不要提及 Agent B、probe、评分或内部机制。" +
        "若需要引导用户回应挑战，请用自然的问题表达，不要说「Probe」或「注入」。";
      const user = [
        `场景：${input.scene.titleZh}`,
        `当前阶段：${input.stageId}`,
        `用户刚说：${input.userMessagePreview.slice(0, 800)}`,
        `评估侧摘要（勿复述给用户）：${input.agentBIntentSummary.slice(0, 500)}`,
        input.firedProbes.length
          ? `请自然融入这些关注点（勿逐条罗列）：\n${input.firedProbes.map((p) => `- ${p.injectMessageTemplate}`).join("\n")}`
          : "",
        "请给出一段回复：先回应用户内容，再给 1-2 个可执行的下一步建议。",
      ]
        .filter(Boolean)
        .join("\n\n");

      return await provider.completeText({
        model: cfg.modelAgentA,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
    } catch {
      // fallback below
    }
  }

  return buildAgentAMessage({
    assessmentState: input.assessmentState,
    scene: input.scene,
    stageId: input.stageId,
    bridgeToNextScene: input.bridgeToNextScene,
    firedProbes: input.firedProbes,
  });
}
