require("dotenv").config({ quiet: true });

const { spawnSync } = require("child_process");
const { writeText } = require("../utils/fileStore");
const { log } = require("../utils/logger");
const {
  dailySyncSummaryReportPath,
  syncClosureReportPath
} = require("../utils/paths");
const {
  buildDailySyncSummaryReport,
  buildSyncClosureReport
} = require("../reports/dailySyncSummary");
const { loadFeishuSyncSettings } = require("../feishu/feishuCliSync");

const STEPS = [
  "collect",
  "summarize",
  "enrich:content",
  "summarize:test",
  "report:enhanced",
  "feishu:sync",
  "feishu:cli-bitable-test",
  "sync:summary"
];

function sanitize(text) {
  return String(text || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/tenant_access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+/g, "tenant_access_token=[REDACTED]")
    .replace(/user_access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+/g, "user_access_token=[REDACTED]");
}

function assertSafeFeishuTestMode() {
  const settings = loadFeishuSyncSettings();
  const blockers = [];

  if (settings.mode !== "cli") blockers.push("FEISHU_SYNC_MODE is not cli");
  if (!settings.syncEnabled) blockers.push("FEISHU_SYNC_ENABLED is not true");
  if (settings.targetEnv !== "test") blockers.push("FEISHU_TARGET_ENV is not test");
  if (!settings.docTitlePrefix.startsWith("[TEST]")) blockers.push("FEISHU_DOC_TITLE_PREFIX must start with [TEST]");
  if (!settings.bitableName.startsWith("[TEST]")) blockers.push("FEISHU_BITABLE_NAME must start with [TEST]");

  return blockers;
}

function runNpmStep(name) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", name], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 300000
  });

  return {
    name,
    status: result.status,
    stdout_tail: sanitize(result.stdout).split("\n").slice(-8).join("\n"),
    stderr_tail: sanitize(result.stderr).split("\n").slice(-8).join("\n")
  };
}

function main() {
  const startedAt = new Date().toISOString();
  const steps = [];

  for (const step of STEPS) {
    if (step.startsWith("feishu:")) {
      const blockers = assertSafeFeishuTestMode();
      if (blockers.length > 0) {
        steps.push({
          name: step,
          status: 1,
          stdout_tail: "",
          stderr_tail: blockers.join("; ")
        });
        break;
      }
    }

    log(`Running daily test step: ${step}`);
    const result = runNpmStep(step);
    steps.push(result);

    if (result.status !== 0) {
      break;
    }
  }

  const finishedAt = new Date().toISOString();
  writeText(dailySyncSummaryReportPath, buildDailySyncSummaryReport({ startedAt, finishedAt }));
  writeText(
    syncClosureReportPath,
    buildSyncClosureReport({
      startedAt,
      finishedAt,
      steps,
      summaryPath: dailySyncSummaryReportPath
    })
  );

  log(`Daily sync summary report: ${dailySyncSummaryReportPath}`);
  log(`Sync closure report: ${syncClosureReportPath}`);

  const failed = steps.find((step) => step.status !== 0);
  if (failed) {
    log(`Daily test stopped at ${failed.name}`);
    process.exitCode = 1;
  } else {
    log("Daily test sync closure completed.");
  }
}

main();
