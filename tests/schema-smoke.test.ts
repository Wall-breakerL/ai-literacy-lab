import { describe, expect, it } from "vitest";
import { CORE_SEQUENTIAL_ASSESSMENT, SessionEventSchema } from "@/domain";

describe("schema smoke", () => {
  it("keeps fixed two-scene sequence", () => {
    expect(CORE_SEQUENTIAL_ASSESSMENT.id).toBe("core-sequential-v1");
    expect(CORE_SEQUENTIAL_ASSESSMENT.sceneSequence).toEqual([
      "apartment-tradeoff",
      "brand-naming-sprint",
    ]);
  });

  it("parses append-only event schema", () => {
    const event = SessionEventSchema.parse({
      id: "evt_smoke",
      sessionId: "session_smoke",
      timestamp: "2026-03-31T00:00:00.000Z",
      type: "USER_MESSAGE",
      payload: {
        sceneId: "apartment-tradeoff",
        message: "I prioritize commute reliability over room size.",
      },
    });
    expect(event.type).toBe("USER_MESSAGE");
  });
});
