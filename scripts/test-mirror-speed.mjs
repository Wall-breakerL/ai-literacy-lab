#!/usr/bin/env node
/**
 * 测试 Claude API 镜像的速度和稳定性
 *
 * Usage: node scripts/test-mirror-speed.mjs <base_url> <api_key> [model]
 * Example: node scripts/test-mirror-speed.mjs https://hk.n1n.ai sk-xxx claude-3-5-sonnet-20241022
 */

const baseURL = process.argv[2];
const apiKey = process.argv[3];
const model = process.argv[4] || 'claude-3-5-sonnet-20241022';

if (!baseURL || !apiKey) {
  console.error('❌ 用法: node scripts/test-mirror-speed.mjs <base_url> <api_key> [model]');
  process.exit(1);
}

console.log('🔍 镜像速度测试\n');
console.log(`📍 Base URL: ${baseURL}`);
console.log(`🔑 API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-6)}`);
console.log(`📦 Model: ${model}\n`);

// 测试配置
const testCases = [
  { name: '简单问候', content: '你好', maxTokens: 50 },
  { name: '中等长度', content: '请用100字左右介绍一下人工智能的发展历史', maxTokens: 500 },
  { name: '代码生成', content: '用 JavaScript 写一个快速排序函数', maxTokens: 1000 },
];

const results = [];

async function testRequest(testCase, attempt = 1) {
  const start = Date.now();

  try {
    const response = await fetch(`${baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: testCase.maxTokens,
        messages: [{ role: 'user', content: testCase.content }],
      }),
    });

    const elapsed = Date.now() - start;
    const data = await response.json();

    if (response.ok) {
      const text = data.content
        ?.filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      const usage = data.usage || {};

      return {
        success: true,
        elapsed,
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        responseLength: text?.length || 0,
        responsePreview: text?.slice(0, 50) || '',
      };
    } else {
      return {
        success: false,
        elapsed,
        error: data.error?.message || JSON.stringify(data),
        status: response.status,
      };
    }
  } catch (err) {
    return {
      success: false,
      elapsed: Date.now() - start,
      error: err.message,
    };
  }
}

console.log('🚀 开始测试...\n');

for (const testCase of testCases) {
  console.log(`📝 测试: ${testCase.name}`);
  console.log(`   提示: "${testCase.content}"`);

  const attempts = [];

  for (let i = 1; i <= 3; i++) {
    process.stdout.write(`   尝试 ${i}/3... `);
    const result = await testRequest(testCase, i);
    attempts.push(result);

    if (result.success) {
      console.log(`✅ ${result.elapsed}ms (${result.outputTokens} tokens)`);
    } else {
      console.log(`❌ ${result.error}`);
    }

    // 避免请求过快
    if (i < 3) await new Promise(resolve => setTimeout(resolve, 1000));
  }

  results.push({ testCase, attempts });
  console.log('');
}

// 统计结果
console.log('📊 测试结果汇总\n');
console.log('═'.repeat(80));

for (const { testCase, attempts } of results) {
  const successful = attempts.filter(a => a.success);
  const failed = attempts.filter(a => !a.success);

  console.log(`\n${testCase.name}:`);

  if (successful.length > 0) {
    const times = successful.map(a => a.elapsed);
    const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const avgTokens = Math.round(successful.reduce((sum, a) => sum + a.outputTokens, 0) / successful.length);

    console.log(`  ✅ 成功: ${successful.length}/3`);
    console.log(`  ⏱️  响应时间: 平均 ${avgTime}ms, 最快 ${minTime}ms, 最慢 ${maxTime}ms`);
    console.log(`  📝 输出 Token: 平均 ${avgTokens}`);

    if (successful[0].responsePreview) {
      console.log(`  💬 响应预览: ${successful[0].responsePreview}...`);
    }
  }

  if (failed.length > 0) {
    console.log(`  ❌ 失败: ${failed.length}/3`);
    console.log(`  🔍 错误: ${failed[0].error}`);
  }
}

console.log('\n' + '═'.repeat(80));

// 总体评估
const allAttempts = results.flatMap(r => r.attempts);
const successRate = (allAttempts.filter(a => a.success).length / allAttempts.length * 100).toFixed(1);
const avgResponseTime = allAttempts.filter(a => a.success).length > 0
  ? Math.round(allAttempts.filter(a => a.success).reduce((sum, a) => sum + a.elapsed, 0) / allAttempts.filter(a => a.success).length)
  : 0;

console.log('\n🎯 总体评估:');
console.log(`  成功率: ${successRate}%`);
if (avgResponseTime > 0) {
  console.log(`  平均响应时间: ${avgResponseTime}ms`);

  if (avgResponseTime < 2000) {
    console.log(`  ⚡ 速度评级: 优秀`);
  } else if (avgResponseTime < 5000) {
    console.log(`  ✅ 速度评级: 良好`);
  } else if (avgResponseTime < 10000) {
    console.log(`  ⚠️  速度评级: 一般`);
  } else {
    console.log(`  🐌 速度评级: 较慢`);
  }
}

console.log('\n✨ 测试完成！\n');
