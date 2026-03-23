import { getDefaultEntryScenarioId } from "@/lib/scenario-router";
import { ensureBrowserUserId } from "@/lib/session-user";

const IDENTITY_LS_KEY = "ai-literacy-identity-id";

/**
 * 构造进入对话页的 query（与 `/setup` 一致）：始终带 `userId`；仅当传入有效 `identityId` 时带上。
 * 不读取 localStorage，避免「跳过」后仍带上旧身份。
 */
export function buildChatEntryQuery(identityId?: string): string {
  const uid = ensureBrowserUserId();
  const q = new URLSearchParams({ userId: uid });
  if (identityId) q.set("identityId", identityId);
  return q.toString();
}

/** 指定场景的对话路径 + query */
export function chatPathForScenarioWithQuery(scenarioId: string, identityId?: string): string {
  return `/chat/${scenarioId}?${buildChatEntryQuery(identityId)}`;
}

/** 默认场景下的对话路径 + query */
export function chatPathWithQuery(identityId?: string): string {
  const sid = getDefaultEntryScenarioId();
  return chatPathForScenarioWithQuery(sid, identityId);
}

/**
 * 结果页「再测一轮」：默认场景 + userId，若本地曾保存身份则附带 `identityId`（仅浏览器内调用）。
 */
export function chatAgainPathFromBrowser(): string {
  const sid = getDefaultEntryScenarioId();
  const q = new URLSearchParams({ userId: ensureBrowserUserId() });
  if (typeof window !== "undefined") {
    const id = window.localStorage.getItem(IDENTITY_LS_KEY);
    if (id) q.set("identityId", id);
  }
  return `/chat/${sid}?${q.toString()}`;
}
