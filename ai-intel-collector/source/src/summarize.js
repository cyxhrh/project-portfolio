const path = require("path");
const { readJson, writeJson, writeText, ensureDir } = require("./utils/fileStore");
const { log, error } = require("./utils/logger");
const {
  rawItemsPath,
  enhancedOutputDir,
  enhancedItemsPath,
  dailyOutputDir,
  userFocusPath,
  summaryReportPath
} = require("./utils/paths");
const { loadModelSettings } = require("./llm/openaiCompatibleClient");
const { summarizeItems } = require("./agents/summarizerAgent");
const { formatDate, buildEnhancedDailyMarkdown, buildSummaryReport } = require("./reporting");

async function runSummarize() {
  const startedAt = new Date().toISOString();
  const rawItems = readJson(rawItemsPath, []);
  const userFocus = readJson(userFocusPath, {});
  const settings = loadModelSettings();
  const date = formatDate(new Date(), userFocus.timezone || "UTC");
  const enhancedDailyPath = path.join(dailyOutputDir, `enhanced-ai-intel-daily-${date}.md`);

  ensureDir(enhancedOutputDir);
  ensureDir(dailyOutputDir);

  log(`Loaded raw items: ${rawItems.length}`);
  log(`AI summary enabled: ${settings.summaryEnabled}; API key present: ${Boolean(settings.apiKey)}`);

  const enhancedItems = await summarizeItems(rawItems, settings);
  writeJson(enhancedItemsPath, enhancedItems);
  writeText(
    enhancedDailyPath,
    buildEnhancedDailyMarkdown({
      date,
      enhancedItems
    })
  );

  const finishedAt = new Date().toISOString();
  writeText(
    summaryReportPath,
    buildSummaryReport({
      startedAt,
      finishedAt,
      settings,
      rawCount: rawItems.length,
      enhancedItems,
      enhancedItemsPath,
      enhancedDailyPath
    })
  );

  log(`Enhanced items: ${enhancedItemsPath}`);
  log(`Enhanced daily report: ${enhancedDailyPath}`);
  log(`Summary report: ${summaryReportPath}`);
}

runSummarize().catch((caughtError) => {
  error(caughtError.stack || caughtError.message);
  process.exitCode = 1;
});
