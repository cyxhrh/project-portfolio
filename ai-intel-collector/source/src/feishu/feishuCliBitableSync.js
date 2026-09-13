const fs = require("fs");
const path = require("path");
const { ensureDir, readJson, writeJson } = require("../utils/fileStore");
const { runCli, loadFeishuSyncSettings, loadPayloadPreview } = require("./feishuCliSync");
const {
  feishuOutputDir,
  feishuCliBitableStatePath,
  feishuCliBitableFieldsPath,
  feishuCliBitableRecordsPath,
  feishuCliBitableDailyDocLinkFieldPath,
  feishuCliBitablePatchPath,
  feishuCliTestSyncReportPath
} = require("../utils/paths");

const FIELD_NAMES = [
  "标题",
  "来源",
  "链接",
  "分类",
  "重要度",
  "摘要类型",
  "一句话摘要",
  "为什么重要",
  "项目启发",
  "建议行动",
  "是否建议深挖",
  "置信度",
  "采集日期",
  "内容抓取状态",
  "人工核验状态",
  "原始 URL",
  "日报文档链接"
];

function buildFieldDefinitions() {
  return [
    { type: "text", name: "标题" },
    { type: "text", name: "来源" },
    { type: "text", name: "链接", style: { type: "url" } },
    { type: "text", name: "分类" },
    { type: "number", name: "重要度", style: { type: "plain", precision: 0 } },
    { type: "text", name: "摘要类型" },
    { type: "text", name: "一句话摘要" },
    { type: "text", name: "为什么重要" },
    { type: "text", name: "项目启发" },
    { type: "text", name: "建议行动" },
    { type: "text", name: "是否建议深挖" },
    { type: "text", name: "置信度" },
    { type: "text", name: "采集日期" },
    { type: "text", name: "内容抓取状态" },
    { type: "text", name: "人工核验状态" },
    { type: "text", name: "原始 URL", style: { type: "url" } },
    { type: "text", name: "日报文档链接", style: { type: "url" } }
  ];
}

function fieldValue(fields, name, fallback = "") {
  const value = fields?.[name];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return value;
}

function getLatestDailyDocUrl() {
  if (!fs.existsSync(feishuCliTestSyncReportPath)) {
    return "";
  }

  const text = fs.readFileSync(feishuCliTestSyncReportPath, "utf8");
  const match = text.match(/- Document URL:\s*(https?:\/\/\S+)/);
  return match ? match[1].trim() : "";
}

function mapRecordToRow(record, dailyDocUrl = "") {
  const fields = record.fields || {};
  const url = fieldValue(fields, "链接");

  return [
    fieldValue(fields, "标题"),
    fieldValue(fields, "来源"),
    url,
    fieldValue(fields, "分类"),
    Number(fieldValue(fields, "重要度", 0)) || 0,
    fieldValue(fields, "摘要类型"),
    fieldValue(fields, "一句话摘要"),
    fieldValue(fields, "为什么重要"),
    fieldValue(fields, "项目启发"),
    fieldValue(fields, "建议行动"),
    fieldValue(fields, "是否建议深挖") ? "是" : "否",
    fieldValue(fields, "置信度", "未知"),
    fieldValue(fields, "采集日期"),
    fieldValue(fields, "内容抓取状态", "unknown"),
    fieldValue(fields, "人工核验状态", "待核验"),
    url,
    dailyDocUrl
  ];
}

function buildBatchCreatePayload(records, dailyDocUrl = "") {
  return {
    fields: FIELD_NAMES,
    rows: records.map((record) => mapRecordToRow(record, dailyDocUrl))
  };
}

function extractBaseToken(json) {
  const data = json?.data || {};
  return data.base?.base_token || data.base?.app_token || data.base?.token || data.app?.app_token || data.app_token || data.token || "";
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function extractBaseUrl(json) {
  const data = json?.data || {};
  return data.base?.url || data.app?.url || data.url || "";
}

function extractTableId(json) {
  const data = json?.data || {};
  const table = data.table || data.base?.table || data.tables?.[0] || data.base?.tables?.[0] || {};
  return table.table_id || table.id || data.table_id || "";
}

function buildBitableContext() {
  const settings = loadFeishuSyncSettings();
  const preview = loadPayloadPreview();
  const records = preview?.bitable_records || [];
  const state = readJson(feishuCliBitableStatePath, null);
  const dailyDocUrl = getLatestDailyDocUrl();

  return {
    settings,
    preview,
    records,
    state,
    dailyDocUrl,
    fieldDefinitions: buildFieldDefinitions(),
    batchPayload: buildBatchCreatePayload(records, dailyDocUrl)
  };
}

function checkBitableCli(context = buildBitableContext()) {
  const { settings, records, fieldDefinitions, state } = context;
  const baseHelp = runCli(settings.cliCommand, ["base", "--help"], { timeoutMs: 20000 });
  const createHelp = runCli(settings.cliCommand, ["base", "+base-create", "--help"], { timeoutMs: 20000 });
  const recordHelp = runCli(settings.cliCommand, ["base", "+record-batch-create", "--help"], { timeoutMs: 20000 });

  return {
    cli_command: settings.cliCommand,
    sync_mode: settings.mode,
    sync_enabled: settings.syncEnabled,
    target_env: settings.targetEnv,
    base_available: baseHelp.ok,
    base_create_supported: createHelp.ok,
    record_batch_create_supported: recordHelp.ok,
    bitable_name: settings.bitableName,
    planned_record_count: records.length,
    field_count: fieldDefinitions.length,
    existing_state_found: Boolean(state?.status === "success"),
    existing_state_url_present: Boolean(state?.base_url),
    can_write_test_bitable:
      settings.mode === "cli" &&
      settings.syncEnabled &&
      settings.targetEnv === "test" &&
      baseHelp.ok &&
      createHelp.ok &&
      recordHelp.ok &&
      records.length === 10 &&
      true,
    blockers: [
      settings.mode !== "cli" ? "FEISHU_SYNC_MODE is not cli" : null,
      !settings.syncEnabled ? "FEISHU_SYNC_ENABLED is not true" : null,
      settings.targetEnv !== "test" ? "FEISHU_TARGET_ENV is not test" : null,
      !baseHelp.ok ? "lark-cli base is not available" : null,
      !createHelp.ok ? "lark-cli base +base-create is not available" : null,
      !recordHelp.ok ? "lark-cli base +record-batch-create is not available" : null,
      records.length !== 10 ? `expected 10 records, got ${records.length}` : null
    ].filter(Boolean)
  };
}

function persistBitableJsonFiles(context) {
  ensureDir(feishuOutputDir);
  writeJson(feishuCliBitableFieldsPath, context.fieldDefinitions);
  writeJson(feishuCliBitableRecordsPath, context.batchPayload);

  return {
    fields_path: feishuCliBitableFieldsPath,
    records_path: feishuCliBitableRecordsPath
  };
}

function extractUrlFromCell(value) {
  const text = String(value || "");
  const markdownMatch = text.match(/\((https?:\/\/[^)]+)\)/);
  if (markdownMatch) {
    return markdownMatch[1];
  }

  const rawMatch = text.match(/https?:\/\/\S+/);
  return rawMatch ? rawMatch[0] : "";
}

function resolveExistingBitable(context) {
  const state = context.state;
  if (!state?.base_url) {
    return {
      status: "missing_state",
      error: "No existing test bitable state with base_url."
    };
  }

  const resolveResult = runCli(
    context.settings.cliCommand,
    ["base", "+url-resolve", "--url", state.base_url, "--as", "user", "--format", "json"],
    { timeoutMs: 60000 }
  );
  const resolveJson = tryParseJson(resolveResult.stdout);
  const baseToken = resolveJson?.data?.base_token || "";

  if (!resolveResult.ok || !baseToken) {
    return {
      status: "failed",
      step: "url_resolve",
      error: resolveResult.stderr || resolveResult.stdout,
      base_token_present: Boolean(baseToken)
    };
  }

  const tableResult = runCli(
    context.settings.cliCommand,
    ["base", "+table-list", "--base-token", baseToken, "--as", "user", "--format", "json"],
    { timeoutMs: 60000 }
  );
  const tableJson = tryParseJson(tableResult.stdout);
  const table = (tableJson?.data?.tables || []).find((item) => item.name === "真实 AI 摘要") || (tableJson?.data?.tables || [])[0];

  if (!tableResult.ok || !table?.id) {
    return {
      status: "failed",
      step: "table_list",
      error: tableResult.stderr || tableResult.stdout,
      base_token_present: true
    };
  }

  return {
    status: "success",
    base_token: baseToken,
    table_id: table.id,
    table_name: table.name,
    base_url: state.base_url
  };
}

function listExistingOriginalUrls(context, resolved) {
  const result = runCli(
    context.settings.cliCommand,
    [
      "base",
      "+record-list",
      "--base-token",
      resolved.base_token,
      "--table-id",
      resolved.table_id,
      "--field-id",
      "原始 URL",
      "--limit",
      "200",
      "--as",
      "user",
      "--format",
      "json"
    ],
    { timeoutMs: 60000 }
  );
  const json = tryParseJson(result.stdout);
  const rows = json?.data?.data || [];
  const recordIds = json?.data?.record_id_list || [];
  const urls = rows.map((row) => extractUrlFromCell(row[0])).filter(Boolean);

  return {
    status: result.ok ? "success" : "failed",
    urls,
    recordIds,
    has_more: Boolean(json?.data?.has_more),
    error: result.ok ? null : result.stderr || result.stdout
  };
}

function ensureDailyDocLinkField(context, resolved) {
  const fieldList = runCli(
    context.settings.cliCommand,
    ["base", "+field-list", "--base-token", resolved.base_token, "--table-id", resolved.table_id, "--as", "user", "--format", "json"],
    { timeoutMs: 60000 }
  );
  const fieldJson = tryParseJson(fieldList.stdout);
  const exists = (fieldJson?.data?.fields || []).some((field) => field.name === "日报文档链接");

  if (exists) {
    return {
      status: "exists",
      created: false
    };
  }

  const probe = runCli(
    context.settings.cliCommand,
    [
      "base",
      "+record-list",
      "--base-token",
      resolved.base_token,
      "--table-id",
      resolved.table_id,
      "--field-id",
      "日报文档链接",
      "--limit",
      "1",
      "--as",
      "user",
      "--format",
      "json"
    ],
    { timeoutMs: 60000 }
  );

  if (probe.ok) {
    return {
      status: "exists",
      created: false
    };
  }

  ensureDir(feishuOutputDir);
  writeJson(feishuCliBitableDailyDocLinkFieldPath, { type: "text", name: "日报文档链接", style: { type: "url" } });
  const fieldArg = `@${path.relative(process.cwd(), feishuCliBitableDailyDocLinkFieldPath).replace(/\\/g, "/")}`;
  const createField = runCli(
    context.settings.cliCommand,
    [
      "base",
      "+field-create",
      "--base-token",
      resolved.base_token,
      "--table-id",
      resolved.table_id,
      "--json",
      fieldArg,
      "--as",
      "user",
      "--format",
      "json"
    ],
    { timeoutMs: 60000 }
  );

  return {
    status: createField.ok ? "created" : "failed",
    created: createField.ok,
    error: createField.ok ? null : createField.stderr || createField.stdout
  };
}

function backfillDailyDocLink(context, resolved, recordIds) {
  if (!context.dailyDocUrl || recordIds.length === 0) {
    return {
      status: "skipped",
      updated_count: 0,
      reason: !context.dailyDocUrl ? "daily_doc_url_missing" : "no_record_ids"
    };
  }

  const patch = {
    record_id_list: recordIds,
    patch: {
      "日报文档链接": context.dailyDocUrl
    }
  };
  ensureDir(feishuOutputDir);
  writeJson(feishuCliBitablePatchPath, patch);
  const patchArg = `@${path.relative(process.cwd(), feishuCliBitablePatchPath).replace(/\\/g, "/")}`;
  const result = runCli(
    context.settings.cliCommand,
    [
      "base",
      "+record-batch-update",
      "--base-token",
      resolved.base_token,
      "--table-id",
      resolved.table_id,
      "--json",
      patchArg,
      "--as",
      "user",
      "--format",
      "json"
    ],
    { timeoutMs: 120000 }
  );

  return {
    status: result.ok ? "success" : "failed",
    updated_count: result.ok ? recordIds.length : 0,
    error: result.ok ? null : result.stderr || result.stdout
  };
}

function syncExistingBitableWithDedupe(context, check, jsonFiles) {
  const resolved = resolveExistingBitable(context);
  if (resolved.status !== "success") {
    return {
      status: "blocked",
      remote_write_performed: false,
      check,
      json_files: jsonFiles,
      dedupe_status: "unavailable",
      existing_resolve: resolved
    };
  }

  const existing = listExistingOriginalUrls(context, resolved);
  if (existing.status !== "success") {
    return {
      status: "blocked",
      remote_write_performed: false,
      check,
      json_files: jsonFiles,
      dedupe_status: "unavailable",
      existing_record_list: existing
    };
  }

  const existingSet = new Set(existing.urls);
  const newRecords = context.records.filter((record) => {
    const url = record.fields?.["原始 URL"] || record.fields?.["链接"] || "";
    return !existingSet.has(url);
  });
  const skippedCount = context.records.length - newRecords.length;
  const fieldResult = ensureDailyDocLinkField(context, resolved);
  const backfillResult = backfillDailyDocLink(context, resolved, existing.recordIds);

  if (newRecords.length === 0) {
    return {
      status: "success",
      remote_write_performed: fieldResult.created || backfillResult.status === "success",
      check,
      json_files: jsonFiles,
      bitable_name: context.settings.bitableName,
      table_name: resolved.table_name,
      base_token_present: true,
      table_id_present: true,
      base_url: resolved.base_url,
      fields_created: fieldResult.created ? 1 : 0,
      records_requested: context.records.length,
      records_written: 0,
      records_skipped: skippedCount,
      dedupe_status: "success",
      daily_doc_link_field: fieldResult,
      daily_doc_link_backfill: backfillResult
    };
  }

  const newPayload = buildBatchCreatePayload(newRecords, context.dailyDocUrl);
  ensureDir(feishuOutputDir);
  writeJson(feishuCliBitableRecordsPath, newPayload);
  const recordsArg = `@${path.relative(process.cwd(), feishuCliBitableRecordsPath).replace(/\\/g, "/")}`;
  const recordResult = runCli(
    context.settings.cliCommand,
    [
      "base",
      "+record-batch-create",
      "--as",
      "user",
      "--base-token",
      resolved.base_token,
      "--table-id",
      resolved.table_id,
      "--json",
      recordsArg,
      "--format",
      "json"
    ],
    { timeoutMs: 120000 }
  );
  const recordJson = tryParseJson(recordResult.stdout);
  const recordIds = recordJson?.data?.record_id_list || recordJson?.data?.records?.map((record) => record.record_id) || [];

  return {
    status: recordResult.ok ? "success" : "partial_failed",
    remote_write_performed: recordResult.ok || fieldResult.created || backfillResult.status === "success",
    check,
    json_files: jsonFiles,
    bitable_name: context.settings.bitableName,
    table_name: resolved.table_name,
    base_token_present: true,
    table_id_present: true,
    base_url: resolved.base_url,
    fields_created: fieldResult.created ? 1 : 0,
    records_requested: context.records.length,
    records_written: recordIds.length,
    records_skipped: skippedCount,
    dedupe_status: "success",
    daily_doc_link_field: fieldResult,
    daily_doc_link_backfill: backfillResult,
    record_result: {
      ok: recordResult.ok,
      status: recordResult.status,
      stderr: recordResult.stderr
    }
  };
}

function runBitableTestSync() {
  const context = buildBitableContext();
  const check = checkBitableCli(context);
  const jsonFiles = persistBitableJsonFiles(context);

  if (context.state?.status === "success") {
    return syncExistingBitableWithDedupe(context, check, jsonFiles);
  }

  if (!check.can_write_test_bitable) {
    return {
      status: "blocked",
      remote_write_performed: false,
      check,
      json_files: jsonFiles
    };
  }

  const fieldsArg = `@${path.relative(process.cwd(), jsonFiles.fields_path).replace(/\\/g, "/")}`;
  const createResult = runCli(
    context.settings.cliCommand,
    [
      "base",
      "+base-create",
      "--as",
      "user",
      "--name",
      context.settings.bitableName,
      "--table-name",
      "真实 AI 摘要",
      "--fields",
      fieldsArg,
      "--time-zone",
      "Asia/Shanghai",
      "--format",
      "json"
    ],
    { timeoutMs: 120000 }
  );
  const createJson = tryParseJson(createResult.stdout);
  const baseToken = extractBaseToken(createJson);
  const baseUrl = extractBaseUrl(createJson);
  const tableId = extractTableId(createJson) || "真实 AI 摘要";

  if (!createResult.ok || !baseToken) {
    return {
      status: "failed",
      step: "base_create",
      remote_write_performed: createResult.ok,
      check,
      json_files: jsonFiles,
      create_result: {
        ok: createResult.ok,
        status: createResult.status,
        stderr: createResult.stderr,
        base_token_present: Boolean(baseToken),
        table_id_present: Boolean(tableId)
      }
    };
  }

  const recordsArg = `@${path.relative(process.cwd(), jsonFiles.records_path).replace(/\\/g, "/")}`;
  const recordResult = runCli(
    context.settings.cliCommand,
    [
      "base",
      "+record-batch-create",
      "--as",
      "user",
      "--base-token",
      baseToken,
      "--table-id",
      tableId,
      "--json",
      recordsArg,
      "--format",
      "json"
    ],
    { timeoutMs: 120000 }
  );
  const recordJson = tryParseJson(recordResult.stdout);
  const recordIds = recordJson?.data?.record_id_list || recordJson?.data?.records?.map((record) => record.record_id) || [];
  const state = {
    status: recordResult.ok ? "success" : "partial_failed",
    bitable_name: context.settings.bitableName,
    table_name: "真实 AI 摘要",
    base_token_present: Boolean(baseToken),
    table_id_present: Boolean(tableId),
    base_url: baseUrl,
    record_count: recordIds.length,
    created_at: new Date().toISOString()
  };

  if (recordResult.ok) {
    writeJson(feishuCliBitableStatePath, state);
  }

  return {
    status: recordResult.ok ? "success" : "partial_failed",
    remote_write_performed: true,
    check,
    json_files: jsonFiles,
    bitable_name: context.settings.bitableName,
    table_name: "真实 AI 摘要",
    base_token_present: Boolean(baseToken),
    table_id_present: Boolean(tableId),
    base_url: baseUrl,
    fields_created: context.fieldDefinitions.length,
    records_requested: context.records.length,
    records_written: recordIds.length,
    create_result: {
      ok: createResult.ok,
      status: createResult.status
    },
    record_result: {
      ok: recordResult.ok,
      status: recordResult.status,
      stderr: recordResult.stderr
    }
  };
}

module.exports = {
  FIELD_NAMES,
  buildFieldDefinitions,
  buildBatchCreatePayload,
  buildBitableContext,
  checkBitableCli,
  persistBitableJsonFiles,
  runBitableTestSync
};
