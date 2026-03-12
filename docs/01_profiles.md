# 用户画像定义与分流原则

## 画像定义

一期只做两个轴，用于分流场景与反馈措辞：

```typescript
type UserProfile = {
  role: "student" | "general"
  level: "novice" | "intermediate"
}
```

- **role**：身份/使用场景 — 学生 vs 通用（职场/生活）。
- **level**：自评 AI 使用熟练度 — 新手 vs 有一定经验。

## 分流原则

- 用户进入系统后**先选择**自己的 Role 和 AI Level，得到唯一 `UserProfile`。
- 系统根据 `UserProfile` 分配**对应 4 个场景中的子集**（按 role 匹配），底层评估维度（Rubric）对所有用户**完全一致**，仅场景文案与反馈措辞按画像变化。
