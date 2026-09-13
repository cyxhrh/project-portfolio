require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { writeText, ensureDir } = require("../utils/fileStore");
const { log } = require("../utils/logger");
const { logsDir, autoRunReportPath } = require("../utils/paths");
const { buildAutoRunReport } = require("../reports/autoRunReport");
const { loadFeishuSyncSettings } = require("../feishu/feishuCliSync");

const STEPS = [
  { name: "collect", danger: "low", failureHandling: "采集失败，停止摘要和飞书同步。" },
  { name: "summarize", danger: "low", failureHandling: "摘要框架失败，保留 raw 数据并停止后续流程。" },
  { name: "enrich:content", danger: "low", failureHandling: "正文抓取失败，保留已有摘要和 raw 数据并停止后续流程。" },
  { name: "summarize:test", danger: "medium", failureHandling: "Top N 摘要失败，保留正文富集数据并停止飞书同步。" },
  { name: "report:enhanced", danger: "low", failureHandling: "日报生成失败，停止飞书文档和多维表同步。" },
  { name: "feishu:sync", danger: "remote_doc", failureHandling: "飞书文档同步失败，不继续写多维表。" },
  { name: "feishu:cli-bitable-test", danger: "remote_bitable", failureHandling: "多维表写入失败，保留日报文档链接和错误报告。" },
  { name: "sync:summary", danger: "local", failureHandling: "总报告生成失败，请查看日志。" }
];

function parseArgs(argv) {
  const modeArg = argv.find((arg) => arg.startsWith("--mode="));
  return {
    mode: (modeArg ? modeArg.split("=")[1] : process.env.AI_INTEL_RUN_MODE || "test").toLowerCase(),
    checkOnly: argv.includes("--check-only")
  };
}

function formatDate(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

function sanitize(text) {
  return String(text || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/tenant_access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+/g, "tenant_access_token=[REDACTED]")
    .replace(/user_access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+/g, "user_access_token=[REDACTED]")
    .replace(/(FEISHU_APP_SECRET|DEEPSEEK_API_KEY|FEISHU_APP_ID)\s*=\s*\S+/g, "$1=[REDACTED]");
}

function appendLog(logPath, message) {
  fs.appendFileSync(logPath, `${message}\n`, "utf8");
}

function runNpmStep(step, logPath, env) {
  const started = Date.now();
  appendLog(logPath, `\n[step:start] ${step.name}`);
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm run ${step.name}`]
    : ["run", step.name];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 600000,
    env
  });

  const stdout = sanitize(result.stdout);
  const stderr = sanitize(result.stderr);
  if (stdout.trim()) appendLog(logPath, stdout.trim());
  if (stderr.trim()) appendLog(logPath, stderr.trim());
  appendLog(logPath, `[step:end] ${step.name} status=${result.status}`);
  if (result.error) {
    appendLog(logPath, `[step:error] ${result.error.message}`);
  }

  return {
    name: step.name,
    status: result.status ?? 1,
    duration_ms: Date.now() - started,
    stdout_tail: stdout.split("\n").slice(-10).join("\n").trim(),
    stderr_tail: [stderr, result.error ? result.error.message : ""].filter(Boolean).join("\n").split("\n").slice(-10).join("\n").trim(),
    handling: step.failureHandling
  };
}

function getSafety(mode) {
  const feishu = loadFeishuSyncSettings();
  const productionConfirmed = process.env.AI_INTEL_CONFIRM_PRODUCTION === "true";
  const isTest = mode === "test";

  return {
    default_test_mode: !process.env.AI_INTEL_RUN_MODE || process.env.AI_INTEL_RUN_MODE === "test" || mode === "test",
    production_confirmed: productionConfirmed,
    formal_write_allowed: mode === "prod" && productionConfirmed,
    feishu_sync_mode: feishu.mode,
    feishu_target_env: feishu.targetEnv,
    test_title_prefix_ok: feishu.docTitlePrefix.startsWith("[TEST]"),
    test_bitable_name_ok: feishu.bitableName.startsWith("[TEST]"),
    blockers: [
      !["test", "prod"].includes(mode) ? `Unsupported AI_INTEL_RUN_MODE: ${mode}` : null,
      isTest && feishu.mode !== "cli" ? "Test automation requires FEISHU_SYNC_MODE=cli" : null,
      isTest && feishu.targetEnv !== "test" ? "Test automation requires FEISHU_TARGET_ENV=test" : null,
      isTest && !feishu.docTitlePrefix.startsWith("[TEST]") ? "Test automation requires FEISHU_DOC_TITLE_PREFIX to start with [TEST]" : null,
      isTest && !feishu.bitableName.startsWith("[TEST]") ? "Test automation requires FEISHU_BITABLE_NAME to start with [TEST]" : null,
      mode === "prod" && !productionConfirmed ? "Production mode requires AI_INTEL_CONFIRM_PRODUCTION=true" : null,
      mode === "prod" && productionConfirmed ? "Production remote writing is not enabled in this quick closeout round" : null
    ].filter(Boolean)
  };
}

function main() {
  const { mode, checkOnly } = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  ensureDir(logsDir);
  const logPath = path.join(logsDir, `ai-intel-auto-${formatDate(new Date())}.log`);
  const steps = [];
  const safety = getSafety(mode);
  let failure = null;

  appendLog(logPath, `\n=== AI Intel Auto Run ${startedAt} ===`);
  appendLog(logPath, `mode=${mode}`);

  if (safety.blockers.length > 0) {
    failure = {
      name: "safety_precheck",
      status: 1,
      handling: safety.blockers.join("; ")
    };
    steps.push({
      name: "safety_precheck",
      status: 1,
      duration_ms: 0,
      reason: safety.blockers.join("; "),
      stdout_tail: "",
      stderr_tail: "",
      handling: failure.handling
    });
  } else if (checkOnly) {
    steps.push({
      name: "safety_precheck",
      status: 0,
      duration_ms: 0,
      reason: "check only, no pipeline executed",
      stdout_tail: "",
      stderr_tail: "",
      handling: ""
    });
  } else {
    const childEnv = {
      ...process.env,
      AI_INTEL_RUN_MODE: mode
    };

    for (const step of STEPS) {
      log(`Auto run step: ${step.name}`);
      const result = runNpmStep(step, logPath, childEnv);
      steps.push(result);
      if (result.status !== 0) {
        failure = result;
        break;
      }
    }
  }

  const finishedAt = new Date().toISOString();
  writeText(autoRunReportPath, buildAutoRunReport({
    startedAt,
    finishedAt,
    mode,
    checkOnly,
    logPath,
    steps,
    failure,
    safety
  }));

  appendLog(logPath, `auto_run_report=${autoRunReportPath}`);
  log(`Auto run report: ${autoRunReportPath}`);
  log(`Auto run log: ${logPath}`);

  if (failure) {
    process.exitCode = 1;
  }
}

main();
