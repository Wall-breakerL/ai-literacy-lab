import { NextRequest, NextResponse } from "next/server";
import { AgentBOutput, Message, QuestionnaireAnswer } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as
      | {
          answers: QuestionnaireAnswer[];
          currentIndex: number;
          questions: { dimension: string; question: string; scenario: string; reverse?: boolean }[];
        }
      | null;

    if (!body || !Array.isArray(body.answers) || typeof body.currentIndex !== "number") {
      return NextResponse.json({ error: "bad_request", detail: "请求体格式错误" }, { status: 400 });
    }

    const { answers, currentIndex, questions } = body;
    const totalQuestions = questions.length;
    const isLastQuestion = currentIndex >= totalQuestions - 1;

    return NextResponse.json({
      receivedAnswer: answers[answers.length - 1],
      nextIndex: isLastQuestion ? -1 : currentIndex + 1,
      isComplete: isLastQuestion,
      progress: {
        current: currentIndex + 1,
        total: totalQuestions,
      },
    });
  } catch (error) {
    console.error("Questionnaire API error:", error);
    return NextResponse.json(
      { error: "Internal server error", detail: "问卷提交失败，请稍后重试。" },
      { status: 502 }
    );
  }
}
