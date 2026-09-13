require("dotenv").config({ quiet: true });

const { writeText } = require("../utils/fileStore");
const { log } = require("../utils/logger");
const { feishuCliBitableTestReportPath } = require("../utils/paths");
const { runBitableTestSync } = require("../feishu/feishuCliBitableSync");

function buildTestReport({ startedAt, finishedAt, result }) {
  const check = result.check || {};

  return [
    "# Feishu CLI Bitable Test Report",
    "",
    "## 安全边界",
    "- 仅 CLI 模式。",
    "- 只创建或复用 `[TEST] AI 一手情报库` 测试多维表。",
    "- 只写入 10 条真实 AI 摘要 records。",
    "- 不同步全部 69 条，不写正式多维表，不覆盖正式数据。",
    "- 不打印 token/secret。",
    "",
    "## 运行信息",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- Remote write performed: ${result.remote_write_performed}`,
    `- Status: ${result.status}`,
    "",
    "## CLI Base 检查",
    `- lark-cli base available: ${check.base_available}`,
    `- base +base-create supported: ${check.base_create_supported}`,
    `- base +record-batch-create supported: ${check.record_batch_create_supported}`,
    `- Planned records: ${check.planned_record_count}`,
    "",
    "## 测试多维表结果",
    `- Bitable name: ${result.bitable_name || check.bitable_name}`,
    `- Table name: ${result.table_name || "真实 AI 摘要"}`,
    `- Base token present: ${Boolean(result.base_token_present)}`,
    `- Table id present: ${Boolean(result.table_id_present)}`,
    result.base_url ? `- Bitable URL: ${result.base_url}` : "- Bitable URL: not available",
    "",
    "## 字段结果",
    `- Fields planned: ${check.field_count}`,
    `- Fields created: ${result.fields_created || 0}`,
    "",
    "## Records 写入结果",
    `- Records requested: ${result.records_requested || 0}`,
    `- Records written: ${result.records_written || 0}`,
    `- Records skipped: ${result.records_skipped || 0}`,
    `- Dedupe status: ${result.dedupe_status || "not_applied"}`,
    "- Dedupe strategy: existing test table records are matched by 原始 URL; matched records are skipped.",
    "",
    "## 日报文档链接回填",
    `- Field status: ${result.daily_doc_link_field?.status || "not_attempted"}`,
    `- Field created: ${Boolean(result.daily_doc_link_field?.created)}`,
    `- Backfill status: ${result.daily_doc_link_backfill?.status || "not_attempted"}`,
    `- Backfilled records: ${result.daily_doc_link_backfill?.updated_count || 0}`,
    "",
    "## 阻塞或失败记录",
    result.status === "success"
      ? [
          result.daily_doc_link_field?.status === "failed" ? `- Daily doc link field: ${result.daily_doc_link_field.error}` : null,
          result.daily_doc_link_backfill?.status === "failed" ? `- Daily doc link backfill: ${result.daily_doc_link_backfill.error}` : null
        ].filter(Boolean).join("\n") || "- 暂无失败记录。"
      : [
          ...(check.blockers || []).map((item) => `- Blocker: ${item}`),
          result.create_result?.stderr ? `- Base create stderr: ${result.create_result.stderr}` : null,
          result.record_result?.stderr ? `- Record write stderr: ${result.record_result.stderr}` : null
        ].filter(Boolean).join("\n") || "- 未提供失败详情。",
    "",
    "## 输出文件",
    `- Fields JSON: ${result.json_files?.fields_path || ""}`,
    `- Records JSON: ${result.json_files?.records_path || ""}`,
    "",
    "## 下一步建议",
    "- 打开测试多维表，人工确认字段类型、10 条记录内容和日报文档链接。",
    "- 正式同步前继续保留测试开关，并把目标表 URL 显式配置到环境变量或配置文件。",
    ""
  ].join("\n");
}

function main() {
  const startedAt = new Date().toISOString();
  const result = runBitableTestSync();
  const finishedAt = new Date().toISOString();

  writeText(feishuCliBitableTestReportPath, buildTestReport({ startedAt, finishedAt, result }));
  log(`Feishu CLI bitable test report: ${feishuCliBitableTestReportPath}`);
  log(`Bitable test status: ${result.status}; records written: ${result.records_written || 0}`);
}

main();
