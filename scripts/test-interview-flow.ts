/**
 * AI-MBTI 完整流程自动测试脚本
 *
 * 运行方式：
 *   npx ts-node --esm scripts/test-interview-flow.ts
 *
 * 测试内容：
 * 1. 聊天阶段（4轮对话）
 * 2. 问卷阶段（滑动刻度题）
 * 3. 报告生成
 *
 * 模拟用户：前端开发工程师，熟悉 AI 编程工具
 */

const API_BASE = process.env.API_BASE || "http://localhost:3000";

// 基于轮次的回答策略
const ROUND_RESPONSES: Record<number, string> = {
  // 第1轮：介绍身份和背景，同时嵌入维度信号
  // 策略：直接说明工作方式和验证习惯，让 Agent B 能立即提取信号
  0: "我是前端开发，用 Cursor 写代码。我习惯先和 AI 讨论整体架构，确认方向对了再让它写具体代码。写完我会跑一下验证，有问题就局部改，方向错了就重开对话。",
  // 第2轮：继续深入 Relation/Workflow/Epistemic/RepairScope
  1: "我一般会先把函数签名和参数写好，再让 AI 补全逻辑。这样能确保大方向不会跑偏。如果有问题我会让它局部修改，或者重开对话重新来。",
  // 第3轮：进一步阐述验证和修复策略
  2: "我通常会明确告诉AI我的约束条件和预期结果，比如'这个函数要在O(n)时间内完成'。写完会验证，不符合就局部改。",
};

// 维度到回答的映射（用于 fallback）
const DIMENSION_RESPONSES: Record<string, string> = {
  Relation: "我会把AI当作可以一起讨论问题的伙伴，不只是执行指令的工具。",
  Workflow: "我会先定好框架再让AI执行，这样方向不会跑偏。",
  Epistemic: "我会验证AI说的，运行一下看看效果，特别是边界条件。",
  RepairScope: "小问题就局部改，大问题我会重开对话重新来。",
};

// 根据 Agent A 的问题关键词匹配回答
function matchByKeywords(text: string, round: number): string | null {
  const t = text.toLowerCase();

  // 第0轮：身份开场
  if (round === 0) {
    return ROUND_RESPONSES[0];
  }

  // 验证/检查/运行/边界/测试 - 关于代码验证
  if (t.includes("验证") || t.includes("检查") || t.includes("运行") || t.includes("跑") || t.includes("测试")) {
    return "写完代码我会实际跑一下，验证输出是否符合预期，特别是边界条件。如果有问题就让AI局部修改。";
  }

  // 出错/报错/重开/调试/问题 - 关于修复策略
  if (t.includes("出错") || t.includes("报错") || t.includes("重开") || t.includes("调试") || t.includes("问题") || t.includes("跑不通") || t.includes("方向错了")) {
    return "小问题让AI局部改，大问题（方向错了）就重开对话重新来。";
  }

  // 讨论/架构/骨架/伙伴/对齐 - 关于协作方式
  if (t.includes("讨论") || t.includes("架构") || t.includes("骨架") || t.includes("伙伴") || t.includes("对齐") || t.includes("结对")) {
    return "我会先和AI讨论整体架构，确认方向对了再让它写具体代码。我觉得这样比直接下指令效果更好。";
  }

  // 实习生/布置任务/语气/步骤 - 关于交互风格
  if (t.includes("实习生") || t.includes("布置任务") || t.includes("语气") || t.includes("步骤")) {
    return "有时候会用比较明确的指令，比如'请按三步来做'。但大多数时候还是更偏向讨论型，感觉这样AI更容易理解我的意图。";
  }

  // 真人/同事/结对/和真人比/有什么不同 - 关于人机协作感受
  if (t.includes("真人") || t.includes("同事") || t.includes("结对") || t.includes("和真人") || t.includes("有什么不同")) {
    return "和AI讨论更轻松，不用担心问蠢问题。但AI有时候会一本正经地说错话，这点比真人同事更不靠谱。";
  }

  // 框架/签名/约束/规则/预期 - 关于工作流程
  if (t.includes("框架") || t.includes("签名") || t.includes("约束") || t.includes("规则") || t.includes("预期") || t.includes("参数")) {
    return ROUND_RESPONSES[1];
  }

  // 默认用基于轮次的回答
  return ROUND_RESPONSES[round] || DIMENSION_RESPONSES[Object.keys(DIMENSION_RESPONSES)[Math.floor(Math.random() * 4)]];
}

interface ChatResponse {
  agentAMessage: string;
  agentBOutput: {
    analysis: {
      reasoning: string;
      signals_detected: { dimension: string; strength: string; tendency: string }[];
      current_status: string;
      coverage: Record<string, string>;
    };
    directive: {
      action: string;
      target_dimension?: string;
      hint?: string;
    };
    nextQuestions?: {
      dimension: string;
      question: string;
      scenario: string;
      reverse?: boolean;
    }[];
  };
  isComplete: boolean;
  nextPhase?: string;
  questions?: {
    dimension: string;
    question: string;
    scenario: string;
    reverse?: boolean;
  }[];
}

interface TestResult {
  phase: "chat" | "questionnaire" | "report" | "error";
  round?: number;
  questionIndex?: number;
  question?: string;
  userResponse?: string;
  agentMessage?: string;
  coverage?: Record<string, string>;
  directive?: string;
  issues: string[];
}

class InterviewTester {
  private results: TestResult[] = [];
  private messages: { role: "user" | "assistant"; content: string }[] = [];
  private roundCount = 0;
  private currentPhase: "chat" | "questionnaire" | "report" = "chat";

  async run() {
    console.log("=".repeat(60));
    console.log("AI-MBTI 完整流程自动测试");
    console.log("=".repeat(60));
    console.log();

    try {
      // 阶段1：聊天访谈
      await this.runChatPhase();

      // 阶段2：问卷
      await this.runQuestionnairePhase();

      // 阶段3：报告
      await this.runReportPhase();

      // 输出结果
      this.printResults();
    } catch (error) {
      console.error("\n❌ 测试过程中发生错误：", error);
      this.results.push({
        phase: "error",
        issues: [`运行时错误: ${error}`],
      });
      this.printResults();
    }
  }

  private async callChatApi(messages: { role: "user" | "assistant"; content: string }[]): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, roundCount: this.roundCount }),
    });

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async callReportApi(answers: { dimension: string; score: number }[]) {
    const response = await fetch(`${API_BASE}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: "测试用户", questionnaireAnswers: answers }),
    });

    if (!response.ok) {
      throw new Error(`报告 API 请求失败: ${response.status}`);
    }

    return response.json();
  }

  private findResponse(text: string): string | null {
    // 使用轮次+关键词双层匹配
    return matchByKeywords(text, this.roundCount - 1);
  }

  private async runChatPhase() {
    console.log("📍 阶段 1：聊天访谈阶段");
    console.log("-".repeat(40));

    while (this.currentPhase === "chat") {
      const result: TestResult = {
        phase: "chat",
        round: this.roundCount,
        issues: [],
      };

      // 调用 API
      const chatResponse = await this.callChatApi(this.messages);
      this.roundCount++;

      result.agentMessage = chatResponse.agentAMessage;
      result.coverage = chatResponse.agentBOutput.analysis.coverage;
      result.directive = chatResponse.agentBOutput.directive.action;

      console.log(`\n【第 ${this.roundCount} 轮】`);
      console.log(`🤖 Agent: ${chatResponse.agentAMessage}`);
      console.log(`📊 覆盖状态: ${JSON.stringify(chatResponse.agentBOutput.analysis.coverage)}`);
      console.log(`📋 指令: ${chatResponse.agentBOutput.directive.action}`);

      // 检查是否进入问卷阶段
      if (chatResponse.nextPhase === "questionnaire" && chatResponse.questions) {
        console.log(`\n✅ 聊天阶段完成，检测到 start_questionnaire 指令`);
        console.log(`📝 收到 ${chatResponse.questions.length} 道问卷题目`);
        this.currentPhase = "questionnaire";
        this.questions = chatResponse.questions;
        break;
      }

      // 生成用户回答
      const userResponse = this.findResponse(chatResponse.agentAMessage) ||
        "这个要看情况，有时候会直接用，有时候会先讨论一下。";

      result.userResponse = userResponse;
      console.log(`👤 用户: ${userResponse}`);

      // 检查问题
      if (!userResponse || userResponse.length < 10) {
        result.issues.push("用户回答过短，可能缺乏有效信息");
      }

      if (chatResponse.agentBOutput.directive.action === "clarify") {
        result.issues.push("收到 clarify 指令，可能用户回答不够明确");
      }

      // 记录消息
      this.messages.push({ role: "assistant", content: chatResponse.agentAMessage });
      this.messages.push({ role: "user", content: userResponse });

      this.results.push(result);

      // 检查是否结束
      if (chatResponse.isComplete || this.roundCount >= 10) {
        console.log(`\n⚠️ 聊天阶段达到结束条件（isComplete=${chatResponse.isComplete}, rounds=${this.roundCount}）`);
        break;
      }
    }
  }

  private questions: { dimension: string; question: string; scenario: string; reverse?: boolean }[] = [];
  private questionIndex = 0;
  private answers: { dimension: string; score: number }[] = [];

  private async runQuestionnairePhase() {
    if (this.currentPhase !== "questionnaire" || this.questions.length === 0) {
      return;
    }

    console.log(`\n📍 阶段 2：问卷阶段`);
    console.log("-".repeat(40));

    while (this.questionIndex < this.questions.length) {
      const q = this.questions[this.questionIndex];
      const result: TestResult = {
        phase: "questionnaire",
        questionIndex: this.questionIndex,
        question: q.question,
        issues: [],
      };

      console.log(`\n【问卷 ${this.questionIndex + 1}/${this.questions.length}】`);
      console.log(`📋 维度: ${q.dimension}`);
      console.log(`🏷️ 场景: ${q.scenario}`);
      console.log(`❓ ${q.question}`);

      // 模拟用户回答（5级量表）
      // 策略：根据维度选择分数（加 break 防止 fallthrough）
      let score: number;
      switch (q.dimension) {
        case "Relation":
          score = 4; // 偏伙伴型
          break;
        case "Workflow":
          score = 3; // 中间
          break;
        case "Epistemic":
          score = 5; // 审计型，会验证
          break;
        case "RepairScope":
          score = 3; // 偏局部
          break;
        default:
          score = 3;
      }

      // 如果是反向题，取反向分数（6选项：1->6, 2->5, 3->4, 4->3, 5->2, 6->1）
      if (q.reverse) {
        score = 7 - score;
      }

      const scoreLabel = ["肯定不会", "一般不会", "偶尔会", "经常会", "通常会", "肯定会"][score - 1];
      console.log(`👤 选择: ${score} (${scoreLabel})`);

      this.answers.push({ dimension: q.dimension, score });
      this.questionIndex++;

      result.userResponse = `${score} (${scoreLabel})`;
      this.results.push(result);
    }

    console.log(`\n✅ 问卷完成，共回答 ${this.answers.length} 题`);
  }

  private async runReportPhase() {
    console.log(`\n📍 阶段 3：报告生成`);
    console.log("-".repeat(40));

    try {
      const report = await this.callReportApi(this.answers);
      console.log(`\n📊 报告生成成功`);
      console.log(`📝 摘要: ${report.summary}`);
      console.log(`🏷️ 标签: ${report.tags?.join(", ")}`);
      console.log(`\n📋 维度详情:`);

      for (const dim of report.dimensions || []) {
        console.log(`  - ${dim.dimension}: ${dim.tendencyLabel} (${dim.score}分)`);
      }

      this.results.push({
        phase: "report",
        issues: [],
      });
    } catch (error) {
      console.error(`\n❌ 报告生成失败:`, error);
      this.results.push({
        phase: "report",
        issues: [`报告生成失败: ${error}`],
      });
    }
  }

  private printResults() {
    console.log("\n" + "=".repeat(60));
    console.log("📋 测试结果汇总");
    console.log("=".repeat(60));

    // 统计问题
    const allIssues = this.results.flatMap((r) => r.issues);
    const issueCount = allIssues.length;

    console.log(`\n总轮次: ${this.results.length}`);
    console.log(`问题数量: ${issueCount}`);

    if (issueCount > 0) {
      console.log(`\n⚠️ 发现的问题:`);
      allIssues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    } else {
      console.log(`\n✅ 未发现明显问题`);
    }

    // 聊天阶段覆盖状态
    const chatResults = this.results.filter((r) => r.phase === "chat");
    if (chatResults.length > 0) {
      const lastCoverage = chatResults[chatResults.length - 1].coverage;
      console.log(`\n📊 最终覆盖状态:`);
      Object.entries(lastCoverage || {}).forEach(([dim, status]) => {
        const icon = status === "covered" ? "✅" : status === "weak" ? "⚠️" : "❌";
        console.log(`  ${icon} ${dim}: ${status}`);
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("详细记录");
    console.log("=".repeat(60));

    for (const result of this.results) {
      if (result.phase === "chat") {
        console.log(`\n【第 ${result.round} 轮聊天】`);
        console.log(`  Agent: ${result.agentMessage}`);
        console.log(`  用户: ${result.userResponse}`);
        console.log(`  指令: ${result.directive}`);
        if (result.issues.length > 0) {
          console.log(`  ⚠️ 问题: ${result.issues.join(", ")}`);
        }
      } else if (result.phase === "questionnaire") {
        console.log(`\n【问卷 ${result.questionIndex}】`);
        console.log(`  问题: ${result.question}`);
        console.log(`  回答: ${result.userResponse}`);
        if (result.issues.length > 0) {
          console.log(`  ⚠️ 问题: ${result.issues.join(", ")}`);
        }
      } else if (result.phase === "error") {
        console.log(`\n【错误】`);
        console.log(`  ${result.issues.join(", ")}`);
      }
    }

    console.log("\n" + "=".repeat(60));
  }
}

// 检查服务器是否可用
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/`);
    return true;
  } catch {
    console.error(`\n❌ 无法连接到 ${API_BASE}`);
    console.error("请确保开发服务器正在运行：npm run dev");
    process.exit(1);
  }
}

async function main() {
  await checkServer();
  const tester = new InterviewTester();
  await tester.run();
}

main().catch(console.error);
