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
    return jsonError("SESSION_NOT_FOUND", "未找到对应的会话。", 404);
  }

  return jsonError("INTERNAL_ERROR", "服务器发生未预期错误。", 500);
}
