import { ConversationMessage } from '@/types';

interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function chatCompletion(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  temperature: number = 0.7
): Promise<LLMResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, temperature }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`LLM API error: ${response.status}`, error);
    throw new Error(`LLM API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  };
}

export function messagesToLLMFormat(conversationHistory: ConversationMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return conversationHistory.map((msg) => ({
    role: msg.role === 'agent' ? 'assistant' : 'user',
    content: msg.content,
  }));
}
