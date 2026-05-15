"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { ParticleBackground } from "@/components/ParticleBackground";
import { FALLBACK_BATCHES_STORAGE_PREFIX } from "@/lib/analytics/shared";
import {
  createSessionStateFromIntake,
  validateIntakeForm,
  type IntakeForm,
} from "@/lib/intakeState";
import { scenarioOptionsForRole } from "@/lib/scenarioOptions";

const TOOL_OPTIONS = ["ChatGPT", "Claude", "Gemini", "文心一言", "通义千问", "豆包", "Kimi", "Copilot", "Cursor"];

const ROLE_OPTIONS = [
  "程序员/开发者",
  "产品经理",
  "设计师",
  "数据分析师",
  "编辑/运营",
  "市场/营销",
  "学生",
  "研究生/博士",
  "教师/讲师",
  "咨询/顾问",
  "销售/商务",
];

export default function IntakePage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [selectedRoleOption, setSelectedRoleOption] = useState<string | null>(null);
  const [customRole, setCustomRole] = useState("");
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [showCustomScenario, setShowCustomScenario] = useState(false);
  const [customScenario, setCustomScenario] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [customTool, setCustomTool] = useState("");
  const [error, setError] = useState("");

  const scenarioOptions = useMemo(() => scenarioOptionsForRole(selectedRoleOption), [selectedRoleOption]);

  const recentUse = useMemo(() => {
    const values = [...selectedScenarios];
    const custom = customScenario.trim();
    if (custom) values.push(custom);
    return values.join("、");
  }, [customScenario, selectedScenarios]);

  const form: IntakeForm = useMemo(() => ({
    role: role.trim() || "",
    recentUse,
    tools: customTool.trim() ? [...tools, customTool.trim()] : tools,
  }), [customTool, recentUse, role, tools]);

  const resetScenarios = () => {
    setSelectedScenarios([]);
    setCustomScenario("");
    setShowCustomScenario(false);
  };

  const toggleTool = (tool: string) => {
    setTools((current) => current.includes(tool) ? current.filter((item) => item !== tool) : [...current, tool]);
  };

  const toggleScenario = (scenario: string) => {
    setSelectedScenarios((current) => {
      if (current.includes(scenario)) return current.filter((item) => item !== scenario);
      return [...current, scenario].slice(0, 2);
    });
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
    sessionStorage.removeItem(FALLBACK_BATCHES_STORAGE_PREFIX);
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
            选择你的身份和常用场景，第一轮题目会直接围绕这个背景生成。
          </p>
        </div>

        <section className="rounded-[18px] border border-border/70 bg-surface-100/75 p-5 shadow-card-ring backdrop-blur-sm sm:p-7">
          <div className="grid gap-5">
            <div className="grid gap-3">
              <span className="text-sm font-semibold text-light-gray">职业 / 身份</span>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((roleOption) => {
                  const selected = selectedRoleOption === roleOption;
                  return (
                    <button
                      key={roleOption}
                      type="button"
                      onClick={() => {
                        setSelectedRoleOption(roleOption);
                        setRole(roleOption);
                        setCustomRole("");
                        resetScenarios();
                      }}
                      className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-sm transition ${
                        selected
                          ? "border-raycast-blue bg-raycast-blue/15 text-near-white shadow-[0_0_18px_rgba(85,179,255,0.18)]"
                          : "border-border/70 bg-card-surface text-dim-gray hover:border-raycast-blue/40 hover:text-light-gray"
                      }`}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      {roleOption}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoleOption("other");
                    setRole(customRole);
                    resetScenarios();
                  }}
                  className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-sm transition ${
                    selectedRoleOption === "other"
                      ? "border-raycast-blue bg-raycast-blue/15 text-near-white shadow-[0_0_18px_rgba(85,179,255,0.18)]"
                      : "border-border/70 bg-card-surface text-dim-gray hover:border-raycast-blue/40 hover:text-light-gray"
                  }`}
                >
                  {selectedRoleOption === "other" ? <Check className="h-3.5 w-3.5" /> : null}
                  其他...
                </button>
              </div>
              {selectedRoleOption === "other" && (
                <input
                  value={customRole}
                  onChange={(event) => {
                    setCustomRole(event.target.value);
                    setRole(event.target.value);
                  }}
                  placeholder="请输入你的职业，例如：宠物美容师、自由职业者"
                  className="h-12 rounded-[10px] border border-border/70 bg-card-surface px-4 text-sm text-near-white outline-none transition focus:border-raycast-blue"
                  autoFocus
                />
              )}
            </div>

            <div className="grid gap-3">
              <div>
                <span className="text-sm font-semibold text-light-gray">你主要想让题目围绕哪些 AI 使用场景？</span>
                <p className="mt-1 text-xs leading-relaxed text-dim-gray">
                  这些词条会用来生成第一轮问卷，让题目更贴近你的真实使用方式。最多选 2 个，也可以自己补充。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {scenarioOptions.map((scenario) => {
                  const selected = selectedScenarios.includes(scenario);
                  return (
                    <button
                      key={scenario}
                      type="button"
                      onClick={() => toggleScenario(scenario)}
                      className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-sm transition ${
                        selected
                          ? "border-raycast-green bg-raycast-green/15 text-near-white shadow-[0_0_18px_rgba(95,201,146,0.16)]"
                          : "border-border/70 bg-card-surface text-dim-gray hover:border-raycast-blue/40 hover:text-light-gray"
                      }`}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      {scenario}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    if (showCustomScenario) setCustomScenario("");
                    setShowCustomScenario((value) => !value);
                  }}
                  className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-sm transition ${
                    showCustomScenario
                      ? "border-raycast-green bg-raycast-green/15 text-near-white shadow-[0_0_18px_rgba(95,201,146,0.16)]"
                      : "border-border/70 bg-card-surface text-dim-gray hover:border-raycast-blue/40 hover:text-light-gray"
                  }`}
                >
                  {showCustomScenario ? <Check className="h-3.5 w-3.5" /> : null}
                  自己补充场景
                </button>
              </div>
              {showCustomScenario ? (
                <input
                  value={customScenario}
                  onChange={(event) => setCustomScenario(event.target.value)}
                  placeholder="比如：写小红书文案、整理实验记录、准备面试回答"
                  className="h-12 rounded-[10px] border border-border/70 bg-card-surface px-4 text-sm text-near-white outline-none transition focus:border-raycast-green"
                  autoFocus
                />
              ) : null}
            </div>

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
                          : "border-border/70 bg-card-surface text-dim-gray hover:border-raycast-blue/40 hover:text-light-gray"
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
                className="h-11 rounded-[10px] border border-border/70 bg-card-surface px-4 text-sm text-near-white outline-none transition focus:border-raycast-blue"
              />
            </div>
          </div>

          {error ? <p className="mt-5 text-sm text-raycast-red">{error}</p> : null}

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={submit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-near-white px-5 text-sm font-semibold text-void shadow-button-native transition hover:bg-light-gray"
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
