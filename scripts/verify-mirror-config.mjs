#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const baseURL = env.OPENAI_COMPATIBLE_BASE_URL;
const apiKey = env.OPENAI_COMPATIBLE_API_KEY;
const model = env.ASSISTANT_RESEARCHER_MODEL || 'kimi-k2.5';
const forceTemp = env.OPENAI_COMPATIBLE_FORCE_TEMPERATURE
  ? Number(env.OPENAI_COMPATIBLE_FORCE_TEMPERATURE)
  : undefined;

console.log('🔍 验证环境配置...\n');
console.log(`📍 Base URL: ${baseURL}`);
console.log(`🔑 API Key: ${apiKey?.slice(0, 10)}...${apiKey?.slice(-6)}`);
console.log(`📦 Model: ${model}`);
console.log(`🌡️  Force Temperature: ${forceTemp ?? '(未强制)'}`);
console.log(`💾 Cache: ${env.ENABLE_PROMPT_CACHE === '1' ? '启用' : '禁用'}\n`);

console.log('🚀 测试 API 连接...\n');

const start = Date.now();
try {
  const body = {
    model,
    messages: [{ role: 'user', content: '你好，请用中文回复一个简短的问候' }],
    max_tokens: 2000,
  };
  if (forceTemp !== undefined) body.temperature = forceTemp;

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const elapsed = Date.now() - start;
  const data = await res.json();

  if (res.ok) {
    console.log(`✅ 连接成功！耗时: ${elapsed}ms\n`);
    console.log('📝 API 响应:');
    console.log(`   模型: ${data.model}`);
    const msg = data.choices?.[0]?.message;
    console.log(`   内容: ${msg?.content || '(无内容)'}`);
    if (msg?.reasoning_content) {
      console.log(`   思维链: ${msg.reasoning_content.slice(0, 150)}...`);
    }
    console.log(`   Token: 输入 ${data.usage?.prompt_tokens}, 输出 ${data.usage?.completion_tokens}, 缓存命中 ${data.usage?.cached_tokens ?? 0}`);
    console.log('\n🎉 配置成功！');
  } else {
    console.log(`❌ 请求失败 (HTTP ${res.status})`);
    console.log(`   错误: ${JSON.stringify(data, null, 2)}`);
  }
} catch (err) {
  console.log(`❌ 连接失败: ${err.message}`);
}
