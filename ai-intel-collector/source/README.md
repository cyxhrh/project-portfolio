# AI Intel Collector

AI Intel Collector 是一个本地自动化工具，用来收集 AI 行业一手信息，生成行动型情报卡片、飞书友好日报，并通过本机 `lark-cli` 写入飞书测试文档和测试多维表。

## 手动运行

```bash
npm run collect
npm run summarize
npm run enrich:content
npm run summarize:test
npm run report:enhanced
npm run feishu:sync
npm run feishu:cli-bitable-test
npm run sync:summary
```

## 一键自动运行

默认是测试模式：

```bash
npm run ai:intel:auto
```

等价于：

```bash
npm run ai:intel:auto:test
```

自动流程会按顺序执行采集、摘要、正文抓取、Top N 真实摘要、日报生成、飞书测试文档同步、飞书测试多维表同步和总报告生成。

## 测试模式

`.env` 建议保持：

```env
AI_INTEL_RUN_MODE=test
FEISHU_SYNC_MODE=cli
FEISHU_SYNC_ENABLED=true
FEISHU_TARGET_ENV=test
FEISHU_DOC_TITLE_PREFIX=[TEST]
FEISHU_BITABLE_NAME=[TEST] AI 一手情报库
```

测试模式下：

- 文档标题带 `[TEST]`
- 多维表使用 `[TEST] AI 一手情报库`
- 不写正式数据
- 重复运行会按 `原始 URL` 去重

## 正式模式

正式模式目前只做安全检查，不建议直接用于生产写入。

必须同时满足：

```env
AI_INTEL_RUN_MODE=prod
AI_INTEL_CONFIRM_PRODUCTION=true
```

先运行：

```bash
npm run ai:intel:auto:prod-check
```

正式写入前请先完成 `manual_acceptance_checklist.md`，并确认正式知识库、正式多维表、回滚策略和二次确认开关。

## 日志

每次自动运行都会写入：

```text
logs/ai-intel-auto-YYYY-MM-DD.log
```

自动运行总报告：

```text
auto_run_report.md
```

同步总结报告：

```text
daily_sync_summary_report.md
```

## Windows 定时任务

先预览任务，不会创建：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-windows-task.ps1
```

确认后创建每天 08:30 自动运行的任务：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-windows-task.ps1 -Create
```

脚本会要求输入 `YES` 才会真正创建任务。计划任务运行：

```bash
npm run ai:intel:auto
```

计划任务日志输出到：

```text
logs/ai-intel-auto-scheduled.log
```

## 飞书 CLI 排查

如果飞书同步失败，先运行：

```bash
npm run feishu:cli-check
```

常见检查项：

- `lark-cli` 是否可用
- `lark-cli doctor` 是否通过
- 当前 CLI 登录账号是否正确
- 是否能找到知识库 `AI一手信息`
- `.env` 中是否仍为 test 模式
- 文档标题和多维表名是否带 `[TEST]`

不要把 `.env`、飞书 token、DeepSeek API Key 提交或粘贴到报告里。
