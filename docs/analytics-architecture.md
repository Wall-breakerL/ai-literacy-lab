# Analytics Architecture for Alibaba Cloud Production

> Scope: 当前版本只记录三类数据：网站访问、最终测试结果、问卷题目与用户选择。暂不做完整流程漏斗。

## 1. 当前目标

这版统计系统回答三个问题：

1. **访问量**：有多少匿名访客访问过网站，今天有多少访客，总访问次数是多少。
2. **测试结果**：完成 AI-MBTI 的用户最后得到哪一种人格类型，以及各维度分数。
3. **问卷样本**：不同职业看到过哪些题、用户怎么选，方便下一版优化题目生成和同职业历史题目匹配。

不记录：

- 复杂流程节点，如第一轮完成、中途反馈、海报查看等。
- 报告全文。
- 反馈正文。
- 明文 IP。
- 明文 visitor id。

## 2. 数据存储

生产权威数据源：单服务器本地 SQLite 文件。

默认路径：

```text
./data/analytics.db
```

也可以用 `ANALYTICS_DB_PATH` 指向绝对路径。SQLite 会开启 WAL 模式和 5 秒 busy timeout，适合当前单服务器、低运维成本的统计场景。

浏览器生成匿名 `visitorId`，服务端使用 `ANALYTICS_SALT` hash 后入库：

```text
visitor_hash = sha256(visitorId + ANALYTICS_SALT)
```

数据库不会保存明文 `visitorId`。

## 3. 数据表

### 3.1 `analytics_visits`

保存每次访问记录，用来计算访问次数。

核心字段：

- `visit_id`
- `visitor_hash`
- `path`
- `referrer_host`
- `occurred_at`

### 3.2 `analytics_visitors`

保存匿名访客聚合，用来计算累计访客数。

核心字段：

- `visitor_hash`
- `first_seen_at`
- `last_seen_at`
- `visit_count`
- `first_path`
- `last_path`

### 3.3 `analytics_visit_days`

保存每日匿名访客，用来计算今日访客数。

核心字段：

- `metric_date`
- `visitor_hash`
- `visit_count`

### 3.4 `test_results`

保存完成测试后的最终结果。

核心字段：

- `visitor_hash`
- `session_id`
- `role`
- `tools`
- `personality_code`
- `personality_name`
- `dimension_scores`
- `completed_at`

### 3.5 `questionnaire_samples`

保存问卷题目和用户选择，用于后续题目优化。

核心字段：

- `test_result_id`
- `session_id`
- `role`
- `tools`
- `batch_key`
- `question_index`
- `dimension`
- `question`
- `scenario`
- `reverse`
- `score`
- `skipped`

## 4. API

### 4.1 `POST /api/analytics/visit`

浏览器进入页面或路由切换时调用。

请求：

```json
{
  "visitId": "visit_xxx",
  "visitorId": "visitor_xxx",
  "path": "/",
  "referrer": "https://example.com",
  "occurredAt": "2026-05-13T10:00:00.000Z"
}
```

### 4.2 `POST /api/analytics/test-result`

报告成功生成后调用，一次性保存最终结果和问卷样本。

请求：

```json
{
  "resultId": "result_xxx",
  "visitorId": "visitor_xxx",
  "sessionId": "session_xxx",
  "role": "产品经理",
  "tools": ["ChatGPT", "Claude"],
  "personalityCode": "CEAL",
  "personalityName": "外交官",
  "dimensions": [
    {
      "dimension": "Relation",
      "score": 16,
      "scorePercent": 80,
      "tendencyLabel": "伙伴型"
    }
  ],
  "questionnaireSamples": [
    {
      "batchKey": "batch1",
      "index": 1,
      "dimension": "Relation",
      "question": "当 AI 主动补充思路时，你通常会继续让它展开吗？",
      "scenario": "需求讨论",
      "reverse": false,
      "score": 4,
      "skipped": false
    }
  ],
  "completedAt": "2026-05-13T10:00:00.000Z"
}
```

### 4.3 `GET /api/analytics/summary`

公开展示用，只返回聚合数字：

```json
{
  "totalVisitors": 1280,
  "todayVisitors": 47,
  "totalVisits": 2140,
  "completedTestsTotal": 320,
  "updatedAt": "2026-05-13T10:00:00.000Z"
}
```

### 4.4 `GET /api/admin/analytics/summary`

内部面板用，需要 `ADMIN_ANALYTICS_TOKEN`。

返回：

- 访问人数。
- 访问次数。
- 完成测试数。
- 问卷样本数。
- 人格结果分布。
- 职业分布。

## 5. 阿里云观测

ARMS RUM 和 SLS WebTracking 是辅助观测层，不作为业务统计权威来源。

ARMS RUM：

- 通过 `NEXT_PUBLIC_ARMS_RUM_PID` 和 `NEXT_PUBLIC_ARMS_RUM_ENDPOINT` 启用。
- 用于页面性能、JS 错误、接口体验。

SLS WebTracking：

- 通过 `NEXT_PUBLIC_SLS_WEBTRACK_*` 启用。
- 生产默认要求 `NEXT_PUBLIC_SLS_WEBTRACK_STS_ENDPOINT`。
- 不在前端写死长期 AccessKey。
- 只有显式设置 `NEXT_PUBLIC_SLS_WEBTRACK_ALLOW_ANONYMOUS=1` 才允许匿名测试写入。

## 6. 环境变量

必须：

```bash
ANALYTICS_DB_PATH=
ANALYTICS_SALT=
ADMIN_ANALYTICS_TOKEN=
```

可选：

```bash
ANALYTICS_RATE_LIMIT_PER_MINUTE=60
NEXT_PUBLIC_ANALYTICS_DEBUG=
```

阿里云观测可选：

```bash
NEXT_PUBLIC_ARMS_RUM_PID=
NEXT_PUBLIC_ARMS_RUM_ENDPOINT=
NEXT_PUBLIC_SLS_WEBTRACK_HOST=
NEXT_PUBLIC_SLS_WEBTRACK_PROJECT=
NEXT_PUBLIC_SLS_WEBTRACK_LOGSTORE=
NEXT_PUBLIC_SLS_WEBTRACK_STS_ENDPOINT=
```

## 7. 部署步骤

1. 在服务器项目目录创建 `data/`，并确保运行 Node 的用户有写权限。
2. 配置 `ANALYTICS_SALT`、`ADMIN_ANALYTICS_TOKEN`，可选配置 `ANALYTICS_DB_PATH`。
3. 部署应用。首次写入统计时，应用会自动创建 SQLite 文件并执行 `db/migrations/001_analytics.sql`。
4. 打开首页确认公开统计不报错。
5. 打开 `/admin/analytics`，输入 token 查看内部统计。
6. 对 `data/analytics.db`、`data/analytics.db-wal`、`data/analytics.db-shm` 做定期备份。
