const path = require("path");
const { readJson, writeJson, writeText, ensureDir } = require("../utils/fileStore");
const { log, error } = require("../utils/logger");
const {
  enhancedOutputDir,
  contentEnrichedItemsPath,
  enhancedItemsPath,
  aiSummaryTestReportPath,
  aiSummaryEvalReportPath,
  aiSummaryQualityReviewReportPath,
  dailyOutputDir,
  userFocusPath
} = require("../utils/paths");
const { loadModelSettings, canCallModel } = require("../llm/openaiCompatibleClient");
const { selectTopItemsForAiSummary } = require("../agents/highValueSelectorAgent");
const { summarizeItem, buildRuleBasedCard } = require("../agents/summarizerAgent");
const { scoreItem } = require("../agents/scoringAgent");
const { formatDate, buildEnhancedDailyMarkdown } = require("../reporting");

function buildAiSummaryTestReport({ startedAt, finishedAt, settings, selectedItems, enhancedItems, outputPath, enhancedDailyPath }) {
  const statusCounts = enhancedItems.reduce((counts, item) => {
    counts[item.summary_status] = (counts[item.summary_status] || 0) + 1;
    return counts;
  }, {});
  const selectedIds = new Set(selectedItems.map((item) => item.id));
  const selectedResults = enhancedItems.filter((item) => selectedIds.has(item.id));
  const failedItems = selectedResults.filter((item) => item.summary_status === "failed");

  return [
    "# AI Summary Test Report",
    "",
    "## 本轮完成了什么",
    "- 从正文富集后的情报中筛选 Top N 高价值 item。",
    "- 仅在 AI_SUMMARY_ENABLED=true 且 API Key 存在时调用模型。",
    "- 单条摘要失败只记录在该条卡片，不影响整体输出。",
    "",
    "## 运行概览",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- AI summary enabled: ${settings.summaryEnabled}`,
    `- API key present: ${Boolean(settings.apiKey)}`,
    `- Model: ${settings.model}`,
    `- Max AI items: ${settings.summaryMaxItems}`,
    `- Selected for AI test: ${selectedItems.length}`,
    `- Output: ${outputPath}`,
    `- Enhanced daily report: ${enhancedDailyPath}`,
    "",
    "## 摘要状态统计",
    ...Object.entries(statusCounts).map(([status, count]) => `- ${status}: ${count}`),
    "",
    "## Top N 选择清单",
    selectedItems.length
      ? selectedItems.map((item) => `- ${item.title}：score=${item.importance_score}, content=${item.content_fetch_status}`).join("\n")
      : "- 暂无符合条件的 Top N item。",
    "",
    "## 模型失败记录",
    failedItems.length ? failedItems.map((item) => `- ${item.title}：${item.summary_error}`).join("\n") : "- 暂无模型失败。",
    ""
  ].join("\n");
}

function estimateQuality(item) {
  if (item.summary_status !== "ai_summary_success") {
    return "未生成真实 AI 摘要，无法评估模型摘要质量。";
  }

  const checks = [];
  if (item.one_sentence_summary && item.one_sentence_summary.length >= 20) checks.push("一句话摘要可用");
  if (Array.isArray(item.key_points) && item.key_points.length >= 2) checks.push("关键点数量可用");
  if (item.why_it_matters && item.why_it_matters.length >= 20) checks.push("重要性说明可用");
  if (Array.isArray(item.suggested_actions) && item.suggested_actions.length >= 2) checks.push("行动建议可用");
  if (item.confidence) checks.push(`confidence=${item.confidence}`);

  return checks.length >= 4 ? `初评通过：${checks.join("；")}` : `需要人工复核：${checks.join("；") || "结构化字段不足"}`;
}

function hasConcreteClaims(item) {
  const text = [
    item.one_sentence_summary,
    item.detailed_summary,
    item.why_it_matters,
    item.project_inspiration,
    Array.isArray(item.key_points) ? item.key_points.join(" ") : "",
    Array.isArray(item.suggested_actions) ? item.suggested_actions.join(" ") : ""
  ]
    .filter(Boolean)
    .join(" ");
  const hasNumber = /(\d+(\.\d+)?\s*(x|×|%|倍|万|亿|token|tokens|API|SDK)|\$\d+)/i.test(text);
  const hasNamedFeature = /(Claude|Gemini|OpenAI|Anthropic|Google|Opus|Codex|API|MCP|Agent|RAG|Omni|Spark|Interactions|Business Profile|notebooks)/i.test(text);

  return hasNumber || hasNamedFeature;
}

function reviewSummaryQuality(item) {
  const missing = [];
  if (!item.one_sentence_summary) missing.push("one_sentence_summary");
  if (!Array.isArray(item.key_points) || item.key_points.length === 0) missing.push("key_points");
  if (!item.why_it_matters) missing.push("why_it_matters");
  if (!item.project_inspiration) missing.push("project_inspiration");
  if (!Array.isArray(item.suggested_actions) || item.suggested_actions.length === 0) missing.push("suggested_actions");
  if (!item.confidence) missing.push("confidence");

  return {
    missing,
    needsHumanFactCheck: hasConcreteClaims(item),
    contentInsufficient: Boolean(item.content_insufficient),
    status: missing.length === 0 ? "structure_ok" : "missing_fields"
  };
}

function buildAiSummaryQualityReviewReport({ startedAt, finishedAt, enhancedItems }) {
  const aiItems = enhancedItems.filter((item) => item.summary_status === "ai_summary_success");
  const reviews = aiItems.map((item) => ({
    item,
    review: reviewSummaryQuality(item)
  }));
  const missingCount = reviews.filter(({ review }) => review.missing.length > 0).length;
  const factCheckCount = reviews.filter(({ review }) => review.needsHumanFactCheck).length;
  const insufficientCount = reviews.filter(({ review }) => review.contentInsufficient).length;

  return [
    "# AI Summary Quality Review Report",
    "",
    "## 检查范围",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- Real AI summaries checked: ${aiItems.length}`,
    "",
    "## 结构检查统计",
    `- Missing required fields: ${missingCount}`,
    `- Needs human fact check: ${factCheckCount}`,
    `- Content insufficient: ${insufficientCount}`,
    "",
    "## 逐条初查",
    reviews.length
      ? reviews
          .map(({ item, review }) => [
            `- ${item.title}`,
            `  - status: ${review.status}`,
            `  - missing: ${review.missing.length ? review.missing.join(", ") : "none"}`,
            `  - confidence: ${item.confidence || "missing"}`,
            `  - content_insufficient: ${review.contentInsufficient}`,
            `  - needs_human_fact_check: ${review.needsHumanFactCheck}`,
            "  - note: 这里只做结构和风险检查，不代表事实已验证。"
          ].join("\n"))
          .join("\n")
      : "- 暂无真实 AI 摘要可检查。",
    "",
    "## 下一步建议",
    "- 人工核验包含具体数字、产品名、功能名的摘要。",
    "- 对 confidence 低或 content_insufficient=true 的摘要，不要直接同步到飞书正式频道。",
    "- 若人工抽查通过，再考虑扩大 Top N 或接入飞书推送。",
    ""
  ].join("\n");
}

function buildAiSummaryEvalReport({ startedAt, finishedAt, settings, selectedItems, enhancedItems, outputPath, enhancedDailyPath }) {
  const selectedIds = new Set(selectedItems.map((item) => item.id));
  const selectedResults = enhancedItems.filter((item) => selectedIds.has(item.id));
  const aiSuccess = selectedResults.filter((item) => item.summary_status === "ai_summary_success");
  const failedItems = selectedResults.filter((item) => item.summary_status === "failed");
  const jsonParseFailures = failedItems.filter((item) => String(item.summary_error || "").toLowerCase().includes("json"));
  const actualCallCount = aiSuccess.length + failedItems.length;

  return [
    "# AI Summary Eval Report",
    "",
    "## 配置检查",
    `- API enabled: ${settings.summaryEnabled}`,
    `- API key detected: ${Boolean(settings.apiKey)}`,
    `- Provider: ${settings.provider}`,
    `- Model: ${settings.model}`,
    `- Base URL configured: ${Boolean(settings.baseURL)}`,
    `- Temperature: ${settings.temperature}`,
    `- Max tokens: ${settings.maxTokens}`,
    `- Timeout ms: ${settings.requestTimeoutMs}`,
    `- Max AI items: ${settings.summaryMaxItems}`,
    `- Max arXiv Top N items: ${settings.maxArxivTopItems}`,
    "",
    "## 调用统计",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- Top N selected: ${selectedItems.length}`,
    `- Actual model calls: ${actualCallCount}`,
    `- Successful AI summaries: ${aiSuccess.length}`,
    `- JSON parse failures: ${jsonParseFailures.length}`,
    `- Model failures: ${failedItems.length - jsonParseFailures.length}`,
    `- Skipped because no API/key: ${selectedResults.filter((item) => item.summary_status === "skipped_no_api_key").length}`,
    "",
    "## Top N 入选清单",
    selectedItems.length
      ? selectedItems.map((item) => `- ${item.title}\n  - ${item.selected_reason || "未记录入选原因"}`).join("\n")
      : "- 暂无入选项。",
    "",
    "## 摘要质量初评",
    selectedResults.length
      ? selectedResults.map((item) => `- ${item.title}\n  - status=${item.summary_status}\n  - ${estimateQuality(item)}`).join("\n")
      : "- 暂无可评估摘要。",
    "",
    "## 输出文件",
    `- Enhanced items: ${outputPath}`,
    `- Enhanced daily report: ${enhancedDailyPath}`,
    "",
    "## 下一步建议",
    settings.summaryEnabled && settings.apiKey
      ? "- 人工抽查 Top N 摘要是否忠于正文，再决定是否扩大到 10-20 条。"
      : "- 配置 `.env` 中的 `AI_SUMMARY_ENABLED=true` 和 API Key 后，重新运行 `npm run summarize:test`。",
    "- 若 OpenAI 正文持续 403，可考虑只用 RSS 摘要线索或后续引入人工确认入口。",
    "- 继续收紧 Top N 规则，让项目建设相关信号优先于普通论文。",
    ""
  ].join("\n");
}

async function main() {
  const startedAt = new Date().toISOString();
  const settings = loadModelSettings();
  const userFocus = readJson(userFocusPath, {});
  const date = formatDate(new Date(), userFocus.timezone || "UTC");
  const enhancedDailyPath = path.join(dailyOutputDir, `enhanced-ai-intel-daily-${date}.md`);
  const contentItems = readJson(contentEnrichedItemsPath, []);
  const selectedItems = selectTopItemsForAiSummary(contentItems, settings);
  const selectedIds = new Set(selectedItems.map((item) => item.id));
  const selectedById = new Map(selectedItems.map((item) => [item.id, item]));
  const aiBudget = { remaining: canCallModel(settings) ? settings.summaryMaxItems : 0 };
  const enhancedItems = [];

  ensureDir(enhancedOutputDir);
  ensureDir(dailyOutputDir);

  log(`Loaded content enriched items: ${contentItems.length}`);
  log(`Selected for AI summary test: ${selectedItems.length}`);
  log(`AI summary enabled: ${settings.summaryEnabled}; API key present: ${Boolean(settings.apiKey)}`);

  for (const item of contentItems) {
    if (selectedIds.has(item.id)) {
      enhancedItems.push(await summarizeItem(selectedById.get(item.id), settings, aiBudget));
    } else {
      enhancedItems.push(buildRuleBasedCard(item, scoreItem(item, settings), "skipped_not_top_n"));
    }
  }

  writeJson(enhancedItemsPath, enhancedItems);
  writeText(enhancedDailyPath, buildEnhancedDailyMarkdown({ date, enhancedItems }));
  writeText(
    aiSummaryTestReportPath,
    buildAiSummaryTestReport({
      startedAt,
      finishedAt: new Date().toISOString(),
      settings,
      selectedItems,
      enhancedItems,
      outputPath: enhancedItemsPath,
      enhancedDailyPath
    })
  );
  writeText(
    aiSummaryEvalReportPath,
    buildAiSummaryEvalReport({
      startedAt,
      finishedAt: new Date().toISOString(),
      settings,
      selectedItems,
      enhancedItems,
      outputPath: enhancedItemsPath,
      enhancedDailyPath
    })
  );
  writeText(
    aiSummaryQualityReviewReportPath,
    buildAiSummaryQualityReviewReport({
      startedAt,
      finishedAt: new Date().toISOString(),
      enhancedItems
    })
  );

  log(`Enhanced items: ${enhancedItemsPath}`);
  log(`Enhanced daily report: ${enhancedDailyPath}`);
  log(`AI summary test report: ${aiSummaryTestReportPath}`);
  log(`AI summary eval report: ${aiSummaryEvalReportPath}`);
  log(`AI summary quality review report: ${aiSummaryQualityReviewReportPath}`);
}

main().catch((caughtError) => {
  error(caughtError.stack || caughtError.message);
  process.exitCode = 1;
});
