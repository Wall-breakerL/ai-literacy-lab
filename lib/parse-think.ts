/**
 * 从模型返回的原始文本中剥离 <think>...</think> 并拆成「正文」与「思考过程」。
 */
export function parseAssistantResponse(raw: string): { content: string; thinking?: string } {
  const s = raw.trim();
  const thinkMatch = s.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    const thinking = thinkMatch[1].trim();
    const content = s
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
    return { content: content || "（无回复内容）", thinking: thinking || undefined };
  }
  return { content: s || "（无回复内容）" };
}
