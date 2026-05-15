<div align="center">

<img src="./public/favicon.svg" width="80" height="80" alt="Lab Icon" />

# 🧠 Human-AI Performance Lab

**你和 AI 的协作方式，比你想象的更有规律。**

*一个基于信息收集表单 + 两段式动态问卷 + 中途反馈校准 + 个性化报告的 AI 协作风格测评系统*

---

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer-Motion-0055FF?style=flat-square&logo=framer&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-5fc992?style=flat-square)
![Version](https://img.shields.io/badge/Version-7.0.0-FF6363?style=flat-square)

</div>

---

## ✦ 是什么

**Human-AI Performance Lab** 是一套完整的 **AI 协作风格测评系统**（AI-MBTI）。

它不考察你的 AI 知识，也不评判你用得"对不对"——它只是精准地照出你真实的协作习惯，然后把它变成你能立刻用上的工具。

**测评流程：**

```
① 信息收集（/intake）
   └─ 表单填写 · 职业 / 身份 · 具体 AI 使用经历 · 常用 AI 工具
      不调用 LLM，本地初始化 SessionState

② 两段式定制问卷（共 16 题）
   ├─ Batch 1：8 题（通用题 × 4 + 半具体题 × 4）· 快速采样协作风格
   ├─ 中途反馈页（/mid-feedback）
   │   └─ 表单收集：第一轮整体感受 · 题目问题反馈 · 第二轮希望聚焦的场景
   └─ Batch 2：8 题（半具体题 × 4 + 具体题 × 4）· 贴近真实场景校准

③ 服务端确定性计分
   └─ TypeScript 精准计算四维得分，LLM 不参与评分

④ 个性化报告
   └─ LLM 生成解释 · 建议 · Prompt 模板
```

问卷支持「不了解 / 没想好」选项：不适用的题可以跳过，不会被当作中间分。

---

## ✦ 四个核心维度

> 每个维度输出 **0–100% 连续分值**，混杂信号取中间值。

<table>
  <thead>
    <tr>
      <th>维度</th>
      <th>字母</th>
      <th>A 端（接近 0%）</th>
      <th>B 端（接近 100%）</th>
      <th>色彩语义</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Relation</b> 关系定位</td>
      <td>I / C</td>
      <td>🔵 Instrumental 工具型</td>
      <td>🟠 Collaborative 伙伴型</td>
      <td>冷静 → 温暖</td>
    </tr>
    <tr>
      <td><b>Workflow</b> 工作流程</td>
      <td>E / F</td>
      <td>🩵 Exploratory 探索型</td>
      <td>🟣 Framed 框架型</td>
      <td>流动 → 结构</td>
    </tr>
    <tr>
      <td><b>Epistemic</b> 认知态度</td>
      <td>T / A</td>
      <td>🟡 Trusting 信任型</td>
      <td>⬜ Auditing 审计型</td>
      <td>信任 → 谨慎</td>
    </tr>
    <tr>
      <td><b>RepairScope</b> 修复范围</td>
      <td>L / G</td>
      <td>🟢 Local 局部调整</td>
      <td>🟤 Global 全局重评</td>
      <td>微观 → 宏观</td>
    </tr>
  </tbody>
</table>

**光谱颜色系统：**

| 维度 | 低分端色 | 高分端色 |
|------|---------|---------|
| Relation | `#2563eb` 深蓝 | `#f97316` 橙红 |
| Workflow | `#14b8a6` 青绿 | `#4f46e5` 靛青 |
| Epistemic | `#fbbf24` 金黄 | `#64748b` 石墨灰 |
| RepairScope | `#10b981` 翠绿 | `#8b5cf6` 紫罗兰 |

---

## ✦ 16 种人格画像

> 四个维度的两两组合，衍生出 **16 种独特的 AI 协作人格**。你是哪一种？

### 🤝 协作型（C · Collaborative）

<table>
  <tr>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/CETL.png" width="96" height="96" alt="CETL" /><br/>
      <b>CETL</b><br/>
      <sub>研究搭档</sub><br/>
      <sub><i>一起探索，快速迭代</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/CETG.png" width="96" height="96" alt="CETG" /><br/>
      <b>CETG</b><br/>
      <sub>领航员</sub><br/>
      <sub><i>带领团队，探索未知</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/CEAL.png" width="96" height="96" alt="CEAL" /><br/>
      <b>CEAL</b><br/>
      <sub>外交官</sub><br/>
      <sub><i>理性协商，探讨策略</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/CEAG.png" width="96" height="96" alt="CEAG" /><br/>
      <b>CEAG</b><br/>
      <sub>战略家</sub><br/>
      <sub><i>共谋大局，深谋远虑</i></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/CFTL.png" width="96" height="96" alt="CFTL" /><br/>
      <b>CFTL</b><br/>
      <sub>合伙人</sub><br/>
      <sub><i>稳扎稳打，并肩前行</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/CFTG.png" width="96" height="96" alt="CFTG" /><br/>
      <b>CFTG</b><br/>
      <sub>指挥官</sub><br/>
      <sub><i>统筹全局，果断决策</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/CFAL.png" width="96" height="96" alt="CFAL" /><br/>
      <b>CFAL</b><br/>
      <sub>执行官</sub><br/>
      <sub><i>思路清晰，执行到位</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/CFAG.png" width="96" height="96" alt="CFAG" /><br/>
      <b>CFAG</b><br/>
      <sub>董事长</sub><br/>
      <sub><i>掌控全局，追求卓越</i></sub>
    </td>
  </tr>
</table>

### 🛠️ 独立型（I · Instrumental）

<table>
  <tr>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/IETL.png" width="96" height="96" alt="IETL" /><br/>
      <b>IETL</b><br/>
      <sub>画家</sub><br/>
      <sub><i>自由创作，涂涂画画</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/IETG.png" width="96" height="96" alt="IETG" /><br/>
      <b>IETG</b><br/>
      <sub>厨师</sub><br/>
      <sub><i>即兴发挥，成就佳作</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/IEAL.png" width="96" height="96" alt="IEAL" /><br/>
      <b>IEAL</b><br/>
      <sub>作家</sub><br/>
      <sub><i>边写边改，字斟句酌</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/IEAG.png" width="96" height="96" alt="IEAG" /><br/>
      <b>IEAG</b><br/>
      <sub>发明家</sub><br/>
      <sub><i>不断试验，追求突破</i></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/IFTL.png" width="96" height="96" alt="IFTL" /><br/>
      <b>IFTL</b><br/>
      <sub>实干家</sub><br/>
      <sub><i>定好规则，高效执行</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/IFTG.png" width="96" height="96" alt="IFTG" /><br/>
      <b>IFTG</b><br/>
      <sub>完美主义者</sub><br/>
      <sub><i>追求极致，不留遗憾</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/IFAL.png" width="96" height="96" alt="IFAL" /><br/>
      <b>IFAL</b><br/>
      <sub>建筑师</sub><br/>
      <sub><i>精心设计，严谨落地</i></sub>
    </td>
    <td align="center" width="160">
      <img src="./public/avatars/avatar-choices/IFAG.png" width="96" height="96" alt="IFAG" /><br/>
      <b>IFAG</b><br/>
      <sub>系统架构师</sub><br/>
      <sub><i>全局规划，滴水不漏</i></sub>
    </td>
  </tr>
</table>

---

## ✦ 技术栈

| 层 | 技术 |
|----|------|
| 框架 | ![Next.js](https://img.shields.io/badge/-Next.js_14-black?logo=next.js&style=flat-square) TypeScript |
| 样式动效 | ![Tailwind](https://img.shields.io/badge/-Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square) ![Framer](https://img.shields.io/badge/-Framer_Motion-0055FF?logo=framer&logoColor=white&style=flat-square) |
| 图表 | ![Recharts](https://img.shields.io/badge/-Recharts-FF6384?style=flat-square) |
| AI 接入 | Qwen3.6-plus via OpenAI-compatible gateway（保留原生 Anthropic Messages API 路径）|
| 设计语言 | Raycast 风格暗色主题 · `#07080a` 底色 · Raycast Red `#FF6363` |
| 数据存储 | `.local-debug/` 本地反馈存储 |

---

## ✦ 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.local.example .env.local
# 填入 OPENAI_COMPATIBLE_API_KEY，或切换为原生 Anthropic 配置

# 3. 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 开始测评。

---

## ✦ 开发工具

```bash
# 验证 LLM 接入是否正常
npm run check:llm

# 验证 Tool Use / Function Calling 支持
npm run check:llm-tools

# 浏览器自动化测试（需先启动 dev server）
npm run test:browser

# Phase 6/7 API smoke 测试
npm run smoke:phase6-phase7
```

---

<div align="center">

**Human-AI Performance Lab** · v7.0.0 · 2026

*了解协作习惯，才能真正释放 AI 的潜力。*

</div>
