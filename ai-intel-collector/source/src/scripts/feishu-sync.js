require("dotenv").config({ quiet: true });

const { spawnSync } = require("child_process");
const { writeText } = require("../utils/fileStore");
const { log } = require("../utils/logger");
const {
  feishuSyncModeReportPath,
  feishuCliTestSyncReportPath
} = require("../utils/paths");
const {
  loadFeishuSyncSettings,
  checkCli,
  buildCliSyncPlan,
  runCliTestSync,
  loadPayloadPreview
} = require("../feishu/feishuCliSync");
const { describeFeishuSettings, loadFeishuSettings } = require("../feishu/feishuClient");

function runNpmScript(scriptName) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", scriptName], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 180000
  });

  return {
    script: scriptName,
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || "").replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]"),
    stderr: String(result.stderr || "").replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
  };
}

function buildModeReport({ startedAt, finishedAt, settings, check, plan, syncResult, apiConfig }) {
  return [
    "# Feishu Sync Mode Report",
    "",
    "## 当前同步模式",
    `- FEISHU_SYNC_MODE: ${settings.mode}`,
    `- Default mode: cli`,
    `- FEISHU_SYNC_ENABLED: ${settings.syncEnabled}`,
    `- FEISHU_TARGET_ENV: ${settings.targetEnv}`,
    "",
    "## CLI 模式状态",
    check
      ? [
          `- CLI command: ${settings.cliCommand}`,
          `- CLI available: ${check.cli_available}`,
          `- CLI doctor ok: ${check.doctor_ok}`,
          `- Target Wiki space found: ${check.target_space_found}`,
          `- Target space id present: ${check.target_space_id_present}`
        ].join("\n")
      : "- CLI check not executed in this mode.",
    "",
    "## API fallback 状态",
    `- API mode retained: true`,
    `- API app id present: ${apiConfig.app_id_present}`,
    `- API app secret present: ${apiConfig.app_secret_present}`,
    `- API safety switch retained: FEISHU_SYNC_ENABLED=false by default, FEISHU_TARGET_ENV=test`,
    "",
    "## 实际写入结果",
    `- Remote write performed: ${Boolean(syncResult?.remote_write_performed)}`,
    `- Result status: ${syncResult?.status || "not_run"}`,
    plan ? `- Planned test document title: ${plan.test_document_title}` : "- Planned test document title: n/a",
    syncResult?.document_url ? `- Document URL: ${syncResult.document_url}` : "- Document URL: not available",
    "",
    "## 阻塞或失败原因",
    syncResult?.blockers?.length
      ? syncResult.blockers.map((item) => `- ${item}`).join("\n")
      : syncResult?.status && syncResult.status !== "success"
        ? `- ${JSON.stringify(syncResult)}`
        : "- 暂无。",
    "",
    `Started at: ${startedAt}`,
    `Finished at: ${finishedAt}`,
    ""
  ].join("\n");
}

function buildCliTestSyncReport({ startedAt, finishedAt, settings, plan, syncResult }) {
  return [
    "# Feishu CLI Test Sync Report",
    "",
    "## 安全边界",
    "- 仅 CLI 模式。",
    "- 只创建 `[TEST]` 测试文档。",
    "- 不覆盖正式日报。",
    "- 不写入全部 69 条。",
    "- 本轮多维表不写入，只保留计划。",
    "- 不打印 token/secret。",
    "",
    "## 运行信息",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- CLI command: ${settings.cliCommand}`,
    `- Remote write performed: ${Boolean(syncResult.remote_write_performed)}`,
    `- Status: ${syncResult.status}`,
    "",
    "## 文档写入结果",
    `- Test document title: ${plan.test_document_title}`,
    `- Target space: ${plan.target_space_name}`,
    `- Document token present: ${Boolean(syncResult.document_token_present)}`,
    syncResult.document_url ? `- Document URL: ${syncResult.document_url}` : "- Document URL: not available",
    `- Content update ok: ${Boolean(syncResult.content_update_ok)}`,
    `- Content update summary: ${syncResult.content_update_summary || "n/a"}`,
    "",
    "## 多维表结果",
    `- Status: ${plan.bitable_plan.status}`,
    `- Reason: ${plan.bitable_plan.reason}`,
    `- Planned records: ${plan.bitable_plan.record_count}`,
    "",
    "## 阻塞或错误",
    syncResult.blockers?.length
      ? syncResult.blockers.map((item) => `- ${item}`).join("\n")
      : syncResult.status === "success"
        ? "- 暂无。"
        : `- ${JSON.stringify(syncResult)}`,
    ""
  ].join("\n");
}

function main() {
  const startedAt = new Date().toISOString();
  const settings = loadFeishuSyncSettings();
  const apiConfig = describeFeishuSettings(loadFeishuSettings());
  let check = null;
  let plan = null;
  let syncResult = null;

  if (settings.mode === "api") {
    const dry = runNpmScript("feishu:api-dry-run");
    const test = settings.syncEnabled && settings.targetEnv === "test" ? runNpmScript("feishu:api-test-sync") : null;
    syncResult = {
      status: dry.ok && (!test || test.ok) ? "api_flow_completed" : "api_flow_failed",
      remote_write_performed: Boolean(test),
      dry_run: { ok: dry.ok, status: dry.status },
      test_run: test ? { ok: test.ok, status: test.status } : null
    };
  } else if (settings.mode === "cli") {
    const preview = loadPayloadPreview();
    check = checkCli(settings);
    plan = buildCliSyncPlan({ settings, check, preview });
    syncResult = runCliTestSync({ settings, plan });
    writeText(feishuCliTestSyncReportPath, buildCliTestSyncReport({
      startedAt,
      finishedAt: new Date().toISOString(),
      settings,
      plan,
      syncResult
    }));
  } else {
    syncResult = {
      status: "blocked",
      remote_write_performed: false,
      blockers: [`Unsupported FEISHU_SYNC_MODE: ${settings.mode}`]
    };
  }

  const finishedAt = new Date().toISOString();
  writeText(feishuSyncModeReportPath, buildModeReport({
    startedAt,
    finishedAt,
    settings,
    check,
    plan,
    syncResult,
    apiConfig
  }));

  log(`Feishu sync mode report: ${feishuSyncModeReportPath}`);
  if (settings.mode === "cli") {
    log(`Feishu CLI test sync report: ${feishuCliTestSyncReportPath}`);
  }
  log(`Feishu sync mode: ${settings.mode}; status: ${syncResult.status}`);
}

main();
