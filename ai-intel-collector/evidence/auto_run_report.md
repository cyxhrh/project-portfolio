> 历史项目记录的脱敏副本；保留原报告结果，不代表 2026-09-13 重新执行。

# Auto Run Report

## 运行概览
- Started at: 2026-07-07T13:30:02.124Z
- Finished at: 2026-07-07T13:35:47.315Z
- Run mode: test
- Check only: false
- Overall status: success
- Stopped at: none
- Log file: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\logs\ai-intel-auto-2026-07-07.log

## 安全边界
- Default mode is test: true
- Production confirmed: false
- Formal write allowed in this run: false
- Feishu sync mode: cli
- Feishu target env: test
- Test title prefix ok: true
- Test bitable name ok: true
- Token/secret printed: false

## 执行步骤
### collect
- Status: success
- Duration ms: 238243
- Stdout tail:
```
[AI Intel Collector] Collecting arXiv cs.AI (rss)
[AI Intel Collector] Collecting arXiv cs.LG (rss)
[AI Intel Collector] Collecting Hugging Face Transformers Releases (github)
[AI Intel Collector] Collecting Qwen Blog (webpage)
[AI Intel Collector] Collecting Qwen Code Releases (github)
[AI Intel Collector] New items: 21
[AI Intel Collector] Daily markdown: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\output\daily\ai-intel-daily-2026-07-07.md
[AI Intel Collector] Execution report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\execution_report.md
[AI Intel Collector] Adapter report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\adapter_report.md
```
- Stderr tail:
```
[AI Intel Collector] WARN: OpenAI News: failed - ETIMEDOUT
[AI Intel Collector] WARN: ChatGPT Release Notes: pending_adapter - Source URL or adapter needs confirmation.
[AI Intel Collector] WARN: Anthropic Newsroom: failed - timeout of 20000ms exceeded
[AI Intel Collector] WARN: Claude Release Notes: pending_adapter - Source URL or adapter needs confirmation.
[AI Intel Collector] WARN: Google AI Blog: failed - timeout of 20000ms exceeded
[AI Intel Collector] WARN: Google Research Blog: failed - connect ETIMEDOUT 142.250.77.17:443
[AI Intel Collector] WARN: DeepSeek API News / Changelog: pending_confirm - Source URL or adapter needs confirmation.
[AI Intel Collector] WARN: Hugging Face Blog: failed - connect ETIMEDOUT 128.121.146.228:443
[AI Intel Collector] WARN: Qwen Blog: failed - read ECONNRESET
```

### summarize
- Status: success
- Duration ms: 47549
- Stdout tail:
```
> ai-intel-collector@1.0.0 summarize
> node src/summarize.js

[AI Intel Collector] Loaded raw items: 21
[AI Intel Collector] AI summary enabled: true; API key present: true
[AI Intel Collector] Enhanced items: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\output\enhanced\enhanced_items.json
[AI Intel Collector] Enhanced daily report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\output\daily\enhanced-ai-intel-daily-2026-07-07.md
[AI Intel Collector] Summary report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\summary_report.md
```

### enrich:content
- Status: success
- Duration ms: 29141
- Stdout tail:
```
> ai-intel-collector@1.0.0 enrich:content
> node src/scripts/enrich-content.js

[AI Intel Collector] Loaded items for content enrichment: 21
[AI Intel Collector] Content enriched items: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\output\enhanced\content_enriched_items.json
[AI Intel Collector] Content fetch report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\content_fetch_report.md
```

### summarize:test
- Status: success
- Duration ms: 13283
- Stdout tail:
```
[AI Intel Collector] Loaded content enriched items: 21
[AI Intel Collector] Selected for AI summary test: 2
[AI Intel Collector] AI summary enabled: true; API key present: true
[AI Intel Collector] Enhanced items: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\output\enhanced\enhanced_items.json
[AI Intel Collector] Enhanced daily report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\output\daily\enhanced-ai-intel-daily-2026-07-07.md
[AI Intel Collector] AI summary test report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\ai_summary_test_report.md
[AI Intel Collector] AI summary eval report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\ai_summary_eval_report.md
[AI Intel Collector] AI summary quality review report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\ai_summary_quality_review_report.md
```

### report:enhanced
- Status: success
- Duration ms: 430
- Stdout tail:
```
> ai-intel-collector@1.0.0 report:enhanced
> node src/report-enhanced.js

[AI Intel Collector] Enhanced daily report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\output\daily\enhanced-ai-intel-daily-2026-07-07.md
[AI Intel Collector] Summary report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\summary_report.md
[AI Intel Collector] Feishu render check report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\feishu_render_check_report.md
```

### feishu:sync
- Status: success
- Duration ms: 9032
- Stdout tail:
```
> ai-intel-collector@1.0.0 feishu:sync
> node src/scripts/feishu-sync.js

[AI Intel Collector] Feishu sync mode report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\feishu_sync_mode_report.md
[AI Intel Collector] Feishu CLI test sync report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\feishu_cli_test_sync_report.md
[AI Intel Collector] Feishu sync mode: cli; status: success
```

### feishu:cli-bitable-test
- Status: success
- Duration ms: 7078
- Stdout tail:
```
> ai-intel-collector@1.0.0 feishu:cli-bitable-test
> node src/scripts/feishu-cli-bitable-test.js

[AI Intel Collector] Feishu CLI bitable test report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\feishu_cli_bitable_test_report.md
[AI Intel Collector] Bitable test status: success; records written: 0
```

### sync:summary
- Status: success
- Duration ms: 395
- Stdout tail:
```
> ai-intel-collector@1.0.0 sync:summary
> node src/scripts/sync-summary.js

[AI Intel Collector] Daily sync summary report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\daily_sync_summary_report.md
[AI Intel Collector] Manual acceptance checklist: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\manual_acceptance_checklist.md
[AI Intel Collector] Production readiness report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\production_readiness_report.md
[AI Intel Collector] Round 11 report: C:\Users\USER\Documents\AI Intel Collector\ai-intel-collector\round11_report.md
```

## 失败兜底
- 暂无失败，完整测试闭环已完成。

## 输出文件
- enhanced daily report: output/daily/enhanced-ai-intel-daily-YYYY-MM-DD.md
- daily sync summary: daily_sync_summary_report.md
- auto run report: auto_run_report.md

## 下一步建议
- 保持每天先跑 test 模式。
- 正式模式上线前，先完成 manual_acceptance_checklist.md。
- 如果飞书 CLI 失败，先运行 npm run feishu:cli-check。
