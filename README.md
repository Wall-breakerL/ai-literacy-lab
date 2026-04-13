# Human-AI Performance Lab

> 通过自然对话，测量你与 AI 协作的习惯与风格。

## 是什么

一个基于双 Agent 架构的 AI-MBTI 访谈系统。用户与 Agent A（访谈官）进行轻松对话，Agent B 在幕后实时分析信号、指导提问方向，最终生成个性化的 AI 协作风格报告。

用户不会感知到测量过程——这是设计的一部分。

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
用户 ←→ Agent A（访谈官，自然对话）
              ↕ 实时指令
         Agent B（幕后分析，不可见）
```

- Agent A 负责对话，根据 Agent B 的指令决定下一个问题
- Agent B 负责信号提取、维度覆盖判断、生成最终报告
- 对话最多 8 轮，4 个维度全覆盖后提前结束

## 技术栈

- **框架**：Next.js 14 + TypeScript
- **样式**：Tailwind CSS + Framer Motion
- **图表**：Recharts
- **AI**：MiniMax-M2.7（OpenAI 兼容接口）
- **设计系统**：Raycast 风格暗色主题

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.local.example .env.local
# 填入 MINIMAX_API_KEY 和 MINIMAX_BASE_URL

# 启动开发服务器
npm run dev
```

访问 `http://localhost:3000`

## 环境变量

```env
MINIMAX_API_KEY=your_api_key
MINIMAX_BASE_URL=https://api.minimax.chat/v1
```

## 页面结构

```
/            首页
/interview   访谈页（与 Agent A 对话）
/report      报告页（AI-MBTI 分析结果）
```

## 报告输出示例

```json
{
  "summary": "你是一位高效的工具型使用者，习惯先定框架再行动",
  "tags": ["框架先行", "审计型", "局部调整"],
  "dimensions": [
    {
      "dimension": "Relation",
      "score": 20,
      "tendency": "Instrumental",
      "evidence": ["我一般直接让它帮我写，写完我自己改"],
      "advice": "..."
    }
  ]
}
```
