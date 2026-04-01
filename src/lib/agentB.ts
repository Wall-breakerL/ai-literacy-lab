import { chatCompletion } from './llm';
import { ConversationMessage, EvaluationResult, FAAScore, MBTIScore, Profile } from '@/types';
import { OPTIMAL_SOLUTIONS } from '@/data/housing';

const SYSTEM_PROMPT = `你是一个助手，负责从对话中提取信息。

输出JSON格式，不要其他内容：
{"selectedHouse": "A-F或null", "reasonGiven": true/false}`;

const USER_PROGRESS_PROMPT = `分析以下对话，判断用户当前状态：

{DIALOGUE}

用户说了选哪个房源吗？说了选房理由吗？

输出JSON：{"selectedHouse": "A-F或null", "reasonGiven": true/false}`;

// 轻量级进度检查
export async function checkProgress(
  conversationHistory: ConversationMessage[]
): Promise<{ selectedHouse: string | null; reasonGiven: boolean }> {
  const dialogue = conversationHistory
    .map((m) => `${m.role === 'agent' ? 'AI' : '用户'}: ${m.content}`)
    .join('\n');

  const prompt = USER_PROGRESS_PROMPT.replace('{DIALOGUE}', dialogue);

  try {
    const result = await chatCompletion([
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: prompt },
    ], 0.1);

    const jsonMatch = result.content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          selectedHouse: parsed.selectedHouse || null,
          reasonGiven: parsed.reasonGiven === true,
        };
      } catch {
        // 解析失败，尝试从文本中提取
      }
    }

    // 备用：从关键词检测
    return extractProgressFromKeywords(dialogue);
  } catch (error) {
    console.error('Error checking progress:', error);
    return { selectedHouse: null, reasonGiven: false };
  }
}

// 备用：从对话关键词提取进度
function extractProgressFromKeywords(dialogue: string): { selectedHouse: string | null; reasonGiven: boolean } {
  const lower = dialogue.toLowerCase();

  // 检测选择
  const selectPatterns = [/选([A-F])/i, /就([A-F])/i, /([A-F])吧/i, /([A-F])就行/i];
  let selectedHouse: string | null = null;

  for (const pattern of selectPatterns) {
    const match = lower.match(pattern);
    if (match) {
      selectedHouse = match[1].toUpperCase();
      break;
    }
  }

  // 检测理由
  const reasonPatterns = [
    /因为(.+)/i,
    /理由是(.+)/i,
    /为什么选(.+)/i,
  ];
  let reasonGiven = false;

  for (const pattern of reasonPatterns) {
    if (pattern.test(dialogue)) {
      reasonGiven = true;
      break;
    }
  }

  return { selectedHouse, reasonGiven };
}

// 完整评估（最后使用）
const EVAL_SYSTEM_PROMPT = `你是一个专业的心理学分析师。你必须始终以有效的JSON格式输出评估结果，不要输出任何其他内容。

JSON格式：
{"faa":{"frame": 0-100数字, "ask": 0-100数字, "review": 0-100数字, "edit": 0-100数字, "synthesize": 0-100数字},"mbti":{"relation": 0-100数字, "workflow": 0-100数字, "epistemic": 0-100数字, "repairScope": 0-100数字},"profile":{"summary": "简短描述", "tags": ["标签1", "标签2"]}}`;

const EVAL_USER_PROMPT = `分析用户选择行为。

对话：
{DIALOGUE}

用户选择了：{SELECTED_HOUSE}
用户是否给出了理由：{REASON_GIVEN}

输出JSON。`;

function tryParseJSON(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractNumbers(text: string, field: string): number {
  const patterns = [
    new RegExp(`"${field}"\\s*:\\s*(\\d+\\.?\\d*)`),
    new RegExp(`${field}[^0-9]*(\\d+)`),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseFloat(match[1]);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        return Math.round(num);
      }
    }
  }
  return 50;
}

function extractString(text: string, field: string): string {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`);
  const match = text.match(pattern);
  return match ? match[1] : '评估完成';
}

function extractTags(text: string): string[] {
  const pattern = new RegExp(`"tags"\\s*:\\s*\\[([^\\]]+)\\]`);
  const match = text.match(pattern);
  if (match) {
    const tags = match[1].match(/"([^"]+)"/g);
    if (tags) {
      return tags.map(t => t.replace(/"/g, ''));
    }
  }
  return [];
}

export async function evaluate(
  conversationHistory: ConversationMessage[],
  selectedHouse: string | null,
  reasonGiven: boolean
): Promise<EvaluationResult> {
  if (!selectedHouse) {
    return createFallbackResult(null);
  }

  const dialogue = conversationHistory
    .map((m) => `${m.role === 'agent' ? 'AI' : '用户'}: ${m.content}`)
    .join('\n');

  const prompt = EVAL_USER_PROMPT
    .replace('{DIALOGUE}', dialogue)
    .replace('{SELECTED_HOUSE}', selectedHouse)
    .replace('{REASON_GIVEN}', reasonGiven ? '是' : '否');

  try {
    const result = await chatCompletion([
      { role: 'system' as const, content: EVAL_SYSTEM_PROMPT },
      { role: 'user' as const, content: prompt },
    ], 0.1);

    let parsed = tryParseJSON(result.content);

    if (!parsed) {
      // 尝试从文本提取
      const content = result.content;
      parsed = {
        faa: {
          frame: extractNumbers(content, 'frame'),
          ask: extractNumbers(content, 'ask'),
          review: extractNumbers(content, 'review'),
          edit: extractNumbers(content, 'edit'),
          synthesize: extractNumbers(content, 'synthesize'),
        },
        mbti: {
          relation: extractNumbers(content, 'relation'),
          workflow: extractNumbers(content, 'workflow'),
          epistemic: extractNumbers(content, 'epistemic'),
          repairScope: extractNumbers(content, 'repairScope'),
        },
        profile: {
          summary: extractString(content, 'summary'),
          tags: extractTags(content),
        },
      };
    }

    const isOptimal = OPTIMAL_SOLUTIONS.includes(selectedHouse);

    const faa = {
      frame: Math.min(100, Math.max(0, Number(parsed.faa?.frame) || 50)),
      ask: Math.min(100, Math.max(0, Number(parsed.faa?.ask) || 50)),
      review: Math.min(100, Math.max(0, Number(parsed.faa?.review) || 50)),
      edit: Math.min(100, Math.max(0, Number(parsed.faa?.edit) || 50)),
      synthesize: Math.min(100, Math.max(0, Number(parsed.faa?.synthesize) || 50)),
    };

    const mbti = {
      relation: Math.min(100, Math.max(0, Number(parsed.mbti?.relation) || 50)),
      workflow: Math.min(100, Math.max(0, Number(parsed.mbti?.workflow) || 50)),
      epistemic: Math.min(100, Math.max(0, Number(parsed.mbti?.epistemic) || 50)),
      repairScope: Math.min(100, Math.max(0, Number(parsed.mbti?.repairScope) || 50)),
    };

    const faaTotal = faa.frame * 0.2 + faa.ask * 0.15 + faa.review * 0.2 + faa.edit * 0.15 + faa.synthesize * 0.3;

    return {
      faa: { ...faa, total: Math.round(faaTotal * 10) / 10 },
      mbti,
      profile: {
        summary: parsed.profile?.summary || '评估完成',
        tags: Array.isArray(parsed.profile?.tags) ? parsed.profile.tags : [],
      },
      decision: { choice: selectedHouse, isOptimal },
    };
  } catch (error) {
    console.error('Evaluation error:', error);
    return createFallbackResult(selectedHouse);
  }
}

function createFallbackResult(selectedHouse: string | null): EvaluationResult {
  const isOptimal = selectedHouse ? OPTIMAL_SOLUTIONS.includes(selectedHouse) : false;

  const faa: FAAScore = {
    frame: 50,
    ask: 50,
    review: 50,
    edit: 50,
    synthesize: 50,
    total: 50,
  };

  const mbti: MBTIScore = {
    relation: 50,
    workflow: 50,
    epistemic: 50,
    repairScope: 50,
  };

  const profile: Profile = {
    summary: '评估完成',
    tags: [],
  };

  return {
    faa,
    mbti,
    profile,
    decision: {
      choice: selectedHouse || '未知',
      isOptimal,
    },
  };
}
