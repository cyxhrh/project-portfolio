const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { formatDate } = require("../reporting");
const { readJson } = require("../utils/fileStore");
const {
  dailyOutputDir,
  feishuPayloadPreviewPath,
  userFocusPath
} = require("../utils/paths");

function boolFromEnv(value) {
  return String(value || "").toLowerCase() === "true";
}

function loadFeishuSyncSettings(env = process.env) {
  return {
    mode: (env.FEISHU_SYNC_MODE || "cli").toLowerCase(),
    syncEnabled: boolFromEnv(env.FEISHU_SYNC_ENABLED),
    targetEnv: env.FEISHU_TARGET_ENV || "test",
    cliCommand: env.FEISHU_CLI_COMMAND || "lark-cli",
    wikiSpaceName: env.FEISHU_WIKI_SPACE_NAME || "AI一手信息",
    wikiSpaceId: env.FEISHU_WIKI_SPACE_ID || "",
    wikiParentNodeToken: env.FEISHU_WIKI_PARENT_NODE_TOKEN || "",
    docTitlePrefix: env.FEISHU_DOC_TITLE_PREFIX || "[TEST]",
    bitableName: env.FEISHU_BITABLE_NAME || "[TEST] AI 一手情报库"
  };
}

function sanitizeOutput(text) {
  return String(text || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/tenant_access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+/g, "tenant_access_token=[REDACTED]")
    .replace(/user_access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+/g, "user_access_token=[REDACTED]");
}

function quoteArg(arg) {
  const text = String(arg);
  return `'${text.replace(/'/g, "''")}'`;
}

function runCli(command, args, options = {}) {
  const commandLine = `& ${quoteArg(command)} ${args.map(quoteArg).join(" ")}`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", commandLine], {
    cwd: options.cwd || process.cwd(),
    encoding: "utf8",
    shell: false,
    timeout: options.timeoutMs || 60000
  });

  return {
    command,
    args,
    status: result.status,
    ok: result.status === 0,
    stdout: sanitizeOutput(result.stdout),
    stderr: sanitizeOutput(result.stderr),
    error: result.error ? result.error.message : null
  };
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function currentDailyPath() {
  const userFocus = readJson(userFocusPath, {});
  const date = formatDate(new Date(), userFocus.timezone || "UTC");
  return {
    date,
    dailyPath: path.join(dailyOutputDir, `enhanced-ai-intel-daily-${date}.md`)
  };
}

function findWikiSpace(spaceListJson, settings) {
  const spaces = spaceListJson?.data?.spaces || [];
  if (settings.wikiSpaceId) {
    return spaces.find((space) => space.space_id === settings.wikiSpaceId) || {
      name: settings.wikiSpaceName,
      space_id: settings.wikiSpaceId,
      from_env: true
    };
  }

  return spaces.find((space) => space.name === settings.wikiSpaceName);
}

function collectHistoricalCliFindings() {
  return [
    "Found prior evidence in GitHub热门项目提取skill reports: lark-cli doctor passed and lark-cli wiki +space-list was used to resolve Wiki spaces.",
    "Prior successful pattern: lark-cli wiki +node-create --space-id <space_id> --obj-type docx --title <title> with dry-run before real write.",
    "Current project keeps this pattern and adds docs +update --doc-format markdown to write the daily Markdown into the created test document.",
    "Bitable CLI exists through lark-cli base, but this round keeps bitable as a planned second step."
  ];
}

function checkCli(settings) {
  const help = runCli(settings.cliCommand, ["--help"], { timeoutMs: 20000 });
  const doctor = runCli(settings.cliCommand, ["doctor"], { timeoutMs: 60000 });
  const spaceList = runCli(settings.cliCommand, ["wiki", "+space-list"], { timeoutMs: 60000 });
  const spaceListJson = tryParseJson(spaceList.stdout);
  const matchedSpace = findWikiSpace(spaceListJson, settings);

  return {
    cli_command: settings.cliCommand,
    cli_available: help.ok,
    doctor_ok: doctor.ok,
    doctor_summary: tryParseJson(doctor.stdout) || null,
    wiki_space_list_ok: spaceList.ok,
    wiki_spaces_count: spaceListJson?.meta?.count ?? (spaceListJson?.data?.spaces || []).length,
    target_space_name: settings.wikiSpaceName,
    target_space_found: Boolean(matchedSpace),
    target_space_id: matchedSpace?.space_id || "",
    target_space_id_present: Boolean(matchedSpace?.space_id),
    historical_findings: collectHistoricalCliFindings(),
    raw_errors: [help, doctor, spaceList]
      .filter((item) => !item.ok)
      .map((item) => ({
        command: `${item.command} ${item.args.join(" ")}`,
        status: item.status,
        stderr: item.stderr,
        error: item.error
      }))
  };
}

function buildCliSyncPlan({ settings, check, preview }) {
  const { date, dailyPath } = currentDailyPath();
  const title = `${settings.docTitlePrefix} ${preview?.document_payload?.title || `AI 情报日报 - ${date}`}`;

  return {
    mode: "cli",
    date,
    daily_path: dailyPath,
    target_space_name: settings.wikiSpaceName,
    target_space_id_present: check.target_space_id_present,
    target_space_id: check.target_space_id,
    test_document_title: title,
    steps: [
      "Run lark-cli doctor.",
      "Resolve Wiki space with lark-cli wiki +space-list.",
      "Create a test docx node with lark-cli wiki +node-create.",
      "Overwrite created docx with enhanced daily Markdown using lark-cli docs +update --doc-format markdown.",
      "Keep bitable sync as a second step; do not write 69 raw items."
    ],
    can_write_test_doc: settings.syncEnabled && settings.targetEnv === "test" && check.cli_available && check.doctor_ok && check.target_space_id_present && fs.existsSync(dailyPath),
    blockers: [
      !settings.syncEnabled ? "FEISHU_SYNC_ENABLED is not true" : null,
      settings.targetEnv !== "test" ? "FEISHU_TARGET_ENV is not test" : null,
      !check.cli_available ? "lark-cli is not available" : null,
      !check.doctor_ok ? "lark-cli doctor failed" : null,
      !check.target_space_id_present ? "target Wiki space was not found" : null,
      !fs.existsSync(dailyPath) ? `daily report missing: ${dailyPath}` : null
    ].filter(Boolean),
    bitable_plan: {
      status: "planned_not_executed",
      reason: "CLI mode first validates Wiki document sync. Bitable writing will use lark-cli base in a later step.",
      target_name: settings.bitableName,
      record_count: preview?.bitable_records?.length || 0
    }
  };
}

function extractCreatedDocToken(nodeCreateJson) {
  const data = nodeCreateJson?.data || {};
  const node = data.node || data;
  return node.obj_token || node.document_id || node.token || "";
}

function extractCreatedUrl(nodeCreateJson) {
  const data = nodeCreateJson?.data || {};
  const node = data.node || data;
  return node.url || data.url || "";
}

function runCliTestSync({ settings, plan }) {
  if (!plan.can_write_test_doc) {
    return {
      status: "blocked",
      blockers: plan.blockers,
      remote_write_performed: false
    };
  }

  const createArgs = [
    "wiki",
    "+node-create",
    "--space-id",
    plan.target_space_id,
    "--obj-type",
    "docx",
    "--title",
    plan.test_document_title,
    "--format",
    "json"
  ];

  if (settings.wikiParentNodeToken) {
    createArgs.push("--parent-node-token", settings.wikiParentNodeToken);
  }

  const createResult = runCli(settings.cliCommand, createArgs, { timeoutMs: 60000 });
  const createJson = tryParseJson(createResult.stdout);
  const docToken = extractCreatedDocToken(createJson);
  const url = extractCreatedUrl(createJson);

  if (!createResult.ok || !docToken) {
    return {
      status: "failed",
      step: "wiki_node_create",
      remote_write_performed: createResult.ok,
      create_result: {
        ok: createResult.ok,
        status: createResult.status,
        stderr: createResult.stderr,
        stdout_summary: createJson ? "json_returned" : createResult.stdout.slice(0, 500)
      }
    };
  }

  const relativeDailyPath = path.relative(process.cwd(), plan.daily_path).replace(/\\/g, "/");
  const updateResult = runCli(
    settings.cliCommand,
    [
      "docs",
      "+update",
      "--api-version",
      "v2",
      "--doc",
      docToken,
      "--command",
      "overwrite",
      "--doc-format",
      "markdown",
      "--content",
      `@${relativeDailyPath}`,
      "--format",
      "json"
    ],
    { timeoutMs: 120000 }
  );
  const updateJson = tryParseJson(updateResult.stdout);

  return {
    status: updateResult.ok ? "success" : "partial_failed",
    remote_write_performed: true,
    document_title: plan.test_document_title,
    document_token_present: Boolean(docToken),
    document_url: url,
    content_update_ok: updateResult.ok,
    content_update_summary: updateJson?.data?.result || updateJson?.data?.document?.result || (updateResult.ok ? "success" : "failed"),
    create_result: {
      ok: createResult.ok,
      status: createResult.status
    },
    update_result: {
      ok: updateResult.ok,
      status: updateResult.status,
      stderr: updateResult.stderr,
      stdout_summary: updateJson ? "json_returned" : updateResult.stdout.slice(0, 500)
    }
  };
}

function loadPayloadPreview() {
  return readJson(feishuPayloadPreviewPath, null);
}

module.exports = {
  loadFeishuSyncSettings,
  runCli,
  checkCli,
  buildCliSyncPlan,
  runCliTestSync,
  loadPayloadPreview,
  currentDailyPath
};
