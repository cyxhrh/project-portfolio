require("dotenv").config({ quiet: true });

const { readJson, writeText } = require("../utils/fileStore");
const { log } = require("../utils/logger");
const {
  feishuPayloadPreviewPath,
  feishuTestSyncReportPath
} = require("../utils/paths");
const {
  FeishuClient,
  loadFeishuSettings,
  describeFeishuSettings,
  validateTestRunSafety,
  sanitizeError
} = require("../feishu/feishuClient");
const { createTestWikiDocument } = require("../feishu/feishuDocWriter");
const { createTestBitableAndWriteRecords } = require("../feishu/feishuBitableWriter");

function safeJson(value) {
  return JSON.stringify(value, null, 2).replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]");
}

function summarizeDocResult(result) {
  if (!result) {
    return ["- Document attempted: false"];
  }

  return [
    `- Document attempted: true`,
    `- Document status: ${result.status}`,
    `- Step: ${result.step || "complete"}`,
    `- Title: ${result.title || ""}`,
    `- URL present: ${Boolean(result.url)}`,
    `- Document id present: ${Boolean(result.document_id)}`,
    `- Node token present: ${Boolean(result.node_token)}`,
    `- Content write status: ${result.content_write?.status || "unknown"}`,
    result.error ? `- Error: ${safeJson(result.error)}` : null,
    result.required_input ? `- Required input: ${result.required_input.join(", ")}` : null,
    result.missing_permissions ? `- Missing permissions: ${result.missing_permissions.join(", ")}` : null
  ].filter(Boolean);
}

function summarizeBitableResult(result) {
  if (!result) {
    return ["- Bitable attempted: false"];
  }

  const failedFields = (result.field_results || []).filter((field) => field.status !== "success");

  return [
    `- Bitable attempted: true`,
    `- Bitable status: ${result.status}`,
    `- Step: ${result.step || "complete"}`,
    `- App token present: ${Boolean(result.app_token_present)}`,
    `- Table id present: ${Boolean(result.table_id_present)}`,
    `- Fields created: ${(result.field_results || []).filter((field) => field.status === "success").length}`,
    `- Fields failed: ${failedFields.length}`,
    `- Records requested: ${result.records?.requested_count || 0}`,
    `- Records response count: ${result.records?.response_count || 0}`,
    `- Dedupe strategy: ${result.dedupe_strategy || "not_applied"}`,
    result.error ? `- Error: ${safeJson(result.error)}` : null,
    result.required_input ? `- Required input: ${result.required_input.join(", ")}` : null,
    result.missing_permissions ? `- Missing permissions: ${result.missing_permissions.join(", ")}` : null,
    failedFields.length ? `- Failed fields: ${failedFields.map((field) => field.field).join(", ")}` : null
  ].filter(Boolean);
}

function buildTestSyncReport({
  startedAt,
  finishedAt,
  preview,
  settings,
  blockers,
  apiCalled,
  tokenPresent,
  documentResult,
  bitableResult,
  authError
}) {
  const configView = describeFeishuSettings(settings);

  return [
    "# Feishu Test Sync Report",
    "",
    "## 安全边界",
    "- 本轮只允许测试写入。",
    "- 不写正式知识库，不覆盖正式日报，不写入全部 69 条。",
    "- tenant_access_token 只保存在内存中，不写入报告。",
    "- 报告只显示 token_present=true/false。",
    "",
    "## 运行信息",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- Feishu API called: ${apiCalled}`,
    `- token_present: ${tokenPresent}`,
    `- Payload records: ${(preview.bitable_records || []).length}`,
    "",
    "## 配置检查",
    ...Object.entries(configView).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## 安全开关结果",
    blockers.length ? blockers.map((item) => `- BLOCKED: ${item}`).join("\n") : "- PASS: FEISHU_SYNC_ENABLED=true and FEISHU_TARGET_ENV=test",
    "",
    "## 认证结果",
    authError ? `- Auth failed: ${safeJson(authError)}` : `- Auth status: ${tokenPresent ? "success" : "not_attempted"}`,
    "",
    "## 测试文档写入结果",
    ...summarizeDocResult(documentResult),
    "",
    "## 测试多维表写入结果",
    ...summarizeBitableResult(bitableResult),
    "",
    "## 失败记录",
    authError || documentResult?.status === "failed" || bitableResult?.status === "failed"
      ? [
          authError ? `- auth: ${safeJson(authError)}` : null,
          documentResult?.status === "failed" ? `- document: ${safeJson(documentResult.error || documentResult)}` : null,
          bitableResult?.status === "failed" ? `- bitable: ${safeJson(bitableResult.error || bitableResult)}` : null
        ].filter(Boolean).join("\n")
      : "- 暂无失败记录。",
    "",
    "## 权限缺失提示",
    authError
      ? "- tenant_access_token 获取权限"
      : [
          ...(documentResult?.missing_permissions || []),
          ...(bitableResult?.missing_permissions || [])
        ].length
        ? Array.from(new Set([...(documentResult?.missing_permissions || []), ...(bitableResult?.missing_permissions || [])])).map((item) => `- ${item}`).join("\n")
        : "- 暂无明确权限缺失。",
    "",
    "## 回滚建议",
    "- 本轮只创建测试文档和测试多维表；若内容不满意，可在飞书测试空间中手动删除。",
    "- 正式同步前增加按原始 URL 去重与同日期日报覆盖保护。",
    "- 若知识库定位失败，请提供 `FEISHU_WIKI_SPACE_ID`、`FEISHU_WIKI_PARENT_NODE_TOKEN` 或知识库 URL 后重跑。",
    ""
  ].join("\n");
}

async function main() {
  const startedAt = new Date().toISOString();
  const preview = readJson(feishuPayloadPreviewPath, null);

  if (!preview) {
    throw new Error(`Missing payload preview: ${feishuPayloadPreviewPath}. Please run npm run feishu:preview first.`);
  }

  const settings = loadFeishuSettings();
  const blockers = validateTestRunSafety(settings);
  let apiCalled = false;
  let tokenPresent = false;
  let authError = null;
  let documentResult = null;
  let bitableResult = null;

  if (blockers.length === 0) {
    const client = new FeishuClient(settings);
    try {
      apiCalled = true;
      await client.getTenantAccessToken();
      tokenPresent = client.tokenPresent();
      log(`token_present=${tokenPresent}`);

      documentResult = await createTestWikiDocument(client, settings, preview.document_payload);
      bitableResult = await createTestBitableAndWriteRecords(client, settings, preview.bitable_records || []);
    } catch (error) {
      authError = sanitizeError(error);
    }
  } else {
    log("Feishu test-sync blocked by safety checks. API called: false");
  }

  const finishedAt = new Date().toISOString();
  writeText(
    feishuTestSyncReportPath,
    buildTestSyncReport({
      startedAt,
      finishedAt,
      preview,
      settings,
      blockers,
      apiCalled,
      tokenPresent,
      documentResult,
      bitableResult,
      authError
    })
  );

  log(`Feishu test sync report: ${feishuTestSyncReportPath}`);
  log(`Feishu API called: ${apiCalled}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
