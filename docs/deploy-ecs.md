# 国内 ECS 部署指南（ai-literacy.top）

在已有国内 ECS 和域名（如 ai-literacy.top，已备案）上部署本 Next 应用，实现国内直连访问。

---

## 一、ECS 基础准备

### 1. 登录 ECS

```bash
ssh -i ~/.ssh/你的私钥 root@你的ECS公网IP
```

### 2. 安装 Node.js 20（以 Ubuntu 为例）

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # 应显示 v20.x
```

### 3. 安装 Git（可选）

```bash
sudo apt-get update && sudo apt-get install -y git
```

---

## 二、部署 Next 应用

### 4. 拉取代码

```bash
cd ~
git clone 你的仓库地址 ai-literacy-lab
cd ai-literacy-lab
```

（若无 Git，可在本机打 zip 上传到 ECS 后解压并进入项目根目录。）

### 5. 安装依赖并构建

```bash
npm ci
npm run build
```

### 6. 配置环境变量

在项目根目录创建 `.env.production`（不要提交到 Git）：

```bash
OPENAI_BASE_URL=你的API地址
OPENAI_API_KEY=你的API密钥
# 若分开配置 Judge：OPENAI_JUDGE_API_KEY=...
# 可选：OPENAI_CHAT_MODEL=... OPENAI_JUDGE_MODEL=...
```

确保与本地开发环境一致（如使用 MiniMax 等国内可直连的 API）。

### 7. 前台试跑

```bash
npm start
```

在浏览器访问 `http://ECS公网IP:3000`，确认页面与对话/评分正常后 `Ctrl+C` 停止。

### 8. 使用 PM2 保活

```bash
sudo npm install -g pm2
pm2 start npm --name "ai-literacy" -- start
pm2 save && pm2 startup
```

按提示执行 `pm2 startup` 输出的命令。之后应用在 3000 端口常驻，重启 ECS 也会自启。

---

## 三、域名解析与 Nginx + HTTPS

### 9. 域名解析

在购买域名的控制台（或 DNS 服务商）添加 A 记录：

- 主机记录：`@`（以及可选 `www`）
- 记录值：ECS 公网 IP

### 10. 安装 Nginx 与 Certbot

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 11. 配置 Nginx 反代

新建站点配置：

```bash
sudo nano /etc/nginx/sites-available/ai-literacy
```

写入以下内容（将 `ai-literacy.top` 换成你的域名）：

```nginx
server {
    listen 80;
    server_name ai-literacy.top www.ai-literacy.top;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

保存后启用并测试：

```bash
sudo ln -sf /etc/nginx/sites-available/ai-literacy /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 12. 申请 HTTPS 证书

```bash
sudo certbot --nginx -d ai-literacy.top -d www.ai-literacy.top
```

按提示输入邮箱、同意条款，Certbot 会自动为 Nginx 配置 HTTPS。

### 13. 安全组

在云控制台为该 ECS 安全组放行：

- 22（SSH）
- 80（HTTP）
- 443（HTTPS）

若需临时用 IP:3000 测试，可放行 3000；正式访问建议仅通过 80/443。

---

## 四、验收与日常更新

### 访问

浏览器打开 `https://ai-literacy.top`，确认页面、对话、评分均正常且无需代理。

### 更新代码

```bash
cd ~/ai-literacy-lab
git pull
npm ci
npm run build
pm2 restart ai-literacy
```

---

## 五、故障排查

- **无法访问 3000**：检查 `pm2 status`、`pm2 logs ai-literacy`。
- **502 Bad Gateway**：确认 Next 已启动（`pm2 list`），且 Nginx 中 `proxy_pass` 为 `http://127.0.0.1:3000`。
- **Chat/评分失败**：检查 `.env.production` 中 `OPENAI_BASE_URL`、`OPENAI_API_KEY` 是否正确，以及 ECS 能否访问该 API（如 MiniMax 国内直连）。
