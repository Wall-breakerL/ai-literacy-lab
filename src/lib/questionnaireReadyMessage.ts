import type { QuestionnaireBatchKey, QuestionnaireBatchMode } from "@/lib/types";

/** 与 `/api/questionnaire/generate` 及前端 fallback 对齐的固定就绪文案 */
export function questionnaireReadyMessageForBatchKey(batchKey: QuestionnaireBatchKey): string {
  const label = batchKey === "batch1" ? "第一部分问卷" : "第二部分问卷";
  return `${label}已经准备好。点击按钮即可进入作答；若有题目不贴近你的情况，可以选择「不了解 / 没想好」。`;
}

export function questionnaireReadyMessageForBatchMode(batchMode: QuestionnaireBatchMode): string {
  const key: QuestionnaireBatchKey = batchMode === "hybrid_batch1" ? "batch1" : "batch2";
  return questionnaireReadyMessageForBatchKey(key);
}
