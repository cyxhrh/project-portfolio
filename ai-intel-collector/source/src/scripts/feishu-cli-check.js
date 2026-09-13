require("dotenv").config({ quiet: true });

const { writeText } = require("../utils/fileStore");
const { log } = require("../utils/logger");
const {
  feishuCliCheckReportPath,
  feishuCliSyncPlanPath
} = require("../utils/paths");
const {
  loadFeishuSyncSettings,
  checkCli,
  buildCliSyncPlan,
  loadPayloadPreview
} = require("../feishu/feishuCliSync");

function buildCliCheckReport({ startedAt, finishedAt, settings, check, plan }) {
  return [
    "# Feishu CLI Check Report",
    "",
    "## 本轮检查范围",
    "- 检查本机飞书 CLI 是否存在。",
    "- 检查 CLI 登录/健康状态。",
    "- 读取 Wiki spaces，确认是否能找到知识库「AI一手信息」。",
    "- 不创建文档，不写入飞书，不读取或打印 token/secret。",
    "",
    "## 当前模式",
    `- FEISHU_SYNC_MODE: ${settings.mode}`,
    `- CLI command: ${settings.cliCommand}`,
    `- FEISHU_SYNC_ENABLED: ${settings.syncEnabled}`,
    `- FEISHU_TARGET_ENV: ${settings.targetEnv}`,
    "",
    "## CLI 检查结果",
    `- CLI available: ${check.cli_available}`,
    `- CLI doctor ok: ${check.doctor_ok}`,
    `- Wiki space list ok: ${check.wiki_space_list_ok}`,
    `- Wiki spaces count: ${check.wiki_spaces_count}`,
    `- Target space name: ${check.target_space_name}`,
    `- Target space found: ${check.target_space_found}`,
    `- Target space id present: ${check.target_space_id_present}`,
    "",
    "## 历史 CLI 方案调查结果",
    ...check.historical_findings.map((item) => `- ${item}`),
    "",
    "## CLI 同步计划摘要",
    `- Test document title: ${plan.test_document_title}`,
    `- Can write test doc now: ${plan.can_write_test_doc}`,
    plan.blockers.length ? plan.blockers.map((item) => `- Blocker: ${item}`).join("\n") : "- Blocker: none",
    "",
    "## 错误摘要",
    check.raw_errors.length
      ? check.raw_errors.map((error) => `- ${error.command}: ${error.stderr || error.error || error.status}`).join("\n")
      : "- 暂无 CLI 错误。",
    "",
    `Started at: ${startedAt}`,
    `Finished at: ${finishedAt}`,
    ""
  ].join("\n");
}

function buildCliSyncPlanMarkdown(plan) {
  return [
    "# Feishu CLI Sync Plan",
    "",
    "## 目标",
    "- 使用本机已登录的 lark-cli，把 enhanced daily report 写入飞书知识库测试文档。",
    "- 本轮优先打通 Wiki 文档；多维表保持计划状态。",
    "",
    "## 文档测试同步",
    `- Date: ${plan.date}`,
    `- Daily file: ${plan.daily_path}`,
    `- Target Wiki space: ${plan.target_space_name}`,
    `- Target space id present: ${plan.target_space_id_present}`,
    `- Test document title: ${plan.test_document_title}`,
    `- Can write test doc: ${plan.can_write_test_doc}`,
    "",
    "## 执行步骤",
    ...plan.steps.map((step) => `- ${step}`),
    "",
    "## 阻塞项",
    plan.blockers.length ? plan.blockers.map((item) => `- ${item}`).join("\n") : "- 暂无阻塞项。",
    "",
    "## 多维表计划",
    `- Status: ${plan.bitable_plan.status}`,
    `- Reason: ${plan.bitable_plan.reason}`,
    `- Target name: ${plan.bitable_plan.target_name}`,
    `- Planned record count: ${plan.bitable_plan.record_count}`,
    "",
    "## 安全规则",
    "- 只创建标题带 `[TEST]` 的测试文档。",
    "- 不覆盖正式日报。",
    "- 不同步全部 69 条原始情报。",
    "- 不打印 token/secret。",
    ""
  ].join("\n");
}

function main() {
  const startedAt = new Date().toISOString();
  const settings = loadFeishuSyncSettings();
  const preview = loadPayloadPreview();
  const check = checkCli(settings);
  const plan = buildCliSyncPlan({ settings, check, preview });
  const finishedAt = new Date().toISOString();

  writeText(feishuCliCheckReportPath, buildCliCheckReport({ startedAt, finishedAt, settings, check, plan }));
  writeText(feishuCliSyncPlanPath, buildCliSyncPlanMarkdown(plan));

  log(`Feishu CLI check report: ${feishuCliCheckReportPath}`);
  log(`Feishu CLI sync plan: ${feishuCliSyncPlanPath}`);
  log(`CLI available: ${check.cli_available}; target space found: ${check.target_space_found}`);
}

main();
