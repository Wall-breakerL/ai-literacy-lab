# 第一轮优化后 Owner 自测反馈

记录日期：2026-05-15  
测试平台：手机 + 电脑，各跑 2–3 轮完整流程

---

## 背景

完成第一轮同学反馈优化（D1–D8 全部合并 PR）后，Owner 自己跑了两个平台的测试，以下是发现的问题和想法，待交由 Codex 实施。

---

## 问题列表

### S1. 中途反馈"跳过反馈"按钮可以删掉

- 发生位置：中途反馈页（第一轮问卷结束、第二轮问卷开始之前的中间反馈阶段）
- 反馈：该按钮在第一轮优化后已无必要，建议直接删除。
- 方案：移除中途反馈页的"跳过反馈"按钮，保持页面简洁。

---

### S2. 第二轮问卷走到了 fallback

- 发生位置：第二轮问卷生成
- 反馈：跑到第二次问卷时触发了 fallback，需要排查原因。
- 方案：需要查看 fallback 触发条件，排查第二轮问卷生成时是否存在稳定性问题。

---

### S3. 生成报告页切换主题背景无效，只换了浏览器边框颜色

- 发生位置：生成报告页（loading 页），Light/Dark 主题切换
- 反馈：在生成报告页点击主题切换后，页面背景仍然是黑色，实际上只是系统/浏览器的边框颜色换了，页面本身没有响应主题变量。
- 方案：
  - 确保生成报告页的背景色也使用 CSS 主题变量而不是硬编码颜色。
  - Light 模式下，生成报告页的背景建议改为羊皮纸色（如 `#F5F0E8` 或类似暖白），与整体 Light 模式风格保持一致，不要是纯白。具体色值可以自己调一个好看的。

---

### S4. 海报内容被截断，底部标签行和 Golden Line 显示不全

- 发生位置：报告海报页 — `PosterPreview` 海报卡片，**电脑端**（手机端相对正常）
- 反馈：电脑端海报底部内容被截断，截图可见标签行只显示了一半，Golden Line 区块勉强可见但标签被切掉。
- 根本原因（已精确定位）：
  - **核心问题：海报内容总高度 > 海报容器高度，`overflow-hidden` 直接截掉底部内容。** 这不是宽度压缩问题。
  - 宽度计算：`width: min(100%, calc((100svh - 144px) * 9 / 16))`。电脑端 svh ≈ 900px，算出宽度 ≈ 425px，`aspect-[9/16]` 对应海报高度 ≈ 755px。
  - 内容实际所需高度：顶部头像区 `min-h-[100px]` + tagline `min-h-[44px]+mt-4` + 古典分隔 `my-5` + 4条光谱 + 标签 `h-[30px]+mt-5` + `mt-auto` 底部分隔 + Golden Line `min-h-[84px]` + 底部文字，总和明显超过 755px 容器高度。
  - 额外 bug：标签行固定 `h-[30px] overflow-hidden`，在某些情况下自身也会截断标签内容。
- 方案：
  - **减小海报内各区块的固定间距**，压缩能压的地方：`my-5` 分隔线改 `my-3`，`mt-5` 标签改 `mt-3`，`mt-4` tagline 改 `mt-2`，`mt-3` Golden Line 改 `mt-2`，Golden Line 的 `min-h-[84px]` 去掉改为自然高度，`p-5` 内边距可适当缩为 `p-4`。
  - **修复标签行 bug**：`h-[30px] overflow-hidden` 改为 `min-h-[24px]`，去掉固定高度限制，让标签自然显示。
  - 目标是让内容总高度在约 700–750px 内能完整显示，在 svh ≥ 780px 的电脑端首屏可见。
  - 不要改宽度计算逻辑，手机端目前正常，这是专门针对电脑端内容溢出的修复。

---

### S5. 协作风格画像模块改动方向不对，需重新设计

- 发生位置：两处——`ReportStoryExperience.tsx` 第3页 slide（第 552–592 行）+ `report/page.tsx` 完整报告 `styleProfile` section（第 757–794 行及 `problems` section 第 797–821 行）
- 反馈：
  - 第一轮优化（D4）移除了 comparison 对比区块，这个方向对。
  - 但现在呈现的内容（`basedOn`、`evidence` 字段等"基于什么、证据是什么"）没有意义，用户看不懂。
  - 原来版本"做的对的（绿色）/ 做的错的（橙色）"两栏视觉对比设计清晰直观，这个思路是对的，需要恢复。
  - 现在把"可能遇到的问题"（`problems`）单独开了第4页 slide 和完整报告独立 section，割裂了画像整体性。
- 新的方案（**需要同时改 prompt + 前端展示**）：

**第一步：改报告生成 prompt（`src/lib/reportPrompt.ts`）**
  - 在 `styleProfile` 字段下新增两个数组字段：
    - `strengths`: string[] — 该用户协作风格的 2–3 条优点，每条一句话，直接描述正向行为价值。
    - `weaknesses`: string[] — 该用户协作风格的 2–3 条缺点/风险，每条一句话，直接描述可能踩的坑。
  - 移除原有 `problems` 字段的生成要求（或保留但前端不再展示）。
  - `styleProfile.uniqueness` 字段不再需要生成，可从 prompt 中移除。

**第二步：重构前端展示**
  - 协作风格画像整合为**一个卡片，三层结构**：
    1. **风格描述**：取 `styleProfile.behaviors[0].behavior`，一段话描述用户典型协作方式，去掉 `basedOn`、`evidence` 等所有技术性标注。
    2. **✓ 优点**：渲染 `styleProfile.strengths[]`，每条前加绿色 ✓，文字用绿色系（`#5fc992`）。
    3. **✗ 缺点**：渲染 `styleProfile.weaknesses[]`，每条前加橙色 ✗，文字用橙色系（`#f97316`）。
    - 优点和缺点在同一卡片内左右两栏并排（参考旧版设计），视觉对比清晰。
  - 移除独立的"WATCH OUT · 你可能遇到的问题"第4页 slide，slides 数组长度从 6 减为 5，同步更新 `goNext` 里 `slideIndex >= 5` 的边界判断为 `slideIndex >= 4`。
  - 移除完整报告里独立的 `problems` section（第 797–821 行），合并进上述画像卡片。
  - 移除 `styleProfile.uniqueness` 的渲染，不再展示独特组合和相似用户。

---

### S6. 手机端海报图片生成失败

- 发生位置：手机端 - 报告海报页 - 点击"分享"按钮（`handleSharePoster` 函数，`ReportStoryExperience.tsx` 第 468–515 行）
- 反馈：手机上点分享按钮时，海报图片生成失败。
- 可能原因（已定位）：
  - `html2canvas` 在 iOS Safari 上兼容性差，若海报内含跨域资源（字体、SVG avatar），会导致 canvas 空白或直接报错。
  - 移动端 `devicePixelRatio` 通常为 3，`scale: Math.min(3, window.devicePixelRatio || 2)` 会生成超大 canvas（约 1242×2208），移动端内存不足易崩溃。
  - catch 里的降级逻辑是直接 `downloadBlob`，但移动端 Safari 不支持 `<a download>`，降级也会失败，用户只看到"分享失败"文案。
- 方案：
  - 移动端检测到生成失败时，给出明确提示（如"长按海报可保存图片"），引导用户用系统原生截屏或长按保存。
  - 可尝试将移动端 scale 降至 2，减少内存压力。
  - 排查 PersonalityAvatar 是否有跨域图片资源，如有则改为 inline SVG 或 data URL，避免 `useCORS` 失效。

---

### S7. 手机端底部三个按钮逻辑需要重构：报告、反馈、分享互相独立

- 发生位置：`ReportStoryExperience.tsx` 第 789–819 行（三个按钮 + `showFullReport` 展开区）
- 反馈：
  - 当前"反馈"按钮触发 `revealFeedback()`，它会把 `showFullReport` 设为 true，然后滚动到完整报告末尾的 `#report-feedback-panel`，导致点"反馈"却把整个完整报告也展开了。
  - `ReportFeedbackPanel` 目前是嵌在 `fullReport` JSX 的最后（`report/page.tsx` 第 1031 行），和完整报告共用同一个展开状态。
  - 期望行为：三个按钮完全独立：
    - **分享**：触发图片生成/分享，不展开任何内容区。
    - **完整报告**：独立展开报告内容，不影响反馈面板。
    - **反馈**：独立展开反馈面板，不展开完整报告。
- 方案：
  - 新增独立状态 `showFeedbackPanel`，和 `showFullReport` 并列，互不影响。
  - 将 `ReportFeedbackPanel` 从 `fullReport` JSX 里抽出来，作为独立展开区渲染（和完整报告同级）。
  - `revealFeedback` 改为只切换 `showFeedbackPanel`，不再设置 `showFullReport`。
  - 三个按钮配色差异化：
    - **分享**：`bg-raycast-blue/15 border-raycast-blue/40 text-raycast-blue`（蓝色，代表操作/输出）
    - **完整报告**：保持现有白底黑字（`bg-white text-slate-950`，主操作，最突出）
    - **反馈**：`bg-raycast-green/15 border-raycast-green/40 text-raycast-green`（绿色，代表沟通/反馈）

---

---

### S10. Toolbox（工具箱）和工作流 slide 内容为空

- 发生位置：报告 slide 第5页"TOOLBOX · 适合你的AI工具箱"和第6页"WORKFLOW · 适合你的AI协作流程"
- 反馈：Toolbox 卡片只有标题，内容完全空白；工作流显示"暂无工作流"。
- 根本原因（已定位）：
  - `toolbox` 字段在 `GENERATE_REPORT_TOOL` 的 tool schema 里**不在 `required` 数组中**（`src/app/api/report/route.ts` 第 49–59 行，required 只列了 `summary`、`tags`、`styleOverview` 等核心字段），导致模型在 token 紧张时可以合法地不生成 `toolbox`。
  - 模型生成 JSON 时若内容过长被截断，`toolbox` 作为靠后的字段也容易丢失。
  - 前端读取 `(report as any).toolbox?.promptTemplates` 时，若 `toolbox` 为 undefined，slide 只显示标题，不报错。
- 方案：
  - 将 `toolbox` 加入 `GENERATE_REPORT_TOOL` 的 `required` 数组，强制模型必须生成。
  - 同时检查 `LLM_REPORT_MAX_TOKENS` 是否足够容纳完整报告（`styleProfile` + `toolbox` + `workflow` 内容量较大），必要时适当提高 token 上限。
  - 前端 slide 在 `toolbox` 缺失时显示明确的 fallback 提示，而不是空白卡片。

---

## 优先级建议

> S1–S7 已由上一轮 PR 实施完成。

| 编号 | 问题 | 优先级 | 状态 |
|---|---|---|---|
| S1 | 删除中途反馈"跳过反馈"按钮 | 低 | ✅ 已完成 |
| S2 | 第二轮问卷 fallback 排查 | 中 | ✅ 已完成 |
| S3 | 生成报告页主题切换无效 | 中高 | ✅ 已完成 |
| S4 | 海报电脑端内容截断 | 中高 | ✅ 已完成 |
| S5 | 协作风格画像重新设计 | 高 | ✅ 已完成 |
| S6 | 手机端海报图片生成失败 | 中高 | ✅ 已完成 |
| S7 | 底部三个按钮逻辑重构 | 高 | ✅ 已完成 |
| S8 | fallback 使用情况未记录进 analytics | 中 | 待实施 |
| S9 | 电脑端分享/拷贝触发两次 | 中高 | 待实施（需确认具体触发路径） |
| S10 | Toolbox 和工作流 slide 内容为空 | 高 | 待实施 |

---

## 给 Codex 的实施说明

> **S1–S7 已实施完成，以下仅列出待实施的 S8–S10。**

### S8 — fallback 使用情况未记录进 analytics
- 文件：`src/app/mid-feedback/page.tsx`
- 删除第 235–241 行的 `<button onClick={() => submit(true)}>跳过反馈</button>` 及其父容器中多余的布局代码。
- `submit(skip = false)` 里 `skip` 分支逻辑也可一并删除，只保留 `skip = false` 的正常提交路径。

### S2 — 第二轮问卷 fallback 排查
- 查看 `src/app/api/questionnaire/generate/route.ts` 及 `src/lib/fallbackQuestionnaire.ts`，定位 fallback 触发条件。
- 重点排查：第二轮生成时传入的 `refinedTargetContext` 是否格式正确、LLM 调用是否超时或返回格式异常导致降级。

### S3 — 生成报告页主题切换无效
- 文件：`src/components/HolographicLoading.tsx`
- 问题：`report/page.tsx` 在 `loading && !showReport` 时直接 `return <HolographicLoading />`，此时 layout（含 ThemeToggle）可能未渲染，`data-theme` 未初始化到 `document.documentElement`。
- 修复方向：确认 `ThemeToggle` 是否在全局 layout 中渲染，若是则排查 `HolographicLoading` 内部硬编码颜色（如 `rgba(85,179,255,...)`、`bg-void` 以外的背景色），统一改为 CSS 变量。
- Light 模式下建议对 `HolographicLoading` 的背景使用羊皮纸暖白色（推荐 `#F5F0E8`），配合粒子、矩阵雨效果在 light 模式下改为低透明度深色，保持视觉一致性。

### S4 — 海报电脑端内容截断
- 文件：`src/components/ReportStoryExperience.tsx`，`PosterPreview` 组件（第 825 行起）
- 问题：海报内容总高度超过容器高度（约 755px），`overflow-hidden` 截掉底部；标签行 `h-[30px] overflow-hidden` 也有独立截断 bug。
- 修复（只压缩间距，不改宽度计算逻辑）：
  - `my-5` 分隔线 → `my-3`
  - tagline `mt-4` → `mt-2`
  - 标签行 `mt-5 h-[30px] overflow-hidden` → `mt-3 min-h-[24px]`（去掉固定高度）
  - Golden Line `mt-3 min-h-[84px]` → `mt-2`（去掉 min-h）
  - 内边距 `p-5 pb-5` → `p-4`
- 目标：让内容总高在约 700–750px 内，电脑端首屏完整可见。

### S5 — 协作风格画像重新设计（**改 prompt + 改前端展示**）
- 文件1（prompt）：`src/lib/reportPrompt.ts`
  - 在 `styleProfile` 下新增 `strengths: string[]` 和 `weaknesses: string[]` 两个字段，各 2–3 条，直接描述用户风格的优点和缺点。
  - 移除 `problems` 字段和 `styleProfile.uniqueness` 字段的生成要求。
- 文件2（slide）：`src/components/ReportStoryExperience.tsx`，第3页 slide（第 552–592 行）
  - 改为单卡片三层：风格描述（`behaviors[0].behavior`）+ 绿色优点栏（`strengths[]`）+ 橙色缺点栏（`weaknesses[]`），左右两栏并排。
  - 删除第4页"WATCH OUT" slide，slides 数组从6项减为5项，`goNext` 的边界 `slideIndex >= 5` 改为 `slideIndex >= 4`。
- 文件3（完整报告）：`src/app/report/page.tsx`
  - 合并 `styleProfile` section（第 757–794 行）和 `problems` section（第 797–821 行）为一个"协作风格画像"section，结构同上。
  - 移除 `uniqueness` 和 `similarRoles` 的渲染。
  - 移除所有 `basedOn`、`evidence`、`基于`、`证据` 等字段的渲染。

### S8 — fallback 使用情况没有记录进 analytics

- 文件：`src/lib/analytics/client.ts`、`src/lib/analytics/shared.ts`、`src/app/interview/page.tsx`（调用问卷生成的地方）
- 问题：问卷生成 API（`/api/questionnaire/generate`）响应里已有 `source`（`"model"` / `"fallback"`）、`validationIssue`、`warnings` 字段，但前端拿到后没有把这些信息写进 analytics。用户完成测试后调用 `recordTestResult` 时，`TestResultPayload` 里没有 fallback 相关字段，导致事后完全无法查知某次测试有没有走 fallback、哪一轮走的。
- 方案：
  - 在 `TestResultPayload`（`src/lib/analytics/shared.ts`）里新增可选字段：`fallbackBatches?: string[]`（记录哪些 batch 走了 fallback，如 `["batch1"]`、`["batch2"]`）。
  - 前端问卷生成成功后，把每轮的 `source` 结果存入 sessionState 或临时变量，最终 `recordTestResult` 时一并上报。
  - 同时把 AI 工具信息（`sessionState.background.tools`）确认已经随 `tools` 字段上报（当前代码里 `tools` 字段有传，但需确认 intake 页是否正确收集了 AI 工具选项并写入 sessionState）。

### S9 — 电脑端点分享按钮触发两次下载

- 发生位置：电脑端 - 报告海报页 - 点击"分享"按钮
- 文件：`src/components/ReportStoryExperience.tsx`，`handleSharePoster` 函数（第 468–515 行）
- 根本原因（已定位）：
  - 电脑端 `navigator.share` 不存在，`nav.canShare?.(shareData)` 返回 false，走 else 分支执行第一次 `downloadBlob`。
  - 但 else 分支执行完后，若 try 块内后续代码（如 `withShareTimeout` 等）抛出异常，就会进 catch，catch 里的降级逻辑会再次调用 `html2canvas` + `downloadBlob`，触发第二次下载。
  - 结果：用户在电脑端点一次分享，收到两个下载文件。
- 方案：
  - 在 try 块里用 `let downloaded = false` 标记是否已触发过下载，`downloadBlob` 执行后置为 true。
  - catch 里的降级 `downloadBlob` 只在 `!downloaded` 时执行，确保整个流程最多触发一次下载。
  - 具体修改：在 else 分支 `downloadBlob(blob, filename)` 后加 `downloaded = true`；catch 内降级下载前判断 `if (!downloaded)`。

### S10 — Toolbox 和工作流 slide 内容为空
- 文件：`src/app/api/report/route.ts`，`GENERATE_REPORT_TOOL` 定义（第 43 行起）
- 将 `toolbox` 加入 `required` 数组，和 `summary`、`tags` 等并列，强制模型必须生成。
- 检查 `LLM_REPORT_MAX_TOKENS`（`src/lib/llm.ts`）是否足够，建议确认当前值并在必要时提高，确保完整报告内容不被截断。
- 前端 slide（`ReportStoryExperience.tsx` 第5、6页）在 `toolbox` 缺失时显示明确 fallback 文案（如"工具箱生成失败，请重新生成报告"），不显示空白卡片。
