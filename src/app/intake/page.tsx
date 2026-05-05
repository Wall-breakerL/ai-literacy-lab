"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { ParticleBackground } from "@/components/ParticleBackground";
import {
  createSessionStateFromIntake,
  validateIntakeForm,
  type IntakeForm,
} from "@/lib/intakeState";

const TOOL_OPTIONS = ["ChatGPT", "Claude", "Gemini", "文心一言", "通义千问", "豆包", "Kimi", "Copilot", "Cursor"];

export default function IntakePage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [recentUse, setRecentUse] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [customTool, setCustomTool] = useState("");
  const [error, setError] = useState("");

  const form: IntakeForm = useMemo(() => ({
    role,
    recentUse,
    tools: customTool.trim() ? [...tools, customTool.trim()] : tools,
  }), [customTool, recentUse, role, tools]);

  const toggleTool = (tool: string) => {
    setTools((current) => current.includes(tool) ? current.filter((item) => item !== tool) : [...current, tool]);
  };

  const submit = () => {
    const validation = validateIntakeForm(form);
    if (validation) {
      setError(validation);
      return;
    }
    const state = createSessionStateFromIntake(form);
    sessionStorage.setItem("ai_mbti_session_state", JSON.stringify(state));
    sessionStorage.setItem("ai_mbti_identity", state.background.role);
    sessionStorage.setItem("ai_mbti_target_context", JSON.stringify({
      role: state.background.role,
      tools: state.background.tools,
      recentUse: state.background.recentUse,
      goal: state.background.goal,
    }));
    sessionStorage.removeItem("ai_mbti_answers");
    router.push("/interview?phase=generating&batch=1");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-void text-near-white">
      <ParticleBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-raycast-blue">信息收集 / 1 of 4</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">先给测评一个真实起点</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-dim-gray">
            填一个具体 AI 使用经历，第一轮题目会直接围绕这个背景生成。
          </p>
        </div>

        <section className="rounded-[18px] border border-white/10 bg-surface-100/75 p-5 shadow-card-ring backdrop-blur-sm sm:p-7">
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-light-gray">职业 / 身份</span>
              <input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="例如：产品经理、前端工程师、材料系研究生"
                className="h-12 rounded-[10px] border border-white/10 bg-card-surface px-4 text-sm text-near-white outline-none transition focus:border-raycast-blue"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-light-gray">具体 AI 使用经历</span>
              <textarea
                value={recentUse}
                onChange={(event) => setRecentUse(event.target.value)}
                placeholder="请描述一个具体场景，比如你用 AI 做了什么、遇到了什么问题"
                rows={4}
                className="resize-none rounded-[10px] border border-white/10 bg-card-surface px-4 py-3 text-sm leading-relaxed text-near-white outline-none transition focus:border-raycast-blue"
              />
            </label>

            <div className="grid gap-3">
              <span className="text-sm font-semibold text-light-gray">常用 AI 工具</span>
              <div className="flex flex-wrap gap-2">
                {TOOL_OPTIONS.map((tool) => {
                  const selected = tools.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => toggleTool(tool)}
                      className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-sm transition ${
                        selected
                          ? "border-raycast-blue bg-raycast-blue/15 text-near-white shadow-[0_0_18px_rgba(85,179,255,0.18)]"
                          : "border-white/10 bg-card-surface text-dim-gray hover:border-white/20 hover:text-light-gray"
                      }`}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      {tool}
                    </button>
                  );
                })}
              </div>
              <input
                value={customTool}
                onChange={(event) => setCustomTool(event.target.value)}
                placeholder="其他工具（可选）"
                className="h-11 rounded-[10px] border border-white/10 bg-card-surface px-4 text-sm text-near-white outline-none transition focus:border-raycast-blue"
              />
            </div>
          </div>

          {error ? <p className="mt-5 text-sm text-raycast-red">{error}</p> : null}

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={submit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-white px-5 text-sm font-semibold text-void shadow-button-native transition hover:bg-light-gray"
            >
              生成第一轮问卷
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
