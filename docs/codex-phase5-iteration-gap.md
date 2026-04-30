# Codex Phase 5 工作目标（优化版）

> 本阶段排在 Phase 4 完成之后。目标：让报告从"文字堆砌"变成"可携带产物"，但**不假装有使用数据**。

## 0. 与原 Phase 5 设计的核心差异

原设计借鉴 Claude Code Insights，但忽略了一个根本问题：**Claude Code Insights 基于真实使用数据（消息数、工具调用、错误率），而 AI-MBTI 只有访谈+问卷，没有用户实际使用 AI 的行为数据**。

因此本优化版：
- **删除**："做对了什么" / "容易卡住的地方"（需要使用数据）
- **删除**："On the Horizon" 的 6-12 个月预测（没有数据支撑会很空洞）
- **删除**：报告拆 core/extras 两次调用（增加复杂度，收益不明确）
- **保留并强化**："我的 AI 协作宣言"（核心可携带产物）
- **保留并强化**：Prompt 模板质量，但收敛为 1-2 条高质量模板
- **简化**：At a Glance 只做风格总结，不做"做对/卡住"判断
- **简化**：横向 TOC + 折叠交互（纯 UI 改进）
- **保留**：Fun ending（轻松收束）

---

## Phase 5：报告页核心可携带产物升级

### 产品动机

当前 `/report` 页面问题：
- 用户看完报告后**能带走的东西太少**：只有几个 prompt 模板，没有长期生效的配置
- 报告结构单调：一段总览 + 四张维度卡 + 一段建议，缺少"先看摘要再下钻"的层次感
- 报告结尾突兀，缺少产品感

核心目标：**让用户离开报告页时，至少能带走一段适合作为 ChatGPT/Claude/Cursor 长期协作偏好配置的个人化系统提示词**。

### 验收标准

- 报告页顶部新增 "Your AI Collaboration Style"（风格速览）卡片，3 段固定结构
- 报告页加横向 TOC 条，至少 5 个锚点章节
- 增加 "我的 AI 协作宣言"模块：模型目标 100-200 字，服务端容忍 100-220 字的长期协作偏好文本
- 整体提供 1-2 条可直接使用的 prompt 模板，以文本形式展示，不提供 Copy 按钮
- 报告底部增加 "Your Collaboration Signature"（协作签名）模块：一句结合人格 code 的轻松总结
- 长内容章节默认折叠，减少首屏压力
- 每个维度卡显式标注 confidence 来源：「基于 N 道有效回答」

### 关键改动点

**1. 报告数据结构扩展**

`src/lib/types.ts` 中 `FinalReport` 增加：

```ts
export interface FinalReport {
  // ...原字段
  styleOverview?: {
    corePattern: string;        // 你的核心协作模式（模型目标 60-80 字；服务端容忍约 24-130 字）
    strengthArea: string;       // 你最擅长的场景（模型目标 60-80 字；服务端容忍约 24-130 字）
    growthDirection: string;    // 下一步可以尝试的方向（模型目标 60-80 字；服务端容忍约 24-130 字）
  };
  collaborationManifesto?: string;          // 个人化系统提示词文本（模型目标 100-200 字；服务端容忍 100-220 字）
  collaborationSignature?: {
    headline: string;           // 一句话协作签名
    detail: string;             // 解释（模型目标 60-80 字；服务端容忍约 40-110 字）
  };
  promptTemplates: PromptTemplate[];        // 已存在，收敛为 1-2 条高质量模板
}
```

**2. RESEARCHER_REPORT_SYSTEM 升级**

在 `src/lib/researcher.ts` 的 `RESEARCHER_REPORT_SYSTEM` 中增加三个新字段的生成要求：

- `styleOverview`：基于四维分数的整体风格总结，**不要提"做对了什么/卡在哪里"**（因为没有使用数据），只描述风格特点
- `collaborationManifesto`：模型目标 100-200 字第一人称系统提示词，可作为 ChatGPT/Claude/Cursor 的长期协作偏好配置；服务端质量检查容忍 100-220 字，避免近似合格文本被过度丢弃
- `collaborationSignature`：一句话 + 一段解释，轻松收束

**单次生成，不拆分**：保持原有的单次 LLM 调用生成完整报告，不拆 core/extras。

**3. Style Overview 卡片（替代原 At a Glance）**

`/report` 顶部第一屏：

- 3 个固定段落：
  - **你的核心协作模式**：综合四维，用一句话描述（如"框架先行的审计型使用者"）
  - **你最擅长的场景**：基于最高分维度 + targetContext（如"在明确目标的科研写作任务中，你能高效驾驭 AI"）
  - **下一步可以尝试**：基于当前画像给出 1 个具体建议（如"试试在任务开始前让 AI 反问你 2 个问题"）
- 每段模型目标 60-80 字，服务端质量检查容忍约 24-130 字，**不要提"做对了什么/容易卡住"**（那需要使用数据）
- 视觉上用暖色 gradient 卡片（Raycast 暗色主题下用 `from-raycast-red/15 to-raycast-yellow/10`）

**4. TOC 横向导航**

紧接 Style Overview 下方放一行扁平 chip：

- 风格速览 / 我的画像 / 四维解析 / Prompt 模板 / 我的协作宣言 / 协作签名
- chip 点击平滑滚到对应锚点
- 移动端可横向滚动

**5. Prompt 模板（精简版）**

- 整体 promptTemplates 章节提供 1-2 条高质量 prompt
- 基于用户最突出的 1-2 个维度特征 + targetContext 生成
- 例如 Workflow=Framed + Epistemic=Auditing 高分用户：
  ```
  我想完成 [具体任务]。请先用 1 句话复述目标，列出 3 步计划，并在每步标注「需要我核实的部分」。
  ```
- 每条 prompt 以纯文本代码块展示，不提供 Copy 按钮；用户需要时可自行选中文本
- 每条带"使用场景"标签：刚开始任务时 / 卡住时

**6. "我的 AI 协作宣言"模块（核心可携带产物）**

新增独立板块。模型基于人格 code + targetContext 生成目标 100-200 字的"个人化系统提示词"，服务端容忍 100-220 字，可作为 ChatGPT / Claude / Cursor 的 custom instructions / system prompt 内容。

例如对 IFAL（细节修补师）医生用户：

```
我是一名医生，主要用 AI 做科研写作和文献综述。
我习惯先给你具体的任务和约束，再让你执行。
请你在生成长文本前，先用 1 句话复述你理解的目标，然后给我 3 步写作计划。
我会偏好局部修改而不是大段重写——如果某段需要调整，请只改那一段并标注理由，不要顺手重组其他部分。
我倾向于审计你的输出，欢迎你在不确定的地方主动标注「需要核实」或给出参考来源。
```

页面上以普通文本展示，不提供 Copy 按钮；辅助说明只描述它适合作为长期协作偏好配置。

**Prompt 要求**：
- 第一人称口吻
- 必须包含用户的 role 和 targetContext
- 必须包含至少 2 个基于四维分数的具体偏好（如"我习惯先定框架"、"我倾向于局部修改"）
- 不要用"我应该"句式，用"我习惯" / "请你" / "我倾向于"
- 模型输出目标控制在 100-200 字；服务端校验容忍到 220 字，避免近似合格文本被无谓替换

**7. Collaboration Signature（协作签名，替代原 Fun ending）**

报告最后一屏放一个暖色 gradient 卡片：

- **headline**：一句话协作签名（如"细节修补师：永远在调最后一个分号"）
- **detail**：一段解释，模型目标 60-80 字，服务端容忍约 40-110 字（如"16 道题里你最确定的答案，全部和'局部修改'有关。这就是你的协作签名。"）

**不要让 LLM 每次生成 headline**，容易翻车。改为：
- 准备 16 套固定 headline（每个人格 code 一套），存在 `src/lib/personalityProfiles.ts` 的 `PersonalityProfile` 中
- detail 由 LLM 基于用户最强的 1-2 条 evidence 生成

**8. 折叠交互**

- 维度卡的 analysis 长文默认折叠，标题点击展开
- 移动端用 `<details>` 标签原生实现，桌面端可加 framer-motion 平滑展开动画

**9. Confidence 标注**

每个维度卡显式标注：
- 「基于 4 道有效回答」（高信心）
- 「基于 2 道有效回答，初步观察」（低信心）
- 如果走完 Phase 4 recovery 流程：「基于两轮共 6 道有效回答」

### 与 Phase 4 的依赖关系

- 可以独立于 Phase 4 实施（Phase 5 不依赖 Phase 4 的 recovery 机制）
- 如果 Phase 4 已完成，Style Overview 的"下一步可以尝试"段要能识别 recovery 流程并调整文案

### Prompt 设计要点

在 `RESEARCHER_REPORT_SYSTEM` 中增加以下要求：

**styleOverview 生成要求**：
- corePattern：综合四维，一句话（如"框架先行的审计型使用者"）
- strengthArea：基于最高分维度 + targetContext，不要泛泛而谈（如"在明确目标的科研写作任务中"而不是"在使用 AI 时"）
- growthDirection：给 1 个具体建议，必须可操作（如"试试在任务开始前让 AI 反问你 2 个问题"而不是"可以更信任 AI"）
- **禁止提及**："你做对了什么" / "你容易卡在哪里" / "你的使用习惯" / "你常犯的错误"（这些需要使用数据）

**collaborationManifesto 生成要求**：
- 第一人称，模型目标 100-200 字；服务端校验容忍 100-220 字
- 必须包含：role + targetContext + 至少 2 个基于四维分数的具体偏好
- 句式：「我习惯...」「请你...」「我倾向于...」「欢迎你...」
- 禁止句式：「我应该...」「我需要...」（太命令式）
- 可直接使用，不要有占位符（如 `[你的目标]`）

**promptTemplates 生成要求**：
- 只生成 1-2 条，不要贪多
- 必须基于用户最突出的维度特征（分数最高或最低的 1-2 个维度）
- 必须结合 targetContext，不要泛泛而谈
- 可直接使用，不要有占位符
- 每条 prompt 长度控制在 50-100 字

**collaborationSignature.detail 生成要求**：
- 模型目标 60-80 字；服务端校验容忍约 40-110 字
- 必须引用用户最强的 1-2 条 evidence（来自 sessionState.evidence 或问卷题面）
- 轻松但不油腻，避免"你就是 AI 世界的艺术家"这种过度修辞

### 可能踩的坑

**1. collaborationManifesto 质量不稳定**
- 模型可能写得太空洞（"我喜欢和 AI 协作"）或太啰嗦（超过 200 字）
- **防护**：服务端检查长度（100-220 字容忍范围）、上下文包含情况、第一人称/请你句式、禁用句式和维度关键词（如"框架" / "局部" / "审计"）
- 如果检查不通过，用固定模板兜底：
  ```
  我是一名 {role}，主要用 AI 做 {recentUse}。
  我习惯 {基于最高分维度的偏好}。
  请你 {基于次高分维度的建议}。
  ```

**2. styleOverview.growthDirection 变成空话**
- 模型可能写"可以更多地信任 AI"这种不可操作的建议
- **防护**：prompt 里要求"必须是用户下一次使用 AI 时能立刻试的具体做法，不要抽象建议"
- 当前服务端不重新生成，而是用本地 fallback 替换不合格的 styleOverview；长度校验采用约 24-130 字的容忍范围，同时检查 growthDirection 是否包含"试试" / "下次" / "可以" / "让 AI"等行动词

**3. promptTemplates / recommendations / overallAdvice 质量漂移**
- 当前实现主要通过 tool schema、report prompt 和页面文本展示约束这些字段，没有像 manifesto / styleOverview / signature 那样做强运行时质量校验。
- **判断**：这不是 Phase 5 当前阻断项。Phase 5 的核心可携带产物是 manifesto，promptTemplates 是辅助价值；在没有真实样本显示它们频繁变空或变泛之前，不建议增加复杂校验。
- **后续触发条件**：如果用户反馈 prompt 模板空泛、不可直接使用或缺少 targetContext，再把 `promptTemplates` 质量校验列入 Phase 5 hardening。

**4. collaborationSignature.headline 固定文案可能不够个性化**
- 16 套固定文案可能让用户觉得"套路"
- **权衡**：固定文案保证质量下限，detail 由 LLM 生成保证个性化
- **如果未来要优化**：可以让 LLM 生成 headline，但必须有人工审核机制（至少在上线初期）

**5. Token 成本增加**
- Phase 5 新增输出约 500-600 字（styleOverview 240 + manifesto 150 + signature 80 + promptTemplates 100）
- 相比原报告增加约 25-30% 输出 token
- **可接受**：因为没有拆 core/extras，只是单次调用输出更多，且 system prompt 走了 caching（来自 Phase 4 G2）

### 落地节奏

| 步骤 | 工作 | 预估 |
|------|------|------|
| 5.1 | FinalReport 类型扩展（styleOverview / manifesto / signature） | 0.5 天 |
| 5.2 | RESEARCHER_REPORT_SYSTEM 升级（新增三字段生成要求 + 质量约束） | 1 天 |
| 5.3 | PersonalityProfile 增加 16 套 signature headline | 0.5 天 |
| 5.4 | `/report` 增加 Style Overview 卡片 + TOC | 1 天 |
| 5.5 | promptTemplates 精简版（1-2 条高质量）+ 文本展示 | 0.3 天 |
| 5.6 | 我的 AI 协作宣言模块（独立板块 + 长期协作偏好说明） | 0.5 天 |
| 5.7 | Collaboration Signature 模块 + 折叠交互 | 0.5 天 |
| 5.8 | 服务端质量检查（manifesto 容忍长度 + 上下文/关键词 + growthDirection 可操作性） | 0.5 天 |
| 5.9 | `/test-lab` 新增 case（styleOverview 字段齐全 / manifesto 长度合理 / signature headline 匹配 code） | 0.5 天 |

总计约 5.3 天。

### 验收必跑

```bash
npm run typecheck
npm run lint
npm run check:llm
npm run test:browser
```

并手动跑：

1. 完成一次完整 16 题问卷 → 报告顶部出现 Style Overview 3 段、TOC 6 个 chip 可点击跳转
2. 维度卡可折叠展开；报告中有 1-2 条 prompt 模板（基于最突出的维度特征）
3. 我的 AI 协作宣言模块出现一段目标 100-200 字、服务端容忍 100-220 字的第一人称指令，包含 role + targetContext + 至少 2 个具体偏好，以普通文本展示
4. Collaboration Signature 卡片出现，headline 与人格 code 匹配（如 IFAL → "细节修补师：..."），detail 引用了具体 evidence
5. 走完 Phase 4 recovery 流程后，维度卡 confidence 标注显示"基于两轮共 N 道有效回答"

### 上线后观察指标

- **manifesto 质量兜底率**：多少份报告触发了质量检查兜底（如果 > 20%，说明 prompt 需要优化）
- **报告完成率**：用户从进入 `/report` 到滚动到底部的比例（折叠交互是否有效降低了首屏压力）
- **Prompt 模板主观有用度**：用户反馈哪些模板空泛、难用或缺少场景绑定（指导后续 prompt 设计）

---

## 与原 Phase 5 设计的对比

| 功能 | 原设计 | 优化版 | 理由 |
|------|--------|--------|------|
| At a Glance | 4 段（strengths / frictions / quickWin / horizon） | 3 段（corePattern / strengthArea / growthDirection） | 删除 frictions（需要使用数据） |
| "做对了什么" / "容易卡住" | 独立章节 | **删除** | 需要使用数据，问卷数据不足以支撑 |
| On the Horizon | 3 张卡片，6-12 个月预测 | **删除** | 没有使用数据，预测会很空洞 |
| 我的 AI 协作宣言 | 有 | **保留并强化** | 核心可携带产物，不需要使用数据 |
| Collaboration Signature | Fun ending（LLM 每次生成） | **改为固定 headline + LLM 生成 detail** | 降低翻车风险 |
| 报告生成 | 拆 core/extras 两次调用 | **单次调用** | 降低复杂度，避免不一致 |
| promptTemplates | 每维度至少 1 条（4-5 条） | **精简为 1-2 条** | 质量优于数量 |
| 折叠交互 + TOC | 有 | **保留** | 纯 UI 改进，与数据无关 |

---

如果 Phase 5 实现过程中发现 manifesto 或 signature 的 LLM 生成质量始终不稳定，优先保证 manifesto 的质量（它是核心可携带产物），signature 可以降级为纯固定文案。
