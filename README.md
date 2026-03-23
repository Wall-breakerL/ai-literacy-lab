# AI 交互素养评估原型

在自然的任务对话中，评估用户与 Agent 协作解决问题的能力（有效、批判、负责地参与 AI 系统）。本项目是**素养评估原型**，不是「Prompt 打分器」。

## 安装与运行

```bash
# 在项目根目录执行
cd /path/to/ai-literacy-lab

# 安装依赖（必须，否则 next 命令找不到）
npm install

# 启动开发服务器（会占用当前终端，不要关闭）
npm run dev
```

**若 `npm install` 卡住**：项目已配置国内镜像（`.npmrc` 里 `registry=npmmirror.com`）。先按 `Ctrl+C` 停掉当前安装，执行 `npm cache clean --force` 后重新 `npm install`。若仍卡住，可手动指定镜像：`npm install --registry https://registry.npmmirror.com`。

终端里出现 **`✓ Ready`** 或 **`✓ Compiled`** 后，用浏览器打开 [http://localhost:3000](http://localhost:3000)。若本机访问不了可试 [http://127.0.0.1:3000](http://127.0.0.1:3000)。

**连不上 localhost:3000 时**：  
1. 确认是在**项目根目录**执行的 `npm run dev`，且执行过 `npm install`。  
2. 开发服务器会**一直占用当前终端**，不要关掉该终端窗口。  
3. 若 3000 端口被占用，可改用其他端口：`npx next dev -H 0.0.0.0 -p 3001`，然后访问 http://localhost:3001。

## 环境变量（可选）

见 **`.env.example`**。复制为 `.env.local` 后按需填写。

- **`OPENAI_API_KEY`**：若未配置，助手回复与评估均使用**内置 mock**，无需 key 即可完整跑通流程。
- **`OPENAI_BASE_URL`**、**`OPENAI_CHAT_MODEL`**、**`OPENAI_JUDGE_MODEL`**、**`OPENAI_JUDGE_API_KEY`**：可选，用于接入真实对话与 LLM Judge。

**接入真实 API**：对话在 `lib/llm/chat.ts` 的 `callChatApi`、评测在 `lib/llm/judge-v2.ts` 的 `callJudgeApiV2`，均通过 OpenAI 兼容 `fetch` 调用；未配置 key 或请求失败时对话回退 mock、评测回退规则 Judge v2（见 `lib/evaluation/run-evaluation-v2.ts`）。

**使用 Minimax**：Minimax 提供 OpenAI 兼容的 Chat Completions 接口。在 `.env.local` 中设置 `OPENAI_BASE_URL=https://api.minimaxi.com/v1`、`OPENAI_API_KEY=你的 Minimax Key`，并将 `OPENAI_CHAT_MODEL` / `OPENAI_JUDGE_MODEL` 设为 Minimax 模型名（如 `MiniMax-M2.5`、`MiniMax-M2.5-highspeed`）即可。参见 `.env.example` 底部示例。

## Demo 流程

1. 打开首页，点击「开始评估」进入 **`/setup`（身份与入场）**。
2. 粘贴被测者身份说明或填结构化表单后保存，或跳过（使用系统默认身份）；随后直接进入对话场景。
3. 自然开场对话（v2 场景蓝图）；与助手多轮协作。
4. 主对话结束后完成简短收尾问题（micro-debrief），再提交评分。
5. 结果页展示两层七维得分、证据、盲点与建议；可展开版本与研究者调试信息。

详见 `docs/09_identity_and_scenario_v2.md`、`docs/10_rubric_v2_two_layers.md`、`docs/11_memory_and_calibration.md`。

**无 API key 时**：助手为固定轮换的占位回复，评分为 `judge-rule-v2` + `rule-corrector-v2`，全程可离线完成。

## 项目结构（概要）

- **docs/**：需求与规范（含 v2：`09` 身份与场景、`10` 两层七维 rubric、`11` 记忆与离线校准）。
- **data/scenario-blueprints/**：v2 场景蓝图（唯一场景数据源；旧版 `data/scenarios/` 已移除）。
- **data/runtime/**：本地 file-json 持久化（体验卡、用户记忆，默认 gitignore）。
- **lib/**：`identity/`、`scenario-v2/`、`assessment-v2/`、`memory/`、`storage/`、评测与 LLM。
- **app/**：首页、setup、聊天、结果及 API（chat、evaluate、identity、memory、scenarios）。旧链 `/profile` 重定向到 `/setup`；结果页「再测一轮」直达默认场景对话（带 `userId` 与已保存的 `identityId`）。

场景引擎、评估引擎与 UI 解耦，便于后续迁移或更换实现。
