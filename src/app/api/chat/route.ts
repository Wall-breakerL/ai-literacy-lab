import { NextRequest, NextResponse } from 'next/server';

const API_ENDPOINT = process.env.MINIMAX_API_ENDPOINT || 'https://api.minimaxi.com/v1';
const API_KEY = process.env.MINIMAX_API_KEY;

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { messages, temperature = 0.7 } = body;

    const response = await fetch(`${API_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: `API error: ${response.status} ${error}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
