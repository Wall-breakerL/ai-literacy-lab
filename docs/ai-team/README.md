# AI Team

这是 Human-AI Performance Lab 的本地 AI 项目组操作手册。

它定义的是“怎么让 Codex 按团队方式协作推进项目”，不是一个已经运行的多智能体平台。

## 从这里开始

1. 读 [charter.md](./charter.md)：理解核心团队、角色边界和当前项目原则。
2. 读 [workflow.md](./workflow.md)：了解每轮工作如何从任务输入走到验证和沉淀。
3. 读 [feedback-loop.md](./feedback-loop.md)：按用户反馈驱动研究、实施、自检和交付。
4. 用 [evaluation-rubric.md](./evaluation-rubric.md)：验收 AI-MBTI、AI-HQ、工程和报告质量。
5. 用 [prompt-registry.md](./prompt-registry.md)：登记 prompt 职责与变更原因。
6. 用 [decision-log.md](./decision-log.md)：沉淀产品和架构决策。

## 推荐启动方式

可以直接对 Codex 说：

- “开一轮 AI-MBTI 报告质量改进。”
- “让 AI 团队评审 AI-HQ 当前架构。”
- “实现无法回答选项，并检查全链路。”
- “做一轮 prompt registry 清理。”
- “检查文档和代码是否一致。”
- “根据我刚才的体验反馈，开一轮修复。”

## 当前团队形态

核心组：

- 项目主理人：用户。
- 总工程 / 产品架构：Codex 主线程，承担最高推理强度和最终整合。
- Explorer：只读调查代码和文档，可并行。
- Worker：在明确边界内实现，可并行但文件范围不能重叠。
- Reviewer：从产品质量和用户价值角度评审，通常由主线程或只读 Explorer 执行。

按需专家：

- Prompt Editor。
- Scoring Auditor。
- UI Builder。
- Test Runner。
- Doc Steward。

## 当前优先级

1. 保持 AI-MBTI 与 AI-HQ 快速可用。
2. 提升报告具体性、行动价值和证据感。
3. 保持 prompt、scoring、UI、README 和设计文档一致。
4. 等重复任务足够稳定后，再考虑脚本化或平台化。
