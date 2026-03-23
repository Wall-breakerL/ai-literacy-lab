"use client";

import { MotionConfig } from "framer-motion";

/** 与 Framer 文档一致：尊重系统「减少动态效果」，大位移自动弱化 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
