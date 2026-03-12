# 场景系统设计：4 个场景说明

用「轻任务」让用户感觉在解决实际问题，系统在后台做轻量隐性评估。一期共 **4 个场景**，对应两个任务族 × 两种 profile（student / general）。

---

## 场景 1：message_student（规划出游 — 学生）

- **可见任务**：与导师或同学一起规划一次短途出游/旅行方案，说明时间、人数、偏好或预算等。
- **适用画像**：`role: "student"`。
- **隐藏探针**：ambiguity（是否说明时间/人数/偏好等约束）、revision（是否要求调整行程）、verification（是否核验信息或追问细节）、boundary（是否注意安全与边界）。

---

## 场景 2：message_general（规划旅行 — 通用）

- **可见任务**：规划一次旅行方案（如目的地、行程、预算等），说明需求与偏好。
- **适用画像**：`role: "general"`。
- **隐藏探针**：同上（ambiguity / revision / verification / boundary），按通用场景表述。

---

## 场景 3：choice_student（做选择 — 学生）

- **可见任务**：在若干选项中做选择（如选课、选学习工具、选项目方向等）。
- **适用画像**：`role: "student"`。
- **隐藏探针**：ambiguity（是否说明自己的约束/偏好）、revision（是否要求重新比较）、verification（是否核验信息源）、boundary（是否注意隐私或合规）。

---

## 场景 4：choice_general（做选择 — 通用）

- **可见任务**：在若干选项中做选择（如选方案、选工具、选出行方式等）。
- **适用画像**：`role: "general"`。
- **隐藏探针**：同上，表述按通用场景设计。

---

## 场景数据结构（供实现用）

```typescript
type Scenario = {
  id: string
  profileTags: Array<"student" | "general">
  visibleTask: string
  hiddenChecks: string[]
  hiddenProbes: Array<"ambiguity" | "revision" | "verification" | "boundary">
}
```

**hiddenProbes 含义**：ambiguity 补全模糊点；revision 要求改写；verification 追问核验；boundary 收敛敏感/边界。

---

## 场景如何配置（实现）

- **存放位置**：`data/scenarios/` 下每个场景一个 JSON 文件，如 `message_student.json`、`choice_general.json`。
- **字段**：与上面 `Scenario` 一致：`id`、`profileTags`、`visibleTask`、`hiddenChecks`、`hiddenProbes`。前端/聊天页只展示 `visibleTask`；Judge 和规则校正会用到 `hiddenChecks`（写进 prompt 或规则）。
- **加载方式**：聊天页通过 `GET /api/scenarios/[scenarioId]` 拉取当前场景；场景 ID 与文件名一致（如 `message_student`）。首页/选场景时用 `lib/constants.ts` 里的 `SCENARIO_IDS` 决定可选场景列表。
- **修改场景**：改对应 JSON 的 `visibleTask`、`hiddenChecks` 即可，无需改代码；若新增场景，需在 `SCENARIO_IDS` 和 `data/scenarios/` 下增加新 id 与新文件。
