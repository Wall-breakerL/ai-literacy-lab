# AI 交互素养评估 — 项目概览

## 项目定位

本项目不叫「Prompt 打分器」，而叫：**AI 交互素养评估原型**。

核心目标：在自然、轻松的任务对话中，评估用户与 Agent 协作解决问题的能力（有效、批判、负责地参与 AI 系统）。

## 研究问题

1. AI 素养能否被操作化为「自然对话中的 Agent 协作能力」？
2. 能否通过「身份 + 叙事场景（蓝图）」提升评估的真实感，同时保持统一的核心 rubric？

## 技术版本

当前版本：**v2.0.0**（2026-03-23）

| 模块 | 版本 | 说明 |
|------|------|------|
| 蓝图 Schema | v2.0 | 两段式 helper→talk |
| 评分体系 | Rubric v2 | 两层七维 |
| 事件 Schema | v2.0 | 含 phase 标签 |
| 记忆 Schema | v1.0 | Session / User / Experience |

---

## 完整评测流程

```
首页 (/)
    ↓
Setup (/setup) — 填身份 Prompt，系统自动提取为结构化维度
    ↓ POST /api/identity
    ↓ redirect /select-scenario?identityId=xxx
Select-Scenario (/select-scenario) — 填场景需求（可选）
    ↓ POST /api/scenario-select → 匹配/生成场景
    ↓ redirect /chat/{scenarioId}?identityId=xxx&userId=xxx
Phase 1: Helper — AI 协作任务
    ↓ 满足 minPhase1UserTurns 后可切换
Phase 2: Talk — 深度讨论（可选自定义话题）
    ↓
Debrief — 3 个收尾反思问题
    ↓
提交评分 → 结果页 (/result)
```

---

## 项目结构

```
ai-literacy-lab/
├── app/
│   ├── page.tsx              # 首页
│   ├── setup/                # 身份与入场（填身份 Prompt）
│   ├── select-scenario/      # 场景选择（填场景 Prompt）
│   ├── chat/[scenarioId]/    # 聊天对话页
│   ├── result/               # 结果展示页
│   └── api/                  # API 路由
├── lib/
│   ├── scenario-v2/           # 场景引擎（蓝图加载、路由、匹配、生成）
│   ├── identity/              # 身份编译（含 LLM 提取为结构化维度）
│   ├── assessment-v2/         # 评估引擎（事件提取、权重、类型）
│   ├── memory/                # 记忆层
│   ├── evaluation/            # 评测执行
│   ├── llm/                   # Chat + Judge 调用
│   └── storage/               # 文件持久化
├── data/
│   ├── scenario-blueprints/   # 正式场景蓝图
│   └── runtime/              # 运行时数据（gitignored）
└── docs/                      # 本文档目录
```

---

## 环境要求

- **Node.js** 18+
- **npm**（已配置国内镜像 `npmmirror.com`）
- 可选：`OPENAI_API_KEY` 或 `OPENAI_API_KEY` + `OPENAI_BASE_URL`（支持 OpenAI 兼容接口，包括 Minimax）
- 无 key 时全程使用内置 mock，可完整演示流程
