# 部署指南

## 本地开发

```bash
cd ai-literacy-lab
npm install
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 生产构建

```bash
npm run build
npm start
```

---

## 环境变量

复制 `.env.example` 为 `.env.local`，按需填写：

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | 否 | Chat 对话 + Judge 评分。若未配置，全程 mock，可完整演示。 |
| `OPENAI_BASE_URL` | 否 | OpenAI 兼容接口 URL，默认 `https://api.openai.com/v1` |
| `OPENAI_CHAT_MODEL` | 否 | Chat 模型，默认 `gpt-4o-mini` |
| `OPENAI_JUDGE_MODEL` | 否 | Judge 模型，默认 `gpt-4o` |
| `OPENAI_JUDGE_API_KEY` | 否 | 单独指定 Judge 用 key，默认使用 `OPENAI_API_KEY` |

### 使用 Minimax

Minimax 提供 OpenAI 兼容的 Chat Completions 接口：

```
OPENAI_BASE_URL=https://api.minimaxi.com/v1
OPENAI_API_KEY=你的 Minimax Key
OPENAI_CHAT_MODEL=MiniMax-M2.5
OPENAI_JUDGE_MODEL=MiniMax-M2.5
```

---

## 国内 ECS 部署

详细步骤见下方「国内 ECS + 域名部署」。

### 关键配置

1. **Node 版本**：建议 18+，使用 nvm 管理
2. **Nginx 反向代理**：将域名请求转发到 `localhost:3000`
3. **HTTPS**：Let's Encrypt 免费证书
4. **PM2**：进程管理，保持服务常驻

### 数据目录注意

`data/runtime/` 默认为 gitignore，生产环境建议：
- 定期备份 `data/runtime/experiences/` 和 `data/runtime/users/`
- 或迁移到云存储（OSS 等）
