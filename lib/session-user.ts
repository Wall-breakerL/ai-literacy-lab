/** 浏览器内匿名 userId，用于 UserMemory 聚合（与 identityId 独立） */
export const USER_ID_KEY = "ai-literacy-user-id";

export function ensureBrowserUserId(): string {
  if (typeof window === "undefined") return "";
  let uid = window.localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    uid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `u-${Date.now()}`;
    window.localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
}
