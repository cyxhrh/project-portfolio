require("dotenv").config({ quiet: true });

const { readJson, writeText } = require("../utils/fileStore");
const { log } = require("../utils/logger");
const {
  feishuPayloadPreviewPath,
  feishuDryRunReportPath
} = require("../utils/paths");
const {
  loadFeishuSettings,
  describeFeishuSettings,
  validateDryRunSettings,
  validateTestRunSafety
} = require("../feishu/feishuClient");
const { FIELD_DEFINITIONS } = require("../feishu/feishuBitableWriter");

function buildDryRunReport({ startedAt, finishedAt, preview, settings, missing, blockers }) {
  const stats = preview.stats || {};
  const configView = describeFeishuSettings(settings);

  return [
    "# Feishu Dry Run Report",
    "",
    "## 本轮检查范围",
    "- 读取 `output/feishu/feishu_payload_preview.json`。",
    "- 检查飞书环境变量是否存在，但不打印具体值。",
    "- 不调用飞书 API，不获取 tenant_access_token，不写入远端。",
    "",
    "## 运行信息",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    "- Feishu API called: false",
    "- Remote write performed: false",
    "",
    "## Preview 数据检查",
    `- document_payload exists: ${Boolean(preview.document_payload)}`,
    `- document title: ${preview.document_payload?.title || ""}`,
    `- target_type: ${preview.document_payload?.target_type || ""}`,
    `- bitable_records: ${(preview.bitable_records || []).length}`,
    `- real AI summaries: ${stats.ai_summary_success_count || 0}`,
    `- records equal real AI summaries: ${(preview.bitable_records || []).length === (stats.ai_summary_success_count || 0)}`,
    "",
    "## 环境变量存在性检查",
    ...Object.entries(configView).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## 必要配置缺失",
    missing.length ? missing.map((item) => `- ${item}`).join("\n") : "- 无。",
    "",
    "## Test-run 安全开关检查",
    blockers.length ? blockers.map((item) => `- ${item}`).join("\n") : "- 已满足 test-run 安全条件。",
    "",
    "## 测试文档计划",
    `- Target knowledge base name: ${settings.wikiSpaceName}`,
    `- Test document title: [TEST] ${preview.document_payload?.title || ""}`,
    "- Content mode: Markdown as plain text blocks",
    "- If wiki lookup fails, provide `FEISHU_WIKI_SPACE_ID`, `FEISHU_WIKI_PARENT_NODE_TOKEN`, or knowledge base URL.",
    "",
    "## 测试多维表计划",
    `- Test bitable name: ${settings.bitableName}`,
    `- Records to write: ${(preview.bitable_records || []).length}`,
    "- Dedupe strategy: test table is newly created; production sync should dedupe by 原始 URL。",
    "- Fields to create:",
    ...FIELD_DEFINITIONS.map((field) => `  - ${field.name}: ${field.type}`),
    "",
    "## 权限预检清单",
    "- tenant_access_token 获取权限",
    "- 知识库空间读取权限",
    "- 文档创建权限",
    "- 知识库写入权限",
    "- 多维表创建权限",
    "- 多维表字段创建权限",
    "- 多维表记录写入权限",
    "",
    "## 下一步",
    "- 若缺少配置，先补齐 `.env`。",
    "- 只有 `FEISHU_SYNC_ENABLED=true` 且 `FEISHU_TARGET_ENV=test` 时才运行 `npm run feishu:test-sync`。",
    ""
  ].join("\n");
}

function main() {
  const startedAt = new Date().toISOString();
  const preview = readJson(feishuPayloadPreviewPath, null);

  if (!preview) {
    throw new Error(`Missing payload preview: ${feishuPayloadPreviewPath}. Please run npm run feishu:preview first.`);
  }

  const settings = loadFeishuSettings();
  const missing = validateDryRunSettings(settings);
  const blockers = validateTestRunSafety(settings);
  const finishedAt = new Date().toISOString();

  writeText(
    feishuDryRunReportPath,
    buildDryRunReport({
      startedAt,
      finishedAt,
      preview,
      settings,
      missing,
      blockers
    })
  );

  log(`Feishu dry-run report: ${feishuDryRunReportPath}`);
  log(`Feishu API called: false`);
  log(`Bitable records planned: ${(preview.bitable_records || []).length}`);
}

main();
