import { chatCompletion, messagesToLLMFormat } from './llm';
import { ConversationMessage } from '@/types';
import { SOFT_CONSTRAINTS } from '@/data/constraints';

const SOFT_CONSTRAINT_NAMES = SOFT_CONSTRAINTS.map((c) => c.name);

const SYSTEM_PROMPT = `你是一个专业的租房助手，正在帮助用户从6套房源中选择最合适的一套。

房源信息：
- A: 价格4500,面积80㎡,地铁1200米,精装,5年房龄,低层,医院300米
- B: 价格5100,面积75㎡,地铁650米,精装,6年房龄,高层,医院800米
- C: 价格6000,面积70㎡,地铁400米,精装,8年房龄,低层,商场200米
- D: 价格4200,面积90㎡,地铁1500米,毛坯,20年房龄,中层,超市500米
- E: 价格4900,面积65㎡,地铁300米,简装,10年房龄,低层,学校100米
- F: 价格4800,面积55㎡,地铁200米,简装,20年房龄,高层,商场600米

用户约束：
- 硬约束：价格 ≤ 5500元/月
- 软约束：地铁≤600米,面积≥60㎡,简装或精装,房龄≤15年,中高层

最优解是B和E（B交通略远但其他都好，E楼层略低但综合最优）。

【重要】你的任务是：
1. 友好地帮助用户了解房源信息
2. 不要直接告诉用户哪个是最优解，让用户自己判断
3. 如果用户做出选择，自然地追问一句"为什么选这套？"
4. 可以适当表达不确定性，让用户自己做决定
5. 如果用户问区别，可以帮助对比，但不要直接给答案

对话要自然，不要太刻意。

【重要】不要输出思考过程（think标签），只输出对话内容。`;

export async function getAgentResponse(
  conversationHistory: ConversationMessage[],
  userMessage: string
): Promise<string> {
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...messagesToLLMFormat(conversationHistory),
    { role: 'user' as const, content: userMessage },
  ];

  const result = await chatCompletion(messages, 0.7);
  return filterThinkContent(result.content);
}

function filterThinkContent(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}
