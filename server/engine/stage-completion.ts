import type { RuleSignal } from "@/domain/probes/types";
import type { SceneBlueprint } from "@/domain/scenes/types";

function briefGate(userMessage: string, signals: RuleSignal[]): boolean {
  return signals.length > 0 || userMessage.trim().length >= 12;
}

function apartmentCriteriaGate(msg: string): boolean {
  const hard = /硬约束|必须|一定|最晚|截止|写入合同|合同化|6200|6\s*[\/月]\s*1|宠物条款|入住|预算/.test(msg);
  const soft = /软约束|偏好|优先|希望|最好|尽量|权衡|取舍|权重|标准/.test(msg);
  if (hard && soft) return true;
  /** 允许用「标准/权重/矩阵/对比」等表述完成 criteria，避免只靠标签词 */
  return msg.length > 12 && /(标准|权重|矩阵|比较|对比|收敛|证据|宠物|室友|通勤)/.test(msg);
}

function apartmentCompareGate(msg: string): boolean {
  const letters = ["A", "B", "C", "D"].filter((id) => msg.includes(id));
  if (letters.length >= 2) {
    return /因为|理由|相比|更好|更差|倾向于|优先|淘汰|不如|更适合|矩阵|比较|对比|逐项/.test(msg);
  }
  return (/对比|比较|两套|两个房源|两个方案|并排|矩阵|逐项/.test(msg) && msg.length > 16) || msg.length > 28;
}

function apartmentStressGate(msg: string): boolean {
  return (
    /如果|假设|新增|额外|再|降\s*\d|收紧|预算|通勤|压力|blocker|风险|变化|硬伤|压力测试|隐藏|阻塞/.test(msg) &&
    msg.trim().length > 10
  );
}

function apartmentDecideGate(msg: string): boolean {
  return (
    /排序|第一|第二|第三|第四|推荐|最不|首选|垫底|梯队|从好到坏|从坏到好/.test(msg) && msg.trim().length > 18
  );
}

function brandCriteriaGate(msg: string): boolean {
  return (
    (/调性|气质|brief|避免|不说教|金融|理财|管家|轻预算|共同支出|criteria|标准/.test(msg) && msg.trim().length > 8) ||
    msg.trim().length > 14
  );
}

function brandIdeateGate(msg: string): boolean {
  return (/候选|名字|命名|名称|方案|扩展|方向/.test(msg) && msg.trim().length > 6) || msg.trim().length > 18;
}

function brandClusterGate(msg: string): boolean {
  return (/聚类|cluster|分组|筛选|淘汰|合并|矩阵|违背/.test(msg) && msg.trim().length > 8) || msg.trim().length > 20;
}

function brandStressGate(msg: string): boolean {
  return /如果|假设|新增|压力|更严|换个|冲突|违背/.test(msg) && msg.trim().length > 12;
}

function brandFinalizeGate(msg: string): boolean {
  return /tagline|理由|淘汰|定稿|最终|三个|3\s*个/.test(msg) && msg.trim().length > 18;
}

function stageOrder(scene: SceneBlueprint): string[] {
  return scene.stages.map((s) => s.id);
}

function gateForStage(sceneId: string, stageId: string, msg: string, signals: RuleSignal[]): boolean {
  if (sceneId === "apartment-tradeoff") {
    if (stageId === "brief") return briefGate(msg, signals);
    if (stageId === "criteria") return apartmentCriteriaGate(msg);
    if (stageId === "compare") return apartmentCompareGate(msg);
    if (stageId === "stress_test") return apartmentStressGate(msg);
    if (stageId === "decide") return apartmentDecideGate(msg);
  }
  if (sceneId === "brand-naming-sprint") {
    if (stageId === "brief") return briefGate(msg, signals);
    if (stageId === "criteria") return brandCriteriaGate(msg);
    if (stageId === "ideate") return brandIdeateGate(msg);
    if (stageId === "cluster") return brandClusterGate(msg);
    if (stageId === "stress_test") return brandStressGate(msg);
    if (stageId === "finalize") return brandFinalizeGate(msg);
  }
  return false;
}

function apartmentSceneComplete(msg: string, completionRequested: boolean): boolean {
  if (!completionRequested) return false;
  return apartmentDecideGate(msg) || msg.includes("完成当前场景");
}

function brandSceneComplete(msg: string, completionRequested: boolean): boolean {
  if (!completionRequested) return false;
  return brandFinalizeGate(msg) || msg.includes("完成当前场景");
}

/**
 * Deterministic stage advancement from user evidence (not message length alone).
 */
export function computeStageTransition(input: {
  scene: SceneBlueprint;
  currentStageId: string;
  userMessage: string;
  signals: RuleSignal[];
  completionRequested: boolean;
}): { nextStageId: string; sceneCompleted: boolean; gateMet: boolean; confidence: number } {
  const { scene, currentStageId, userMessage, signals, completionRequested } = input;
  const order = stageOrder(scene);
  const idx = order.indexOf(currentStageId);
  if (idx < 0) {
    return { nextStageId: currentStageId, sceneCompleted: false, gateMet: false, confidence: 0.2 };
  }

  /** 用户显式发送完成信号：在后半段场景允许结束（与交付物按钮配合，不靠长度）。 */
  if (completionRequested && scene.id === "apartment-tradeoff") {
    /** 对比阶段已产出足够内容时，允许用完成信号结束本场景（不强制先推到 stress/decide）。 */
    const apartmentLate = new Set(["compare", "stress_test", "decide"]);
    if (apartmentLate.has(currentStageId)) {
      return { nextStageId: currentStageId, sceneCompleted: true, gateMet: true, confidence: 0.88 };
    }
  }
  if (completionRequested && scene.id === "brand-naming-sprint") {
    /** 命名任务在后半段即可用完成信号收尾（避免必须机械推进到 finalize）。 */
    const brandLate = new Set(["brief", "criteria", "ideate", "cluster", "stress_test", "finalize"]);
    if (brandLate.has(currentStageId)) {
      return { nextStageId: currentStageId, sceneCompleted: true, gateMet: true, confidence: 0.88 };
    }
  }

  const msg = userMessage;
  const gateMet = gateForStage(scene.id, currentStageId, msg, signals);

  const lastStageId = order[order.length - 1];
  if (currentStageId === lastStageId) {
    const completed =
      scene.id === "apartment-tradeoff"
        ? apartmentSceneComplete(msg, completionRequested)
        : scene.id === "brand-naming-sprint"
          ? brandSceneComplete(msg, completionRequested)
          : false;
    return {
      nextStageId: currentStageId,
      sceneCompleted: completed,
      gateMet: completed,
      confidence: completed ? 0.9 : 0.35,
    };
  }

  if (gateMet && idx < order.length - 1) {
    return {
      nextStageId: order[idx + 1]!,
      sceneCompleted: false,
      gateMet: true,
      confidence: 0.82,
    };
  }

  return {
    nextStageId: currentStageId,
    sceneCompleted: false,
    gateMet: gateMet,
    confidence: gateMet ? 0.5 : 0.35,
  };
}
