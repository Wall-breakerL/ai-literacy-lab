#!/usr/bin/env node

const baseURL = process.argv[2] || process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1";
const apiKey = process.argv[3] || process.env.KIMI_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY;

if (!apiKey) {
  console.error("用法: KIMI_API_KEY=sk-xxx node scripts/test-kimi.mjs [base_url]");
  process.exit(1);
}

// 测试一个较复杂的问题（更接近真实项目使用场景）
const prompt = "请帮我评估一下：'我经常在团队会议中主动提出自己的想法，但有时会被别人打断。' 这段话体现的性格特征是什么？用50字回答。";

const configs = [
  { model: "moonshot-v1-auto", temperature: 0.7, maxTokens: 300 },
  { model: "moonshot-v1-32k", temperature: 0.7, maxTokens: 300 },
  { model: "moonshot-v1-128k", temperature: 0.7, maxTokens: 300 },
  { model: "kimi-k2.5", temperature: 1, maxTokens: 2000 }, // 思考型需要足够 tokens
  { model: "kimi-k2.6", temperature: 1, maxTokens: 2000 },
];

for (const c of configs) {
  console.log(`\n📡 ${c.model} (temp=${c.temperature}, max_tokens=${c.maxTokens})`);
  const timings = [];
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: c.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: c.maxTokens,
        temperature: c.temperature,
      }),
    });
    const elapsed = Date.now() - start;
    const data = await res.json();
    if (res.ok) {
      timings.push(elapsed);
      const content = data.choices?.[0]?.message?.content || "";
      const reasoning = data.choices?.[0]?.message?.reasoning_content;
      const usage = data.usage || {};
      console.log(`  ${i+1}: ✅ ${elapsed}ms | tokens in=${usage.prompt_tokens} out=${usage.completion_tokens} | ${reasoning ? '[有思维链]' : ''}`);
      console.log(`     回答: ${content.slice(0, 100)}`);
    } else {
      console.log(`  ${i+1}: ❌ HTTP ${res.status} -> ${JSON.stringify(data).slice(0, 150)}`);
    }
    if (i < 2) await new Promise(r => setTimeout(r, 800));
  }
  if (timings.length > 0) {
    const avg = Math.round(timings.reduce((a,b) => a+b, 0) / timings.length);
    console.log(`  📊 平均 ${avg}ms`);
  }
}
