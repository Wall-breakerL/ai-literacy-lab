# API 参考

## Chat 对话

### `POST /api/chat`

发送用户消息，获取 AI 助手回复。

**请求体：**
```typescript
{
  messages: ChatMessage[];          // 至今所有对话（含刚发的用户消息）
  scenarioId: string;
  identityId?: string;
  phase?: "helper" | "talk";        // 两段式蓝图时传入当前 phase
  talkPrompt?: string;              // phase=talk 时传入用户自定义话题
}
```

**响应：**
```typescript
{
  content: string;       // AI 回复内容
  thinking?: string;     // 思考过程（如有）
}
```

---

## 提交评测

### `POST /api/evaluate`

提交对话会话，获取评分结果。

**请求体：**
```typescript
{
  sessionId: string;
  scenarioId: string;
  messages: ChatMessage[];
  identityId?: string;
  userId?: string;
  includeRawJudge?: boolean;   // 是否在响应中包含原始 Judge 输出（调试用）
  talkPrompt?: string;         // 两段式时传入
}
```

**响应：**
```typescript
{
  sessionId: string;
  scenarioId: string;
  rubricVersion: string;
  scenarioVersion: string;
  blueprintVersion: string;
  eventSchemaVersion: string;
  memorySchemaVersion: string;
  judgePromptVersion: string;
  judgeModel: string;
  scoredAt: string;
  totalScore: number;           // 加权总分 0–100
  dimensions: Record<V2DimensionKey, V2DimResult>;
  phaseScores?: PhaseScores;    // 两段式蓝图时有
  events: EvalEventRecordV2[];
  phaseSwitchTurn?: number;
  blindSpots: string[];
  nextRecommendedScenarios: string[];
  nextRecommendedProbes: string[];
  rawJudge?: JudgeOutputV2;     // includeRawJudge=true 时有
}
```

---

## 身份

### `POST /api/identity`

创建身份 dossier 并持久化。

**请求体：**
```typescript
{
  source: IdentitySource;
  rawPrompt?: string;
  structuredSummary?: IdentityStructuredSummary;
}
```

**响应：**
```typescript
{
  identityId: string;
  version: string;
  createdAt: string;
}
```

### `GET /api/identity`

获取指定身份 dossier。
查询参数：`id={identityId}`

---

## 场景

### `GET /api/scenarios/[scenarioId]`

获取场景蓝图。

**响应：**
```typescript
{
  kind: "blueprint";
  blueprint: ScenarioBlueprint;
}
```
命中返回蓝图，否则 404。

---

### `POST /api/scenario-select`

场景匹配/生成入口。

**请求体：**
```typescript
{
  prompt?: string;    // 用户任务 prompt（可选）
  userId?: string;
}
```

**响应：**
```typescript
{
  source: "matched" | "generated_candidate" | "default";
  scenarioId: string;
  scenario?: ScenarioBlueprint;   // source=matched/default 时有
}
```

**逻辑：**
1. 有 prompt 且命中库场景 → 返回 `matched`
2. 有 prompt 但不命中 → 生成候选场景（写入 `data/runtime/scenario-candidates/`）→ 返回 `generated_candidate`
3. 无 prompt 或生成失败 → 返回默认入口场景

---

## 候选场景审核

### `GET /api/scenario-candidates`

列出所有候选场景。

**响应：**
```typescript
{
  candidates: Array<{
    scenarioId: string;
    pack: string;
    family: string;
    generatedFrom?: string;   // 生成时用的 prompt
    createdAt: string;
    promoted: boolean;
  }>;
}
```

---

### `POST /api/scenario-candidates/promote`

将候选场景发布到正式库。

**请求体：**
```typescript
{
  scenarioId: string;
}
```

**响应：**
```typescript
{
  success: true;
  scenarioId: string;
}
```

---

## 记忆

### `GET /api/memory`

读取记忆数据。

**查询参数：**
- `type=user&id={userId}` → UserMemoryCard
- `type=experience&id={sessionId}` → ExperienceCard

**响应：**
```typescript
{
  kind: "user" | "experience";
  data: UserMemoryCard | ExperienceCard;
}
```

---

## 内部类型速查

```typescript
type ChatMessage = { role: "user" | "assistant"; content: string };

type V2DimensionKey =
  | "taskFraming" | "dialogSteering" | "evidenceSeeking"
  | "modelMentalModel" | "failureAwareness"
  | "trustBoundaryCalibration" | "reflectiveTransfer";

type V2DimResult = { score: number; max: number; evidence: string[]; reason: string };

type EvalEventRecordV2 = {
  event: EvalEventV2;
  turnIndex?: number;
  phase?: "helper" | "talk" | "debrief";
};
```
