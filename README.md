# Human-AI Performance Lab

> 沙盒探针模型：测量人类与AI协作时的真实能力与风格

---

## 项目概述

本项目构建了一个**沙盒测试系统**，通过模拟真实场景观察用户与AI的交互行为，从而测量：

- **FAA（Fluid AI Ability）**：调用AI解决问题的即时能力
- **AI-MBTI**：人机协作时的习惯倾向

### 核心架构

```
用户（不知情）<-> Agent A（对话引导）<-> Agent B（进度检查+评分）
```

**分工**：
- **Agent A**：负责与用户对话，不做判断，只记录探针数据
- **Agent B**：轻量级进度检查（选了什么？理由说过了吗？）+ 最终完整评分
- 用户最终看到 FAA + MBTI 报告

---

## 核心概念

### FAA（Fluid AI Ability）

| 维度 | 含义 |
|-----|------|
| **F**rame | 任务建模：能否清晰定义目标与约束（软约束优先级） |
| **A**sk | 策略调用：能否有效提问获取信息 |
| **R**eview | 证据核验：能否核实AI提供的信息 |
| **E**dit | 纠偏迭代：能否根据反馈调整**筛选策略** |
| **S**ynthesize | 整合交付：能否综合信息做出决策 |

> **注意**：软约束是用户自己设定的，**不可改变**。Edit 测的是用户在决策过程中的灵活性，而非约束本身的变化。

### AI-MBTI

| 维度 | A倾向 | B倾向 |
|-----|-------|-------|
| Relation | Instrumental（工具人） | Collaborative（伙伴） |
| Workflow | Framed（框架型） | Exploratory（探索型） |
| Epistemic | Auditing（审计型） | Trusting（信任型） |
| Repair Scope | Global-Reframing（全局重评） | Local-Refinement（局部调整） |

---

## Demo 场景：租房选房源

### 场景设定

- **任务**：用户从6套房源中选出最优解
- **房源信息**：8个维度（价格/面积/地铁/朝向/楼层/装修/配套/房龄）
- **展示结构**：卡片列表（基本信息）+ 弹窗（完整详情）

### 约束设计

**硬约束（必须满足）**：价格 ≤ 5500元/月

**软约束（5个，可不满足但影响综合评分）**：

| # | 维度 | 要求 |
|---|-----|------|
| 1 | 交通 | 地铁 ≤ 600米 |
| 2 | 面积 | ≥ 60㎡ |
| 3 | 装修 | 简装或精装 |
| 4 | 房龄 | ≤ 15年 |
| 5 | 楼层 | 中高层 |

### 房源数据

| 房源 | 价格 | 面积 | 地铁 | 装修 | 房龄 | 楼层 | 备注 |
|-----|------|------|------|------|------|------|------|
| A | 4500 | 80㎡ | 1200m | 精装 | 5年 | 低层 | 软约束-2 |
| **B** | 5100 | 75㎡ | 650m | 精装 | 6年 | 高层 | **最优解** |
| C | 6000 | 70㎡ | 400m | 精装 | 8年 | 低层 | 硬约束不满足 |
| D | 4200 | 90㎡ | 1500m | 毛坯 | 20年 | 中层 | 软约束-3 |
| **E** | 4900 | 65㎡ | 300m | 简装 | 10年 | 低层 | **最优解** |
| F | 4800 | 55㎡ | 200m | 简装 | 20年 | 高层 | 软约束-2 |

**最优解**：B（交通略远）或 E（楼层略低），都是正确答案

---

## 技术实现

### Agent A（对话引导）

- 基于 LLM（Minimax M2.7）
- System Prompt 控制对话行为
- 每次对话记录探针数据
- 不做判断，只引导对话

### Agent B（进度检查 + 评分）

**进度检查**（轻量级，每次对话后调用）：
```json
{
  "selectedHouse": "E" | null,
  "reasonGiven": true | false
}
```

**完整评估**（点"查看结果"时调用）：
```json
{
  "faa": { "frame": 85, "ask": 70, ... },
  "mbti": { "relation": 15, "workflow": 35, ... },
  "profile": { "summary": "...", "tags": [...] },
  "decision": { "choice": "E", "isOptimal": true }
}
```

---

## 探针设计

### 探针类型

| 类型 | 说明 |
|-----|------|
| **主动探针** | Agent A 主动提问，自然嵌入对话 |
| **被动探针** | 观察用户行为，不打断 |

### Edit 探针的行为定义

Edit 测的是**筛选策略的灵活性**，包括：

- 回看之前排除的房源
- 改变筛选优先级（先比价格 vs 先比交通）
- 犹豫后换了比较维度

---

## Agent B 评分机制

### FAA 评分（绝对，0-100分）

| 维度 | 权重 | 评分依据 |
|-----|------|---------|
| Frame | 20% | 是否明确说软约束优先级；引用约束维度数量与质量 |
| Ask | 15% | 问题是否针对核心信息 |
| Review | 20% | 有无核实/回看行为 |
| Edit | 15% | 筛选策略调整次数与性质（≠改变约束本身） |
| Synthesize | 30% | 理由清晰度与约束引用度 |

**综合FAA = 各维度加权平均**

### MBTI 评分（百分比，0-100%）

| 维度 | 0% | 100% |
|-----|-----|------|
| Relation | Instrumental | Collaborative |
| Workflow | Framed | Exploratory |
| Epistemic | Auditing | Trusting |
| Repair Scope | Global | Local |

百分比由信号强度决定，混杂信号取中间值。

### Agent B 输出示例

```json
{
  "faa": {
    "frame": 85,
    "ask": 70,
    "review": 90,
    "edit": 45,
    "synthesize": 88,
    "total": 75.6
  },
  "mbti": {
    "relation": 15,
    "workflow": 35,
    "epistemic": 80,
    "repairScope": 40
  },
  "profile": {
    "summary": "你的AI协作风格：偏向工具型使用，独立决策，注重核实细节",
    "tags": ["审计型", "框架先行", "谨慎决策"]
  },
  "decision": {
    "choice": "E",
    "isOptimal": true
  }
}
```

---

## 探针数据结构

```json
{
  "type": "active" | "passive",
  "trigger": "阶段/行为单元",
  "signal": "用户说的话/做的事",
  "dimension": ["FAA.Frame", "MBTI.Workflow", ...],
  "raw": "原始对话片段"
}
```

---

## 技术栈

- **Framework**: Next.js 16 + React
- **Styling**: Tailwind CSS
- **LLM**: Minimax M2.7 (OpenAI-compatible API)
- **Language**: TypeScript

## 快速开始

```bash
# 安装依赖
npm install

# 设置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入你的 MINIMAX_API_KEY

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

---

## 项目状态

- [x] 单场景 Demo 实现完成
- [ ] 后续扩展多场景（MBTI 需跨场景测量）
- [ ] Profile 标签系统完善
