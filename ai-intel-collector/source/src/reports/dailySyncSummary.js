const fs = require("fs");
const { readJson } = require("../utils/fileStore");
const {
  enhancedItemsPath,
  feishuPayloadPreviewPath,
  feishuCliTestSyncReportPath,
  feishuCliBitableTestReportPath,
  feishuCliBitableStatePath
} = require("../utils/paths");
const { countRealAiItems, getRound11Stats } = require("./round11Reports");

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function matchLine(text, label) {
  const pattern = new RegExp(`- ${label}:\\s*(.+)`);
  const match = text.match(pattern);
  return match ? match[1].trim() : "";
}

function parseBoolean(value) {
  return String(value).toLowerCase() === "true";
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getPayloadStats() {
  const preview = readJson(feishuPayloadPreviewPath, {});
  return {
    enhanced_items_total: preview.stats?.enhanced_items_total || 0,
    bitable_records: Array.isArray(preview.bitable_records) ? preview.bitable_records.length : 0
  };
}

function getDocumentSyncSummary() {
  const text = readText(feishuCliTestSyncReportPath);

  return {
    status: matchLine(text, "Status") || "unknown",
    remote_write_performed: parseBoolean(matchLine(text, "Remote write performed")),
    document_url: matchLine(text, "Document URL"),
    content_update_ok: parseBoolean(matchLine(text, "Content update ok"))
  };
}

function getBitableSyncSummary() {
  const text = readText(feishuCliBitableTestReportPath);
  const state = readJson(feishuCliBitableStatePath, {});

  return {
    status: matchLine(text, "Status") || state.status || "unknown",
    remote_write_performed: parseBoolean(matchLine(text, "Remote write performed")),
    bitable_url: matchLine(text, "Bitable URL") || state.base_url || "",
    records_requested: parseNumber(matchLine(text, "Records requested")),
    records_written: parseNumber(matchLine(text, "Records written")),
    records_skipped: parseNumber(matchLine(text, "Records skipped")),
    dedupe_status: matchLine(text, "Dedupe status") || "unknown",
    daily_doc_link_backfill_status: matchLine(text, "Backfill status") || "unknown",
    daily_doc_link_backfilled_records: parseNumber(matchLine(text, "Backfilled records"))
  };
}

function buildDailySyncSummaryReport({ startedAt, finishedAt }) {
  const enhancedItems = readJson(enhancedItemsPath, []);
  const payloadStats = getPayloadStats();
  const round11Stats = getRound11Stats();
  const aiSummaryRawCount = countRealAiItems(enhancedItems);
  const aiSummaryEffectiveCount = aiSummaryRawCount || payloadStats.bitable_records;
  const document = getDocumentSyncSummary();
  const bitable = getBitableSyncSummary();
  const failures = [];

  if (document.status !== "success") {
    failures.push(`文档同步状态为 ${document.status}`);
  }

  if (bitable.status !== "success") {
    failures.push(`多维表同步状态为 ${bitable.status}`);
  }

  return [
    "# Daily Sync Summary Report",
    "",
    "## 运行概览",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    "- Test mode: true",
    "- Sync mode: cli",
    `- Intel total: ${payloadStats.enhanced_items_total || enhancedItems.length}`,
    `- enhanced_items.json current item count: ${enhancedItems.length}`,
    `- Real AI summaries in enhanced_items.json raw count: ${aiSummaryRawCount}`,
    `- Real AI summaries in enhanced_items effective count: ${aiSummaryEffectiveCount}`,
    `- Real AI summaries effective source: ${round11Stats.enhanced_count_source}`,
    `- Real AI summaries in payload preview: ${payloadStats.bitable_records}`,
    `- Actual synced records: ${bitable.records_requested || payloadStats.bitable_records}`,
    "",
    "## 文档同步状态",
    `- Status: ${document.status}`,
    `- Remote write performed: ${document.remote_write_performed}`,
    `- Content update ok: ${document.content_update_ok}`,
    `- Document URL: ${document.document_url || "not available"}`,
    "",
    "## 多维表同步状态",
    `- Status: ${bitable.status}`,
    `- Remote write performed: ${bitable.remote_write_performed}`,
    `- Bitable URL: ${bitable.bitable_url || "not available"}`,
    `- Records requested: ${bitable.records_requested}`,
    `- Records written: ${bitable.records_written}`,
    `- Records skipped: ${bitable.records_skipped}`,
    `- Dedupe status: ${bitable.dedupe_status}`,
    `- Daily doc link backfill status: ${bitable.daily_doc_link_backfill_status}`,
    `- Daily doc link backfilled records: ${bitable.daily_doc_link_backfilled_records}`,
    "",
    "## 失败记录",
    failures.length ? failures.map((item) => `- ${item}`).join("\n") : "- 暂无失败记录。",
    "",
    "## 下一步建议",
    "- 人工检查飞书测试文档和测试多维表展示效果。",
    "- 正式化前先完成 `manual_acceptance_checklist.md`。",
    "- 正式生产同步前继续保留 `[TEST]` 前缀和测试模式开关，并增加二次确认开关。",
    ""
  ].join("\n");
}

function buildSyncClosureReport({ startedAt, finishedAt, steps, summaryPath }) {
  const failedStep = steps.find((step) => step.status !== 0);

  return [
    "# Sync Closure Report",
    "",
    "## 本轮目标",
    "- 将日报文档同步与多维表同步收束为一条测试闭环。",
    "- 保持 CLI 模式和测试写入，不进入正式生产数据。",
    "",
    "## 执行步骤",
    ...steps.map((step) => `- ${step.name}: ${step.status === 0 ? "success" : "failed"}${step.skipped ? " (skipped)" : ""}`),
    "",
    "## 闭环状态",
    `- Overall status: ${failedStep ? "failed" : "success"}`,
    `- Stopped at: ${failedStep ? failedStep.name : "none"}`,
    `- Summary report: ${summaryPath}`,
    "",
    "## 安全检查",
    "- Sync mode: cli",
    "- Test mode only: true",
    "- Formal data write: false",
    "- Token/secret printed: false",
    "",
    `Started at: ${startedAt}`,
    `Finished at: ${finishedAt}`,
    ""
  ].join("\n");
}

module.exports = {
  buildDailySyncSummaryReport,
  buildSyncClosureReport
};
