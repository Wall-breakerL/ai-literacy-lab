/**
 * 版本号与全局配置。五维 legacy rubric 已移除；评分见 v2：`lib/assessment-v2/weights.ts`。
 */
export const VERSION = {
  rubricVersion: "1.0",
  rubricVersionV2: "2.0",
  scenarioVersion: "1.0",
  eventSchemaVersion: "1.0",
  eventSchemaVersionV2: "2.0",
  judgePromptVersion: "1.0",
  memorySchemaVersion: "1.0",
} as const;
