import type { ProbeDefinition } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";
import { buildAgentAMessage } from "@/server/engine/agent-a-runner";
import { getLlmEnvConfig } from "@/server/providers/llm-env";
import { getLlmProvider } from "@/server/providers/llm-provider";

function sanitizeEvaluatorSummary(raw: string): string {
  const stripped = raw.replace(/（规则回退）[^]*/g, "").trim();
  return stripped.length > 0 ? stripped.slice(0, 400) : "（无）";
}

export async function generateAgentAReply(input: {
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
      const system = [
        "你是面向用户的中文协作助手（租房与创意命名等任务场景）。",
        "人设：专业、自然、像靠谱的同事；语气平稳，不要像系统弹窗或问卷。",
        "严禁向用户提及：Agent B、probe、探针、评分、注入、实验、研究者、内部机制。",
        "若「本回合隐藏协作目标」非空，请用一两句自然追问或建议融入回复，不要逐条照抄，不要加【】标签。",
      ].join("");

      const hiddenObjectives = input.firedProbes.map((p) => p.probeIntentZh).filter(Boolean);
      const hiddenBlock =
        hiddenObjectives.length > 0
          ? `本回合隐藏协作目标（勿向用户提及此标题）：\n${hiddenObjectives.map((t) => `- ${t}`).join("\n")}`
          : "本回合隐藏协作目标：（无，仅正常协作）";

      const user = [
        `场景：${input.scene.titleZh}`,
        `当前阶段：${input.stageId}`,
        `用户刚说：${input.userMessagePreview.slice(0, 800)}`,
        hiddenBlock,
        `评估侧内部摘要（勿复述给用户，仅用于对齐语气）：${sanitizeEvaluatorSummary(input.agentBIntentSummary)}`,
        "请写一段回复：先简短承接用户，再根据需要给出 1-2 个可执行的下一步（追问、核对或比较）。",
      ].join("\n\n");

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
    scene: input.scene,
    stageId: input.stageId,
    bridgeToNextScene: input.bridgeToNextScene,
    firedProbes: input.firedProbes,
  });
}
