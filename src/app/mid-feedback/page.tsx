"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, ListChecks } from "lucide-react";
import { ParticleBackground } from "@/components/ParticleBackground";
import {
  buildRefinedTargetContextFromFeedback,
  buildScenarioGuidanceFromForm,
  type MidFeedbackForm,
} from "@/lib/midFeedbackState";
import { scenarioOptionsForRole } from "@/lib/scenarioOptions";
import { applySessionStatePatch } from "@/lib/sessionState";
import type { QuestionnaireAnswer, SessionState } from "@/lib/types";

const SCALE_LABELS: Record<number, string> = {
  0: "完全不同意",
  1: "不同意",
  2: "有点不同意",
  3: "有点同意",
  4: "同意",
  5: "完全同意",
};

const FEELINGS: Array<{ value: MidFeedbackForm["overallFeeling"]; title: string; detail: string }> = [
  { value: "close", title: "挺贴近的", detail: "大部分题目说的就是我" },
  { value: "neutral", title: "一般", detail: "有的贴近，有的不太贴近" },
  { value: "far", title: "不太贴近", detail: "我的实际场景和这些不太一样" },
];

function readSessionState(): SessionState | null {
  try {
    const raw = sessionStorage.getItem("ai_mbti_session_state");
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

export default function MidFeedbackPage() {
  const router = useRouter();
  const [sessionState] = useState<SessionState | null>(() => readSessionState());
  const [overallFeeling, setOverallFeeling] = useState<MidFeedbackForm["overallFeeling"] | "">("");
  const [issueText, setIssueText] = useState("");
  const [selectedFocusScenarios, setSelectedFocusScenarios] = useState<string[]>([]);
  const [focusScenario, setFocusScenario] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [issueExpanded, setIssueExpanded] = useState(false);
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [error, setError] = useState("");

  const questions = useMemo(() => sessionState?.questionnaireBatches?.batch1 ?? [], [sessionState]);
  const answers = useMemo(() => sessionState?.batchAnswers?.batch1 ?? [], [sessionState]);
  const skippedCount = answers.filter((answer) => answer.skipped || answer.score == null).length;
  const scenarioOptions = useMemo(
    () => scenarioOptionsForRole(sessionState?.background.role),
    [sessionState?.background.role]
  );
  const focusScenarioText = useMemo(() => {
    const values = [...selectedFocusScenarios];
    const custom = focusScenario.trim();
    if (custom) values.push(custom);
    return values.join("、");
  }, [focusScenario, selectedFocusScenarios]);

  const reviewItems = useMemo(() => questions.map((question, index) => ({
    question,
    answer: answers[index],
  })), [answers, questions]);

  const insertQuestionRef = (number: number) => {
    setIssueText((current) => current ? `${current} 第 ${number} 题` : `第 ${number} 题`);
  };

  const toggleFocusScenario = (scenario: string) => {
    setSelectedFocusScenarios((current) => {
      if (current.includes(scenario)) return current.filter((item) => item !== scenario);
      return [...current, scenario].slice(0, 2);
    });
  };

  const submit = () => {
    if (!sessionState) {
      router.replace("/intake");
      return;
    }
    if (!overallFeeling) {
      setError("请选择第一轮整体感受。");
      return;
    }
    const guidance = buildScenarioGuidanceFromForm(
      { overallFeeling, issueText, focusScenario: focusScenarioText },
      sessionState.background.recentUse
    );
    const refinedTargetContext = buildRefinedTargetContextFromFeedback(sessionState, guidance);
    const nextState = applySessionStatePatch(
      sessionState,
      { scenarioGuidance: guidance, refinedTargetContext },
      { phase: "questionnaire_batch2" }
    );
    sessionStorage.setItem("ai_mbti_session_state", JSON.stringify(nextState));
    sessionStorage.setItem("ai_mbti_target_context", JSON.stringify(refinedTargetContext));
    router.push("/interview?phase=generating&batch=2");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-void text-near-white">
      <ParticleBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-raycast-green">中途反馈 / 3 of 4</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">快速校准一下</h1>
          <p className="mt-3 text-sm leading-relaxed text-dim-gray">你的反馈会让第二轮题目更贴近真实 AI 使用场景。</p>
        </div>

        <section className="rounded-[18px] border border-border/70 bg-surface-100/75 p-5 shadow-card-ring backdrop-blur-sm sm:p-7">
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-light-gray">刚才的题目和你的真实情况贴近吗？</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {FEELINGS.map((item) => {
                const selected = overallFeeling === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setOverallFeeling(item.value)}
                    className={`rounded-[12px] border p-4 text-left transition ${
                      selected ? "border-raycast-blue bg-raycast-blue/15" : "border-border/70 bg-card-surface hover:border-raycast-blue/40"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-near-white">{item.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-dim-gray">{item.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => setIssueExpanded((value) => !value)}
              aria-expanded={issueExpanded}
              className="flex items-center justify-between gap-4 rounded-[14px] border border-border/70 bg-card-surface px-4 py-3.5 text-left transition hover:border-raycast-blue/40"
            >
              <span>
                <span className="block text-sm font-semibold text-light-gray">我想说明不贴近的题目</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-dim-gray">
                  可选填写，帮助第二轮避开不适合你的题目方向。
                </span>
              </span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-dim-gray transition-transform ${issueExpanded ? "rotate-180" : ""}`} />
            </button>

            {issueExpanded ? (
              <div className="rounded-[16px] border border-border/70 bg-card-surface p-4">
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  aria-expanded={expanded}
                  className="group flex w-full items-center justify-between gap-4 rounded-[14px] border border-raycast-blue/35 bg-gradient-to-r from-raycast-blue/20 via-white/[0.06] to-raycast-green/15 px-4 py-3.5 text-left shadow-[0_0_0_1px_rgba(85,179,255,0.08),0_18px_42px_rgba(85,179,255,0.10)] transition hover:border-raycast-blue/70 hover:from-raycast-blue/30 hover:to-raycast-green/25"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-raycast-blue/20 text-raycast-blue ring-1 ring-raycast-blue/30">
                      <ListChecks className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-near-white">
                        {expanded ? "收起刚才的 8 道题" : "查看刚才的 8 道题"}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-dim-gray">
                        对照题目和你的选择，快速标记不贴近的地方
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border border-border/70 bg-surface-200/70 px-2.5 py-1 text-xs font-semibold text-light-gray">
                      {questions.length || 8} 题
                    </span>
                    <ChevronDown className={`h-5 w-5 text-light-gray transition-transform group-hover:text-near-white ${expanded ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {skippedCount >= 3 && !expanded ? (
                  <p className="mt-3 text-xs leading-relaxed text-dim-gray">
                    你刚才跳过了 {skippedCount} 题，如果想说明原因，可以点上面的按钮回看题目。
                  </p>
                ) : null}
                {expanded ? (
                  <div className="mt-4 grid gap-3">
                    {reviewItems.map(({ question, answer }, index) => (
                      <div key={`${question.dimension}-${index}`} className="grid grid-cols-[24px_1fr] gap-3 border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
                        <button
                          type="button"
                          onClick={() => insertQuestionRef(index + 1)}
                          className="h-6 rounded bg-surface-200/70 text-xs text-light-gray hover:bg-surface-200"
                        >
                          {index + 1}
                        </button>
                        <div>
                          <p className="text-sm leading-relaxed text-near-white">{question.question}</p>
                          <p className="mt-1 text-xs text-dim-gray">{formatAnswer(answer)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <label className="mt-5 grid gap-2">
                  <span className="text-sm font-semibold text-light-gray">有哪些题目让你觉得不清楚或不太贴近？</span>
                  <textarea
                    value={issueText}
                    onChange={(event) => setIssueText(event.target.value)}
                    placeholder="比如：第 3 题的场景我没遇到过 / 第 5 题问得太抽象了"
                    rows={3}
                    className="resize-none rounded-[10px] border border-border/70 bg-card-surface px-4 py-3 text-sm leading-relaxed text-near-white outline-none transition focus:border-raycast-blue"
                  />
                </label>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setFocusExpanded((value) => !value)}
              aria-expanded={focusExpanded}
              className="flex items-center justify-between gap-4 rounded-[14px] border border-border/70 bg-card-surface px-4 py-3.5 text-left transition hover:border-raycast-blue/40"
            >
              <span>
                <span className="block text-sm font-semibold text-light-gray">我想指定第二轮方向</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-dim-gray">
                  填写后，第二轮题目会更多围绕这个方向生成。
                </span>
              </span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-dim-gray transition-transform ${focusExpanded ? "rotate-180" : ""}`} />
            </button>

            {focusExpanded ? (
              <div className="grid gap-3 rounded-[16px] border border-border/70 bg-card-surface p-4">
                <div>
                  <span className="text-sm font-semibold text-light-gray">第二轮你希望多看到哪类场景？</span>
                  <p className="mt-1 text-xs leading-relaxed text-dim-gray">
                    这些词条会作为第二轮题目的方向提示，让问题更集中地围绕你想校准的 AI 使用场景。最多选 2 个，也可以自己补充。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {scenarioOptions.map((scenario) => {
                    const selected = selectedFocusScenarios.includes(scenario);
                    return (
                      <button
                        key={scenario}
                        type="button"
                        onClick={() => toggleFocusScenario(scenario)}
                        className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-sm transition ${
                          selected
                            ? "border-raycast-green bg-raycast-green/15 text-near-white shadow-[0_0_18px_rgba(95,201,146,0.16)]"
                            : "border-border/70 bg-surface-100 text-dim-gray hover:border-raycast-blue/40 hover:text-light-gray"
                        }`}
                      >
                        {selected ? <Check className="h-3.5 w-3.5" /> : null}
                        {scenario}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={focusScenario}
                  onChange={(event) => setFocusScenario(event.target.value)}
                  placeholder="也可以补充更具体的方向，比如：调试代码、和客户沟通..."
                  rows={3}
                  className="resize-none rounded-[10px] border border-border/70 bg-card-surface px-4 py-3 text-sm leading-relaxed text-near-white outline-none transition focus:border-raycast-blue"
                />
              </div>
            ) : null}
          </div>

          {error ? <p className="mt-5 text-sm text-raycast-red">{error}</p> : null}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={submit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-near-white px-5 text-sm font-semibold text-void shadow-button-native transition hover:bg-light-gray"
            >
              继续第二轮
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function formatAnswer(answer: QuestionnaireAnswer | undefined): string {
  if (!answer || answer.skipped || answer.score == null) return "你的回答：已跳过";
  return `你的回答：${answer.score} 分（${SCALE_LABELS[answer.score] ?? "已选择"}）`;
}
