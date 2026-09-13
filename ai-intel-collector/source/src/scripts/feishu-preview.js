const fs = require("fs");
const path = require("path");
const { readJson, writeJson, writeText, ensureDir } = require("../utils/fileStore");
const { log } = require("../utils/logger");
const { formatDate } = require("../reporting");
const { buildFeishuPayloadPreview } = require("../feishu/feishuPayloadBuilder");
const {
  dailyOutputDir,
  enhancedItemsPath,
  feishuOutputDir,
  feishuPayloadPreviewPath,
  feishuSyncPlanPath,
  feishuPreviewReportPath,
  userFocusPath
} = require("../utils/paths");

function readUtf8FileOrThrow(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required Markdown report not found: ${filePath}. Please run npm run report:enhanced first.`);
  }

  return fs.readFileSync(filePath, "utf8");
}

function buildSyncPlan({ date, payloadPath, previewReportPath }) {
  return [
    "# Feishu Sync Plan",
    "",
    "## 本轮状态",
    "- 已生成飞书同步前 payload preview。",
    "- 本轮没有调用飞书 API。",
    "- 本轮没有读取 FEISHU_APP_ID、FEISHU_APP_SECRET、tenant token 或 user token。",
    "- 本轮没有写入飞书知识库或多维表。",
    "",
    "## 下一轮真实同步需要确认",
    "- 目标类型：飞书文档、知识库文档、多维表，或两者都要。",
    "- 目标文档位置：知识库 space_id、parent_node_token 或目标文件夹。",
    "- 目标多维表：app_token、table_id，以及字段类型是否与 preview 字段一致。",
    "- 是否允许覆盖同日期日报，还是每次创建新文档。",
    "- 多维表记录去重规则：按 URL、item id，还是日报日期 + URL。",
    "",
    "## 建议环境变量",
    "- FEISHU_APP_ID=",
    "- FEISHU_APP_SECRET=",
    "- FEISHU_DOC_TARGET_TYPE=doc",
    "- FEISHU_BITABLE_APP_TOKEN=",
    "- FEISHU_BITABLE_TABLE_ID=",
    "- FEISHU_SYNC_ENABLED=false",
    "",
    "## 风险点",
    "- 飞书文档 Markdown 能力和本地 Markdown 不完全一致，表格、链接、checkbox 需要真实预览。",
    "- 多维表字段类型需要提前建好，否则写入时可能失败。",
    "- 长文本字段可能超过单元格舒适阅读范围，建议保留完整内容但在表格视图中隐藏长字段。",
    "- 含具体产品名、数字、功能名的 AI 摘要仍需要人工事实核验。",
    "",
    "## 回滚策略",
    "- 文档同步：真实接入后先创建测试文档，不覆盖正式日报。",
    "- 多维表同步：先写入测试表；正式表写入前按 URL 做去重。",
    "- 若写入异常，保留本地 `output/feishu/feishu_payload_preview.json` 作为重放输入。",
    "",
    "## 安全提醒",
    "- 不要提交 `.env`。",
    "- 不要把 FEISHU_APP_SECRET 或任何 token 写入报告、日志或 payload preview。",
    "- 下一轮接入 API 时，日志只允许输出 token 是否存在的布尔值。",
    "",
    "## 本轮输出",
    `- Date: ${date}`,
    `- Payload preview: ${payloadPath}`,
    `- Preview report: ${previewReportPath}`,
    ""
  ].join("\n");
}

function buildPreviewReport({ startedAt, finishedAt, date, dailyPath, preview }) {
  const stats = preview.stats;

  return [
    "# Feishu Preview Report",
    "",
    "## 本轮完成内容",
    "- 读取 enhanced daily Markdown，生成飞书文档 payload preview。",
    "- 读取 enhanced_items.json，只将真实 AI 摘要映射为多维表 records preview。",
    "- 生成下一轮真实飞书同步计划。",
    "- 未调用飞书 API，未读取飞书 token，未写入任何远端目标。",
    "",
    "## 运行信息",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- Date: ${date}`,
    `- Source daily report: ${dailyPath}`,
    "",
    "## 预览统计",
    `- Enhanced items total: ${stats.enhanced_items_total}`,
    `- Real AI summaries: ${stats.ai_summary_success_count}`,
    `- Bitable records: ${stats.bitable_record_count}`,
    `- Document sections: ${stats.document_section_count}`,
    `- Document warnings: ${stats.document_warning_count}`,
    `- Records with warnings: ${stats.record_warning_count}`,
    "",
    "## 验收检查",
    `- document_payload exists: ${Boolean(preview.document_payload)}`,
    `- document title: ${preview.document_payload.title}`,
    `- target_type: ${preview.document_payload.target_type}`,
    `- records equal real AI summaries: ${stats.bitable_record_count === stats.ai_summary_success_count}`,
    "- Feishu API called: false",
    "- Feishu token read: false",
    "- Remote write performed: false",
    "",
    "## Warnings",
    preview.warnings.length ? preview.warnings.map((warning) => `- ${warning}`).join("\n") : "- 暂无 preview warning。",
    "",
    "## 下一步建议",
    "- 人工确认飞书文档目标位置和多维表字段类型。",
    "- 用测试知识库/测试多维表做第一轮真实写入。",
    "- 接入真实同步前，继续保留 `FEISHU_SYNC_ENABLED=false` 作为安全开关。",
    ""
  ].join("\n");
}

function main() {
  const startedAt = new Date().toISOString();
  const userFocus = readJson(userFocusPath, {});
  const date = formatDate(new Date(), userFocus.timezone || "UTC");
  const dailyPath = path.join(dailyOutputDir, `enhanced-ai-intel-daily-${date}.md`);
  const markdown = readUtf8FileOrThrow(dailyPath);
  const enhancedItems = readJson(enhancedItemsPath, []);
  const preview = buildFeishuPayloadPreview({
    date,
    markdown,
    sourceFile: dailyPath,
    enhancedItems
  });
  const finishedAt = new Date().toISOString();

  ensureDir(feishuOutputDir);
  writeJson(feishuPayloadPreviewPath, preview);
  writeText(
    feishuSyncPlanPath,
    buildSyncPlan({
      date,
      payloadPath: feishuPayloadPreviewPath,
      previewReportPath: feishuPreviewReportPath
    })
  );
  writeText(
    feishuPreviewReportPath,
    buildPreviewReport({
      startedAt,
      finishedAt,
      date,
      dailyPath,
      preview
    })
  );

  log(`Feishu payload preview: ${feishuPayloadPreviewPath}`);
  log(`Feishu sync plan: ${feishuSyncPlanPath}`);
  log(`Feishu preview report: ${feishuPreviewReportPath}`);
  log(`Bitable records preview: ${preview.stats.bitable_record_count}`);
}

main();
