const path = require("path");
const { collectRss } = require("./collectors/rssCollector");
const { collectWebpage } = require("./collectors/webpageCollector");
const { collectGithub } = require("./collectors/githubCollector");
const { categorizeItem } = require("./utils/categorize");
const { readJson, writeJson, writeText, ensureDir } = require("./utils/fileStore");
const { hashUrl, makeItemId, normalizeUrl } = require("./utils/normalize");
const { log, warn, error } = require("./utils/logger");
const {
  sourcesPath,
  categoriesPath,
  rawOutputDir,
  dailyOutputDir,
  seenUrlsPath,
  rawItemsPath,
  userFocusPath,
  executionReportPath,
  adapterReportPath
} = require("./utils/paths");
const { formatDate, buildDailyMarkdown, buildExecutionReport, buildAdapterReport } = require("./reporting");

const collectors = {
  rss: collectRss,
  webpage: collectWebpage,
  github: collectGithub
};

function makeReport(source, status, itemCount, errorMessage) {
  return {
    source_id: source.id,
    source_name: source.name,
    source_type: source.type,
    source_priority: source.priority,
    status,
    item_count: itemCount,
    error: errorMessage || null
  };
}

function enrichItem(rawItem, source, categories, collectedAt) {
  const url = normalizeUrl(rawItem.url || source.url);
  const classified = categorizeItem(
    {
      ...rawItem,
      source_name: source.name
    },
    categories
  );

  return {
    id: makeItemId(source.id, url),
    title: rawItem.title,
    url,
    source_name: source.name,
    source_type: source.type,
    source_priority: source.priority,
    published_at: rawItem.published_at || null,
    collected_at: collectedAt,
    category: classified.category,
    importance: classified.importance,
    summary_placeholder: rawItem.summary_placeholder || "",
    status: "new",
    error: null,
    tags: rawItem.tags || [],
    raw: rawItem.raw || {}
  };
}

async function collectSource(source) {
  if (source.status === "pending_confirm" || source.status === "pending_adapter") {
    return {
      report: makeReport(source, source.status, 0, "Source URL or adapter needs confirmation."),
      items: []
    };
  }

  const collector = collectors[source.type];
  if (!collector) {
    return {
      report: makeReport(source, "pending_adapter", 0, `No collector for type: ${source.type}`),
      items: []
    };
  }

  try {
    log(`Collecting ${source.name} (${source.type})`);
    const result = await collector(source);
    return {
      report: makeReport(source, result.status, result.items.length, result.error || (result.status === "success" ? null : "Collector returned no error detail.")),
      items: result.items
    };
  } catch (caughtError) {
    const message = caughtError.message || caughtError.code || caughtError.name || "Unknown collection error.";
    return {
      report: makeReport(source, "failed", 0, message),
      items: []
    };
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const collectedAt = startedAt;
  const userFocus = readJson(userFocusPath, {});
  const timezone = userFocus.timezone || "UTC";
  const date = formatDate(new Date(), timezone);
  const dailyPath = path.join(dailyOutputDir, `ai-intel-daily-${date}.md`);

  ensureDir(rawOutputDir);
  ensureDir(dailyOutputDir);

  const sources = readJson(sourcesPath, []);
  const categories = readJson(categoriesPath, []);
  const seenUrls = readJson(seenUrlsPath, {});
  const reports = [];
  const newItems = [];

  log(`Loaded ${sources.length} sources.`);

  // Each source is isolated so one blocked website does not break the whole run.
  for (const source of sources) {
    const { report, items } = await collectSource(source);
    reports.push(report);

    if (report.status !== "success") {
      warn(`${source.name}: ${report.status}${report.error ? ` - ${report.error}` : ""}`);
      continue;
    }

    // Store only URLs we have not seen before, using a stable hash as the key.
    for (const rawItem of items) {
      const enriched = enrichItem(rawItem, source, categories, collectedAt);
      const urlHash = hashUrl(enriched.url);

      if (seenUrls[urlHash]) {
        continue;
      }

      seenUrls[urlHash] = {
        first_seen_at: collectedAt,
        url: enriched.url,
        title: enriched.title,
        source_name: source.name
      };
      newItems.push(enriched);
    }
  }

  writeJson(seenUrlsPath, seenUrls);
  writeJson(rawItemsPath, newItems);

  const dailyMarkdown = buildDailyMarkdown({
    date,
    sources,
    reports,
    newItems
  });
  writeText(dailyPath, dailyMarkdown);

  const finishedAt = new Date().toISOString();
  const executionReport = buildExecutionReport({
    startedAt,
    finishedAt,
    dailyPath,
    rawItemsPath,
    reports,
    newItems,
    seenCount: Object.keys(seenUrls).length
  });
  writeText(executionReportPath, executionReport);

  const adapterReport = buildAdapterReport({
    startedAt,
    finishedAt,
    reports,
    newItems
  });
  writeText(adapterReportPath, adapterReport);

  log(`New items: ${newItems.length}`);
  log(`Daily markdown: ${dailyPath}`);
  log(`Execution report: ${executionReportPath}`);
  log(`Adapter report: ${adapterReportPath}`);
}

main().catch((caughtError) => {
  error(caughtError.stack || caughtError.message);
  process.exitCode = 1;
});
