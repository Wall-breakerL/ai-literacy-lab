# AI 交互素养评估原型

在轻松自然的任务对话中，评估用户与 Agent 协作解决问题的能力（有效、批判、负责地参与 AI 系统）。本项目是**素养评估原型**，不是「Prompt 打分器」。

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

**接入真实 API**：对话逻辑在 `lib/llm/chat.ts` 的 `callChatApi`，评测在 `lib/llm/judge.ts` 的 `callJudgeApi`。两处目前为占位（返回 null），你可在其中实现 `fetch` 或 SDK 调用，配置好 key 后即可生效。

**使用 Minimax**：Minimax 提供 OpenAI 兼容的 Chat Completions 接口。在 `.env.local` 中设置 `OPENAI_BASE_URL=https://api.minimaxi.com/v1`、`OPENAI_API_KEY=你的 Minimax Key`，并将 `OPENAI_CHAT_MODEL` / `OPENAI_JUDGE_MODEL` 设为 Minimax 模型名（如 `MiniMax-M2.5`、`MiniMax-M2.5-highspeed`）即可。参见 `.env.example` 底部示例。

## Demo 流程

1. 打开首页，点击「开始评估」。
2. 选择画像：**身份/使用场景**（学生 / 通用）、**AI 使用熟练度**（新手 / 有一定经验）。
3. 进入场景：系统按画像分配任务（如给导师写消息、选课/选方案等）。
4. 在聊天中与助手自然对话完成任务，可多轮输入。
5. 点击「结束并查看结果」：系统根据对话记录事件、按五维 rubric 评分并做规则校正。
6. 结果页展示总分、五维得分、证据与建议；可展开「关于本次评估」查看版本信息（rubricVersion、scenarioVersion、judgeModel、scoredAt 等）。

**无 API key 时**：助手为固定轮换的占位回复，评分为规则 Judge + 事件校正，全程可离线完成。

## 项目结构（概要）

- **docs/**：需求与规范（00 问题定位 ~ 05 版本与校准）。
- **data/scenarios/**：4 个场景 JSON（message_student / message_general / choice_student / choice_general）。
- **lib/**：类型、常量、场景路由与加载、事件识别、规则 Judge、规则校正、评估流水线。
- **app/**：首页、画像页、聊天页、结果页及 API（/api/chat、/api/evaluate）。

场景引擎、评估引擎与 UI 解耦，便于后续迁移或更换实现。
