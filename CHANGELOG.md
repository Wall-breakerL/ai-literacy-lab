# Changelog

## [2.0.0] - 2026-03-23

### 功能与体验

- **场景匹配与生成**：全新 scenario-v2 系统，支持按任务 prompt 匹配库中场景，未命中则生成候选场景（需审核后发布）
- **两段式对话**：Helper（协作任务）→ Talk（深度讨论）两阶段评估流程，考察不同维度能力
- **用户记忆**：SessionMemory（会话恢复）、UserMemoryCard（长期画像）、ExperienceBank（匿名体验记录）
- **候选场景工作流**：生成 → 审核 → 发布完整流程，支持 `/api/scenario-candidates` 列表与发布 API
- **两层七维 Rubric v2**：协作行为层（Task Framing、Dialog Steering、Evidence Seeking）+ AI 理解能力层（Model Mental Model、Failure Awareness、Trust / Boundary Calibration、Reflective Transfer）

### 技术

- **移除 legacy**：删除 `data/scenarios/`、五维评测链（`run-evaluation.ts`、`lib/llm/judge.ts`、`judge-rule.ts`、`rule-corrector.ts` 等）；API 与聊天页仅支持 v2 蓝图；结果页仅展示 `kind: "v2"`，旧 sessionStorage 给出提示文案
- **两段式评分**：Helper 默认权重 55%、Talk 默认 45%，保留 phase 级别中间分供研究使用

## [1.1.0] - 2026-03-13

### 功能与体验

- **界面与文案**：统一设计 token（CSS 变量）、炫酷渐变背景与毛玻璃内容区；前端文案集中到 `lib/copy.ts`；Judge/Chat 提示词打磨，Chat 按 profile 微调用语。
- **评分**：权重调整为说清任务 40%、补足上下文 15%、推进对话 20%、判断结果 15%、守住边界 10%；基准上移（给分倾向 55–85、无证据上限 55）；Judge 改为 0–10 带一位小数输出，换算为 0–100 以提升细粒度；第五维名称改为「守住边界」。
- **评估**：暂仅使用 API Judge，未配置 Key 时直接报错；结果页展示各维度评分占比（权重百分比）。
- **部署**：新增 `docs/deploy-ecs.md`，支持在国内 ECS + 域名（如 ai-literacy.top）上部署，实现国内直连访问。

### 技术

- 规则 Judge 回退已关闭，等 memory 部分完成后再考虑启用。
- 结果页与规则校正中「守住边界并落地」统一为「守住边界」。
