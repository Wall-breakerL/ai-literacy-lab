import { describe, expect, it } from "vitest";
import { composeAgentAResponse } from "@/server/engine/response-composer";

describe("Agent A unknown handling", () => {
  it("keeps unknowns explicit instead of fabricating facts", () => {
    const out = composeAgentAResponse({
      knownFacts: ["租金 5900", "通勤约 42 分钟"],
      openUnknowns: ["房东是否愿意修改合同宠物条款"],
      currentDraft: "主推 C，备选 A",
      nextMove: "先确认合同条款再最终拍板",
      tailType: "uncertainty",
    });
    expect(out.content).toContain("未知");
    expect(out.content).toContain("房东是否愿意修改合同宠物条款");
    expect(out.content).not.toContain("房东已经同意");
    expect(out.tailQuestion).toContain("保守假设");
  });
});

