require("dotenv").config({ quiet: true });

const { writeText } = require("../utils/fileStore");
const { log } = require("../utils/logger");
const { feishuCliBitableCheckReportPath } = require("../utils/paths");
const {
  buildBitableContext,
  checkBitableCli,
  persistBitableJsonFiles
} = require("../feishu/feishuCliBitableSync");

function buildCheckReport({ startedAt, finishedAt, check, jsonFiles }) {
  return [
    "# Feishu CLI Bitable Check Report",
    "",
    "## 检查范围",
    "- 检查 lark-cli base 能力。",
    "- 读取 feishu_payload_preview.json 中的 10 条真实 AI 摘要 records。",
    "- 生成字段 JSON 和 records JSON 预览。",
    "- 不创建 Base，不写入远端，不打印 token/secret。",
    "",
    "## CLI Base 能力",
    `- CLI command: ${check.cli_command}`,
    `- FEISHU_SYNC_MODE: ${check.sync_mode}`,
    `- FEISHU_SYNC_ENABLED: ${check.sync_enabled}`,
    `- FEISHU_TARGET_ENV: ${check.target_env}`,
    `- lark-cli base available: ${check.base_available}`,
    `- base +base-create supported: ${check.base_create_supported}`,
    `- base +record-batch-create supported: ${check.record_batch_create_supported}`,
    "",
    "## 测试多维表计划",
    `- Bitable name: ${check.bitable_name}`,
    `- Planned records: ${check.planned_record_count}`,
    `- Field count: ${check.field_count}`,
    `- Existing local state found: ${check.existing_state_found}`,
    `- Can write test bitable now: ${check.can_write_test_bitable}`,
    "",
    "## 预览文件",
    `- Fields JSON: ${jsonFiles.fields_path}`,
    `- Records JSON: ${jsonFiles.records_path}`,
    "",
    "## 阻塞项",
    check.blockers.length ? check.blockers.map((item) => `- ${item}`).join("\n") : "- 暂无阻塞项。",
    "",
    "## 下一步",
    "- 若无阻塞项，运行 `npm run feishu:cli-bitable-test`。",
    "- 如果本地 state 已存在，为避免重复写入，先人工确认是否需要清理测试表或 state。",
    "",
    `Started at: ${startedAt}`,
    `Finished at: ${finishedAt}`,
    ""
  ].join("\n");
}

function main() {
  const startedAt = new Date().toISOString();
  const context = buildBitableContext();
  const check = checkBitableCli(context);
  const jsonFiles = persistBitableJsonFiles(context);
  const finishedAt = new Date().toISOString();

  writeText(feishuCliBitableCheckReportPath, buildCheckReport({ startedAt, finishedAt, check, jsonFiles }));
  log(`Feishu CLI bitable check report: ${feishuCliBitableCheckReportPath}`);
  log(`Can write test bitable: ${check.can_write_test_bitable}; planned records: ${check.planned_record_count}`);
}

main();
