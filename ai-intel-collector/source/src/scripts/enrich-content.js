const { readJson, writeJson, writeText, ensureDir } = require("../utils/fileStore");
const { log, error } = require("../utils/logger");
const {
  enhancedOutputDir,
  enhancedItemsPath,
  rawItemsPath,
  contentEnrichedItemsPath,
  contentFetchReportPath
} = require("../utils/paths");
const { loadModelSettings } = require("../llm/openaiCompatibleClient");
const { enrichItemsWithContent } = require("../agents/contentEnrichmentAgent");

function buildContentFetchReport({ startedAt, finishedAt, items, outputPath }) {
  const statusCounts = items.reduce((counts, item) => {
    counts[item.content_fetch_status] = (counts[item.content_fetch_status] || 0) + 1;
    return counts;
  }, {});
  const failedItems = items.filter((item) => item.content_fetch_status !== "success");

  return [
    "# Content Fetch Report",
    "",
    "## 本轮完成了什么",
    "- 为现有情报逐条抓取原文正文片段。",
    "- 优先提取 article/main/meta description/正文段落。",
    "- 将正文片段限制在配置长度内，避免后续模型 token 失控。",
    "",
    "## 运行概览",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- Items processed: ${items.length}`,
    `- Output: ${outputPath}`,
    "",
    "## 抓取状态统计",
    ...Object.entries(statusCounts).map(([status, count]) => `- ${status}: ${count}`),
    "",
    "## 失败记录",
    failedItems.length
      ? failedItems.slice(0, 30).map((item) => `- ${item.title}：${item.content_fetch_status}${item.content_fetch_error ? ` - ${item.content_fetch_error}` : ""}`).join("\n")
      : "- 暂无失败。",
    ""
  ].join("\n");
}

async function main() {
  const startedAt = new Date().toISOString();
  const settings = loadModelSettings();
  const sourceItems = readJson(enhancedItemsPath, null) || readJson(rawItemsPath, []);

  ensureDir(enhancedOutputDir);
  log(`Loaded items for content enrichment: ${sourceItems.length}`);

  const enriched = await enrichItemsWithContent(sourceItems, {
    maxChars: settings.contentMaxChars,
    timeoutMs: 20000
  });

  writeJson(contentEnrichedItemsPath, enriched);
  writeText(
    contentFetchReportPath,
    buildContentFetchReport({
      startedAt,
      finishedAt: new Date().toISOString(),
      items: enriched,
      outputPath: contentEnrichedItemsPath
    })
  );

  log(`Content enriched items: ${contentEnrichedItemsPath}`);
  log(`Content fetch report: ${contentFetchReportPath}`);
}

main().catch((caughtError) => {
  error(caughtError.stack || caughtError.message);
  process.exitCode = 1;
});
