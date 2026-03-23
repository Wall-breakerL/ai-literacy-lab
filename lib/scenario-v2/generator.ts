import { randomUUID } from "crypto";
import type { ScenarioBlueprint } from "./types";

type BuildGeneratedBlueprintInput = {
  taskPrompt: string;
};

function toSafeId(input: string): string {
  const stem =
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36) || "custom_task";
  return `generated_${stem}_${Date.now().toString().slice(-6)}`;
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildGeneratedBlueprint(input: BuildGeneratedBlueprintInput): ScenarioBlueprint {
  const prompt = compact(input.taskPrompt);
  const id = toSafeId(prompt);
  const promptSuffix = randomUUID().slice(0, 6);

  return {
    id,
    pack: "coordination",
    family: "generated_from_task_prompt",
    applicableIdentityTags: ["generated", "custom_task"],
    phases: {
      helper: {
        type: "helper",
        assistantRolePrompt:
          "你是 AI helper。目标是帮助用户把任务拆解为可执行步骤，先澄清目标/约束，再给出可选方案，不替用户直接做决定。",
        worldState: `用户希望完成如下任务：${prompt}`,
        openingMessage: `我会作为 AI helper 协助你完成这个任务：${prompt}。我们先确认目标、约束和交付形式。`,
        hiddenProbes: [
          {
            probeId: "gen_helper_goal_clarity",
            targetDimensions: ["taskFraming", "dialogSteering"],
            injectionTiming: "opening",
            assistantMove: "观察用户是否主动补充目标、约束、时间线。",
            positiveSignals: ["明确目标", "说明约束", "提出里程碑"],
            negativeSignals: ["目标始终模糊"],
            severity: "medium",
          },
        ],
        turnPolicies: { maxTurns: 14, minUserTurns: 3, allowEarlyFinish: true },
        successSignals: ["出现明确分工或步骤", "形成可执行下一步"],
        stopConditions: ["用户确认计划可执行", "用户主动结束任务阶段"],
      },
      talk: {
        type: "talk",
        assistantRolePrompt:
          "你是 AI。与用户围绕选定话题讨论，重点是帮助其理解 AI 能力边界与可靠性问题，不扮演真人同伴。",
        openingMessage: "任务阶段完成。请输入你想在下一段深入讨论的话题（可留空使用默认引导）。",
        hiddenProbes: [
          {
            probeId: "gen_talk_boundary_check",
            targetDimensions: ["modelMentalModel", "trustBoundaryCalibration"],
            injectionTiming: "after_turn_n",
            injectionTurn: 2,
            assistantMove: "给出需核验的信息点，观察用户是否要求来源。",
            positiveSignals: ["追问来源", "表达不确定", "提出核验步骤"],
            negativeSignals: ["直接采纳不核验"],
            severity: "high",
          },
        ],
        defaultTalkPrompt: `围绕“${prompt}”继续讨论：哪些结论可以参考 AI，哪些必须人工核验？（${promptSuffix}）`,
        talkPromptPolicy: {
          allowEmptyPrompt: true,
          maxChars: 240,
        },
        talkSafety: {
          blockedCategories: ["政治敏感", "色情", "暴力", "歧视", "宗教极端"],
          blockedKeywords: ["翻墙", "VPN", "政治人物姓名"],
          fallbackMessage: "这个话题可能涉及敏感领域，我们换一个方向继续讨论。",
        },
        turnPolicies: { maxTurns: 12, minUserTurns: 3 },
      },
    },
    phaseSwitchPolicy: { trigger: "user_explicit", minPhase1UserTurns: 3 },
    assistantRolePrompt: "",
    worldState: "",
    openingMessage: "",
    hiddenProbes: [],
    turnPolicies: { maxTurns: 26 },
    successSignals: [],
    stopConditions: [],
    debriefQuestions: [
      "刚才哪些信息你认为必须核验来源？",
      "如果 AI 说得很自信但你不确定，你会怎么做？",
      "下次类似任务里，你会如何分配 AI 与人工的职责？",
    ],
    version: "3.0-generated",
  };
}
