# Human-AI Performance Lab

> 通过轻量访谈、两部分定制问卷和报告反馈，测量你与 AI 协作的习惯与风格。

## 是什么

一个基于“访谈 + 两部分定制问卷 + 报告 + 反馈”的 AI-MBTI 测评系统。用户先与单一 researcher agent 进行轻量背景访谈，系统收集职业/身份、AI 使用背景与当前目标；随后进入 Phase 6 的 24 题问卷流程：第一部分 8 题、第二部分 16 题，中间穿插一轮轻量校准对话。用户作答后，服务端确定性计算四维得分，LLM 只负责生成个性化解释、建议和 prompt 模板。

测评的核心不是隐藏评估，而是让题目贴近用户真实场景。

## AI-MBTI 四个维度

| 维度 | A 端（0%） | B 端（100%） |
|------|-----------|------------|
| **Relation** 关系定位 | Instrumental 工具型 | Collaborative 伙伴型 |
| **Workflow** 工作流程 | Framed 框架型 | Exploratory 探索型 |
| **Epistemic** 认知态度 | Auditing 审计型 | Trusting 信任型 |
| **RepairScope** 修复范围 | Global 全局重评 | Local 局部调整 |

每个维度输出 0–100% 的连续分值，混杂信号取中间值。

## 系统架构

```
用户 ←→ Researcher（访谈 / 状态更新 / 批次问卷 / 中途校准）
              ↓
        服务端确定性计分
              ↓
        Report / Feedback agents
```

- AI-MBTI 当前是单 researcher flow，不再是运行时 Agent A / Agent B 双代理编排。
- 初始访谈保持轻量：先问职业或身份，再追问主要 AI 使用场景；约 2 轮后进入问卷。
- Phase 6 问卷固定为 24 题：`hybrid_batch1` 为 8 题（4 道习惯题 + 4 道场景题），`hybrid_batch2` 为 16 题（8 道习惯题 + 8 道场景题）。
- 第一部分后有一轮 mid-dialogue，用于确认题目感受、跳过原因和第二部分的真实场景方向。
- 计分由 TypeScript 服务端完成；LLM 不计算分数。
- AI-HQ v0.1 已归档，相关页面和代码保留但不继续扩展。

旧版 16/20 单问卷、`CLAUDE_AGENT_A_MODEL` / `CLAUDE_AGENT_B_MODEL`、Agent A/B 文档属于 legacy compatibility。当前 v6.0 主链路以 researcher、批次问卷和 `CLAUDE_RESEARCHER_*` 环境变量为准。

## 技术栈

- **框架**：Next.js 14 + TypeScript
- **样式**：Tailwind CSS + Framer Motion
- **图表**：Recharts
- **AI**：Claude（Anthropic Messages API 或 OpenAI-compatible gateway）
- **设计系统**：Raycast 风格暗色主题

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.local.example .env.local
# 填入 OPENAI_COMPATIBLE_API_KEY，或改用原生 Anthropic 配置

# 启动开发服务器
npm run dev
```

访问 `http://localhost:3000`

## 自动化测试

开发服务器启动后，可以运行：

```bash
npm run test:browser
```

这个命令会打开 `/test-lab`，在浏览器中展示核心逻辑测试结果，并读取页面内的结构化测试摘要确认全部通过。当前 `/test-lab` 主页面只运行 AI-MBTI self-tests。覆盖包括：1-6 计分、跳过题不计分、Phase 6 24 题计分与 confidence、两部分 fallback 合法性、hybrid 批次泛场景拒绝、题干去重检测、`batchAnswers` 报告兜底、中途对话可见文案过滤、四维补齐、16 型配置、Phase 5 可携带产物、题面合成、目标上下文兜底。

AI-HQ v0.1 已归档，页面上标记为 skipped。这里没有声明 API 级端到端测试；当前验证是本地 self-tests 与浏览器 smoke。

如果开发服务器已经启动，还可以运行 Phase 6/7 API smoke：

```bash
npm run smoke:phase6-phase7
```

该脚本会调用中途对话开场、两部分问卷生成、报告 `batchAnswers` 入口和反馈保存接口。默认不调用反馈 LLM 对话；需要真实 LLM smoke 时设置 `RUN_LLM_SMOKE=1`。如果 Notion 已配置，反馈 smoke 会写入真实 Notion；否则写入 `.local-debug/feedback/`。

## 环境变量

```env
LLM_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=http://your-openai-compatible-host/v1
OPENAI_COMPATIBLE_API_KEY=your_api_key
# Some OpenAI-compatible Claude gateways require temperature=1.
OPENAI_COMPATIBLE_FORCE_TEMPERATURE=

# Native Anthropic provider alternative:
# LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
ANTHROPIC_VERSION=2023-06-01

CLAUDE_RESEARCHER_MODEL=claude-opus-4-6
CLAUDE_RESEARCHER_FALLBACK_MODEL=claude-opus-4-6
CLAUDE_RESEARCHER_MAX_TOKENS=8192
ENABLE_PROMPT_CACHE=1

# Legacy / archived paths only:
CLAUDE_AGENT_A_MODEL=claude-opus-4-6
CLAUDE_AGENT_B_MODEL=claude-opus-4-6
```

`CLAUDE_AGENT_A_MODEL` / `CLAUDE_AGENT_B_MODEL` 仍可作为 legacy fallback 或归档 AI-HQ 路径配置，但 AI-MBTI 主流程不再依赖 Agent A/B 分工。

Phase 7 反馈存储：

```env
NOTION_API_KEY=
NOTION_FEEDBACK_DATABASE_ID=777147e1-3401-4f4b-98dc-bc14fce6a127
NOTION_FEEDBACK_DATA_SOURCE_ID=
NOTION_VERSION=2026-03-11
```

如果 Notion key 或 data source id 缺失，`POST /api/feedback` 会写入 `.local-debug/feedback/`。

如果 LLM API 无法跑通，先运行：

```bash
npm run check:llm
```

这个命令会读取 `.env.local`，检查当前 provider 的模型列表和最小聊天请求是否可访问，并只输出脱敏后的配置与上游错误。脚本默认不会覆盖 shell 中已经设置的环境变量；如需用 `.env.local` 强制覆盖，设置 `OVERRIDE_ENV_FILE=1`。OpenAI-compatible provider 会调用 `/chat/completions`；原生 Anthropic provider 会调用 `/messages`。部分镜像站不支持 `/models`，这类检查默认只告警；设置 `STRICT_MODELS_CHECK=1` 可将其改为失败。

如果要验证当前网关是否支持下一阶段的 tool use，可以运行：

```bash
npm run check:llm-tools
```

该命令会强制模型调用一个小型测试工具，并只输出返回结构摘要，不输出 API key。

## 本地调试日志

开发环境下，访谈调试记录会写入 `.local-debug/interview-runs/`，反馈 fallback 会写入 `.local-debug/feedback/`。这些文件可能包含用户原文、系统提示词、模型响应、报告上下文和反馈内容。目录已加入 `.gitignore`，不要提交到仓库，也不要把 API key 写入这些文件。

## 页面结构

```
/            首页
/interview      AI-MBTI 访谈 + 两部分问卷 + 中途校准页
/report         AI-MBTI 分析报告页
/hq-interview  AI-HQ 五段访谈页（archived）
/hq-report     AI-HQ 能力成熟度报告页（archived）
/test-lab      自动化测试结果页
/feedback-debug  Phase 7 反馈链路调试页
```

## 报告输出示例

```json
{
  "summary": "你是一位高效的工具型使用者，习惯先定框架再行动",
  "personality": {
    "code": "IFAL",
    "name": "建筑师",
    "tagline": "精心设计，严谨落地"
  },
  "tags": ["框架先行", "审计型", "局部调整"],
  "overallAdvice": "围绕你的目标，下一次可以先让 AI 反问你 3 个关键问题，再开始生成结果。",
  "promptTemplates": [
    {
      "title": "开始前反问模板",
      "useCase": "任务刚开始时",
      "prompt": "我想完成这个目标：... 请先问我 3 个会影响结果质量的问题，不要直接给最终答案。"
    }
  ],
  "dimensions": [
    {
      "dimension": "Relation",
      "score": 20,
      "tendency": "Instrumental",
      "evidence": ["我一般直接让它帮我写，写完我自己改"],
      "analysis": "..."
    }
  ]
}
```

问卷支持独立选项「不了解 / 没想好」。该选项不会作为第 7 档分数，而是跳过该题；当某个维度有效答案较少时，报告会标记为初步观察。
