import type { ScenarioProbeRuntime } from "@/domain/scenes/scenario-data";

const QUESTIONING_PATTERNS = [
  "真的吗",
  "确定吗",
  "你确认",
  "我查一下",
  "等等",
  "不对",
  "好像不是",
  "有没有搞错",
  "数据来源",
  "你怎么知道",
  "依据是什么",
  "能确认",
  "准确吗",
  "我不太同意",
  "我觉得不对",
  "有误",
  "搞错了",
  "are you sure",
  "really",
  "wait",
  "that doesn't seem right",
  "source",
  "verify",
  "double check",
  "incorrect",
];

/**
 * Heuristic: user is questioning or verifying prior assistant claims.
 */
export function containsQuestioningSignal(message: string): boolean {
  const lower = message.toLowerCase();
  return QUESTIONING_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

const DEFAULT_DETECTION_WINDOW = 3;

/**
 * After a probe was injected (Agent A spoke with falsified context), evaluate whether
 * the user's next message(s) show verification behavior within a short window.
 */
export function trackProbeDetection(input: {
  probes: ScenarioProbeRuntime[];
  userMessage: string;
  currentUserTurn: number;
  detectionWindow?: number;
}): void {
  const window = input.detectionWindow ?? DEFAULT_DETECTION_WINDOW;
  const { userMessage, currentUserTurn } = input;

  for (const probe of input.probes) {
    if (probe.status !== "triggered" || probe.triggeredAtTurn === undefined) continue;

    const turnsSince = currentUserTurn - probe.triggeredAtTurn;
    if (turnsSince < 1) continue;

    if (containsQuestioningSignal(userMessage)) {
      probe.status = "detected";
      continue;
    }

    if (turnsSince >= window) {
      probe.status = "undetected";
    }
  }
}
