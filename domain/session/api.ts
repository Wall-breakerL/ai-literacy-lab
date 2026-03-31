import { z } from "zod";
import { SessionStateSchema, TurnInputSchema, TurnOutputSchema } from "@/domain/engine/session-state";
import { SessionEventSchema, SessionIdSchema } from "@/domain/session/events";

export const CreateSessionRequestSchema = z
  .object({
    participantLabel: z.string().trim().min(1).max(64).optional(),
  })
  .default({});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const CreateSessionResponseSchema = z.object({
  sessionId: SessionIdSchema,
  snapshot: SessionStateSchema,
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;

export const GetSessionResponseSchema = z.object({
  sessionId: SessionIdSchema,
  snapshot: SessionStateSchema,
  events: z.array(SessionEventSchema),
});
export type GetSessionResponse = z.infer<typeof GetSessionResponseSchema>;
export type SessionReplay = GetSessionResponse;

export const PostSessionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SEND_USER_MESSAGE"), message: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("ADVANCE_STAGE"), toStage: z.string().min(1) }),
  z.object({ action: z.literal("COMPLETE_SCENE") }),
]);
export type PostSessionAction = z.infer<typeof PostSessionActionSchema>;
export const PostSessionRequestSchema = z.object({ action: PostSessionActionSchema });
export const PostSessionResponseSchema = GetSessionResponseSchema;

export const TurnRequestSchema = TurnInputSchema;
export type TurnRequest = z.infer<typeof TurnRequestSchema>;
export const TurnResponseSchema = TurnOutputSchema;
export type TurnResponse = z.infer<typeof TurnResponseSchema>;

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
