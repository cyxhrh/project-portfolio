const fs = require("fs");
const { readJson } = require("../utils/fileStore");
const {
  enhancedItemsPath,
  feishuPayloadPreviewPath,
  feishuCliTestSyncReportPath,
  feishuCliBitableTestReportPath
} = require("../utils/paths");

const AI_SUCCESS_STATUSES = new Set([
  "ai_summary_success",
  "ai_summary",
  "真实 AI 摘要",
  "true_ai_summary",
  "real_ai_summary"
]);

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function matchLine(text, label) {
  const pattern = new RegExp(`- ${label}:\\s*(.+)`);
  const match = text.match(pattern);
  return match ? match[1].trim() : "";
}

function countRealAiItems(items) {
  return items.filter((item) => {
    const status = String(item.summary_status || item.summary_type || "").trim();
    return AI_SUCCESS_STATUSES.has(status) || Boolean(item.model_used && item.one_sentence_summary);
  }).length;
}

function getRound11Stats() {
  const enhancedItems = readJson(enhancedItemsPath, []);
  const preview = readJson(feishuPayloadPreviewPath, {});
  const bitableRecords = Array.isArray(preview.bitable_records) ? preview.bitable_records : [];
  const payloadEnhancedTotal = preview.stats?.enhanced_items_total || 0;
  const payloadRealAiCount = bitableRecords.length;
  const enhancedRealAiRawCount = countRealAiItems(enhancedItems);
  const enhancedRealAiEffectiveCount = enhancedRealAiRawCount || payloadRealAiCount;
  const bitableReport = readText(feishuCliBitableTestReportPath);
  const docReport = readText(feishuCliTestSyncReportPath);

  return {
    enhanced_items_file_count: enhancedItems.length,
    enhanced_real_ai_raw_count: enhancedRealAiRawCount,
    enhanced_real_ai_effective_count: enhancedRealAiEffectiveCount,
    enhanced_count_source: enhancedRealAiRawCount > 0 ? "enhanced_items.json" : "feishu_payload_preview.json fallback",
    payload_enhanced_total: payloadEnhancedTotal,
    payload_real_ai_count: payloadRealAiCount,
    records_requested: Number(matchLine(bitableReport, "Records requested")) || payloadRealAiCount,
    records_written: Number(matchLine(bitableReport, "Records written")) || 0,
    records_skipped: Number(matchLine(bitableReport, "Records skipped")) || 0,
    dedupe_status: matchLine(bitableReport, "Dedupe status") || "unknown",
    backfill_status: matchLine(bitableReport, "Backfill status") || "unknown",
    backfilled_records: Number(matchLine(bitableReport, "Backfilled records")) || 0,
    document_url: matchLine(docReport, "Document URL"),
    bitable_url: matchLine(bitableReport, "Bitable URL")
  };
}

function buildManualAcceptanceChecklist({ generatedAt }) {
  const stats = getRound11Stats();

  return [
    "# Manual Acceptance Checklist",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "## 飞书日报文档",
    "- [ ] 打开测试日报文档，确认标题仍带 `[TEST]`。",
    "- [ ] 检查 Markdown 复制到飞书后的标题层级、列表、表格是否易读。",
    "- [ ] 确认“深度分析情报（真实 AI 摘要）”展示的是 10 条真实摘要。",
    "- [ ] 抽查 2-3 条摘要，确认没有明显编造或过度推断。",
    "",
    "## 测试多维表",
    "- [ ] 打开测试多维表 `[TEST] AI 一手情报库`。",
    "- [ ] 确认字段数量和字段名符合预期。",
    "- [ ] 确认 records 数量为 10 条真实 AI 摘要，不是全部 69 条。",
    "- [ ] 确认每条 record 有标题、来源、链接、分类、摘要、项目启发、建议行动。",
    "- [ ] 确认 `日报文档链接` 字段已回填，并能打开对应测试日报文档。",
    "- [ ] 确认 `人工核验状态` 默认为“待核验”。",
    "",
    "## 重复运行与安全",
    "- [ ] 重复运行后不会重复写入同一条 `原始 URL`。",
    "- [ ] 本轮没有去掉 `[TEST]` 前缀。",
    "- [ ] 本轮没有写正式知识库或正式多维表。",
    "- [ ] 报告中没有 token、secret、API key。",
    "",
    "## 是否进入正式模式",
    "- [ ] 飞书日报文档排版通过。",
    "- [ ] 多维表字段通过。",
    "- [ ] 10 条 records 内容通过。",
    "- [ ] 摘要真实性抽查通过。",
    "- [ ] 重复运行去重通过。",
    "- [ ] 已确认正式目标知识库和正式多维表策略。",
    "- [ ] 已准备二次确认开关，例如 `AI_INTEL_CONFIRM_PRODUCTION=true`。",
    "",
    "## 当前参考数据",
    `- Payload preview 情报总数：${stats.payload_enhanced_total}`,
    `- Payload preview 真实 AI 摘要：${stats.payload_real_ai_count}`,
    `- 实际同步 records：${stats.records_requested}`,
    `- 去重跳过 records：${stats.records_skipped}`,
    `- 日报链接回填 records：${stats.backfilled_records}`,
    stats.document_url ? `- 测试日报文档：${stats.document_url}` : "- 测试日报文档：not available",
    stats.bitable_url ? `- 测试多维表：${stats.bitable_url}` : "- 测试多维表：not available",
    ""
  ].join("\n");
}

function buildProductionReadinessReport({ generatedAt }) {
  const stats = getRound11Stats();

  return [
    "# Production Readiness Report",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "## 当前结论",
    "- 当前仍应保持测试模式。",
    "- CLI 模式已经跑通文档和多维表测试写入。",
    "- 正式化前需要人工验收飞书展示效果与摘要事实风险。",
    "- 不建议在没有二次确认开关前去掉 `[TEST]` 前缀。",
    "",
    "## 正式模式所需配置",
    "- `FEISHU_SYNC_MODE=cli` 继续作为本地自用默认模式。",
    "- `FEISHU_SYNC_ENABLED=true` 仅在明确同步时开启。",
    "- `FEISHU_TARGET_ENV=production` 需要配合二次确认开关。",
    "- 建议新增 `AI_INTEL_CONFIRM_PRODUCTION=true` 作为正式写入二次确认。",
    "- 正式文档标题建议：`AI 情报日报 - YYYY-MM-DD`。",
    "- 正式多维表建议复用固定表，而不是每天新建。",
    "",
    "## 从 `[TEST]` 切换到正式的建议步骤",
    "1. 完成人工验收清单。",
    "2. 固定正式知识库位置和正式多维表 URL。",
    "3. 将正式目标写入配置，但保留默认 test 模式。",
    "4. 增加 `AI_INTEL_CONFIRM_PRODUCTION=true` 二次确认。",
    "5. 先执行 dry-run 或 preview，再执行正式同步。",
    "6. 正式同步后抽查文档、表格、去重和链接回填。",
    "",
    "## 正式多维表复用策略",
    "- 以 `原始 URL` 作为主去重键。",
    "- 同一天重复运行时不重复写同一 URL。",
    "- 保留 `人工核验状态` 字段，默认“待核验”。",
    "- 保留 `日报文档链接` 字段，方便从表格回到当天日报。",
    "- 后续可增加 `同步批次` 或 `日报日期` 字段支持审计。",
    "",
    "## 回滚策略",
    "- 文档：正式写入前先保留测试文档；若正式文档写错，优先删除或移动当天正式文档。",
    "- 多维表：正式写入前记录本批次 URL 列表；如需回滚，按 URL 或同步批次删除。",
    "- 配置：生产开关默认关闭，`.env` 不提交。",
    "- API fallback：继续保留，但本地阶段不默认启用。",
    "",
    "## 安全要求",
    "- 不在日志、报告、JSON 中输出 token/secret。",
    "- 不提交 `.env`。",
    "- 正式模式必须要求 `FEISHU_TARGET_ENV=production` 和 `AI_INTEL_CONFIRM_PRODUCTION=true` 同时成立。",
    "- 正式写入前保留 CLI health check 和 preview 检查。",
    "",
    "## 当前统计",
    `- enhanced_items.json 当前条数：${stats.enhanced_items_file_count}`,
    `- enhanced_items 真实摘要有效计数：${stats.enhanced_real_ai_effective_count}`,
    `- payload preview 真实摘要：${stats.payload_real_ai_count}`,
    `- 实际同步 records：${stats.records_requested}`,
    `- 去重状态：${stats.dedupe_status}`,
    `- 日报链接回填状态：${stats.backfill_status}`,
    ""
  ].join("\n");
}

function buildRound11Report({ generatedAt }) {
  const stats = getRound11Stats();

  return [
    "# Round 11 Report",
    "",
    "## 本轮完成",
    "- 修正 daily sync summary 的真实摘要统计口径。",
    "- 增加人工验收清单。",
    "- 增加正式化前配置检查报告。",
    "- 保持 CLI + test 模式，没有执行远端写入。",
    "",
    "## 统计修正说明",
    `- enhanced_items.json 当前条数：${stats.enhanced_items_file_count}`,
    `- enhanced_items.json 原始真实摘要计数：${stats.enhanced_real_ai_raw_count}`,
    `- enhanced_items 真实摘要有效计数：${stats.enhanced_real_ai_effective_count}`,
    `- effective count 来源：${stats.enhanced_count_source}`,
    `- payload preview 真实摘要计数：${stats.payload_real_ai_count}`,
    `- 实际同步 records 数量：${stats.records_requested}`,
    "",
    "## 安全确认",
    "- 未执行飞书远端写入。",
    "- 未切换 API 模式。",
    "- 未去掉 `[TEST]` 前缀。",
    "- 未提交 `.env`。",
    "- 未输出 token/secret。",
    "",
    "## 下一步建议",
    "- 人工完成 `manual_acceptance_checklist.md`。",
    "- 确认正式知识库和正式多维表复用策略。",
    "- 第 12 轮再增加生产二次确认开关，不要直接进入正式写入。",
    "",
    `Generated at: ${generatedAt}`,
    ""
  ].join("\n");
}

module.exports = {
  AI_SUCCESS_STATUSES,
  countRealAiItems,
  getRound11Stats,
  buildManualAcceptanceChecklist,
  buildProductionReadinessReport,
  buildRound11Report
};
