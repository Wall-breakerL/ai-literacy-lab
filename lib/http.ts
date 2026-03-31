import { ZodError } from "zod";

export function jsonError(code: string, message: string, status: number): Response {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ZodError) {
    return jsonError("VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid payload", 400);
  }

  if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
    return jsonError("SESSION_NOT_FOUND", "未找到该原型会话，请返回首页重新创建。", 404);
  }

  return jsonError("INTERNAL_ERROR", "原型服务暂时不可用，请稍后重试。", 500);
}
