function safeText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim() || fallback;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function joinActions(actions) {
  if (!Array.isArray(actions)) {
    return "";
  }

  return actions.filter(Boolean).map((action) => `- ${safeText(action)}`).join("\n");
}

function extractMarkdownSections(markdown) {
  return markdown
    .split("\n")
    .map((line, index) => {
      const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
      if (!match) {
        return null;
      }

      return {
        level: match[1].length,
        title: match[2],
        line: index + 1
      };
    })
    .filter(Boolean);
}

function buildDocumentWarnings(markdown, sections) {
  const warnings = [];

  if (!markdown.trim()) {
    warnings.push("markdown_content_empty");
  }

  if (sections.length < 5) {
    warnings.push("section_count_low");
  }

  if (markdown.length > 50000) {
    warnings.push("markdown_content_may_be_too_long_for_single_feishu_doc_block");
  }

  return warnings;
}

function buildDocumentPayload({ date, markdown, sourceFile }) {
  const sections = extractMarkdownSections(markdown);
  const title = `AI 情报日报 - ${date}`;

  return {
    target_type: "feishu_doc",
    title,
    date,
    source_file: sourceFile,
    markdown_content: markdown,
    sections,
    warnings: buildDocumentWarnings(markdown, sections)
  };
}

function buildRecordWarnings(fields) {
  const warnings = [];

  if (!fields["标题"]) {
    warnings.push("missing_title");
  }

  if (!fields["链接"]) {
    warnings.push("missing_url");
  }

  if (!fields["一句话摘要"]) {
    warnings.push("missing_one_sentence_summary");
  }

  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.length > 1000) {
      warnings.push(`${name}_may_be_too_long`);
    }
  }

  return warnings;
}

function mapItemToBitableRecord(item) {
  const fields = {
    "标题": safeText(item.title, "未命名情报"),
    "来源": safeText(item.source_name, "未知来源"),
    "链接": safeText(item.url),
    "分类": safeText(item.category, "其他"),
    "重要度": safeNumber(item.importance_score),
    "摘要类型": item.summary_status === "ai_summary_success" ? "真实 AI 摘要" : "规则摘要",
    "一句话摘要": safeText(item.one_sentence_summary),
    "为什么重要": safeText(item.why_it_matters),
    "项目启发": safeText(item.project_inspiration),
    "建议行动": joinActions(item.suggested_actions),
    "是否建议深挖": Boolean(item.should_deep_dive),
    "置信度": safeText(item.confidence, "未知"),
    "采集日期": safeText(item.collected_at),
    "内容抓取状态": safeText(item.content_fetch_status, "unknown"),
    "人工核验状态": "待核验"
  };

  return {
    source_item_id: safeText(item.id),
    fields,
    warnings: buildRecordWarnings(fields)
  };
}

function buildBitableRecords(enhancedItems) {
  return enhancedItems
    .filter((item) => item.summary_status === "ai_summary_success")
    .map(mapItemToBitableRecord);
}

function buildPreviewStats({ enhancedItems, bitableRecords, documentPayload }) {
  const recordsWithWarnings = bitableRecords.filter((record) => record.warnings.length > 0).length;

  return {
    enhanced_items_total: enhancedItems.length,
    ai_summary_success_count: bitableRecords.length,
    bitable_record_count: bitableRecords.length,
    document_section_count: documentPayload.sections.length,
    document_warning_count: documentPayload.warnings.length,
    record_warning_count: recordsWithWarnings,
    generated_without_feishu_api: true
  };
}

function buildFeishuPayloadPreview({ date, markdown, sourceFile, enhancedItems }) {
  const documentPayload = buildDocumentPayload({ date, markdown, sourceFile });
  const bitableRecords = buildBitableRecords(enhancedItems);
  const warnings = [
    ...documentPayload.warnings.map((warning) => `document:${warning}`),
    ...bitableRecords.flatMap((record) => record.warnings.map((warning) => `record:${record.source_item_id || "unknown"}:${warning}`))
  ];

  return {
    document_payload: documentPayload,
    bitable_records: bitableRecords,
    stats: buildPreviewStats({ enhancedItems, bitableRecords, documentPayload }),
    warnings
  };
}

module.exports = {
  buildFeishuPayloadPreview,
  buildDocumentPayload,
  buildBitableRecords,
  mapItemToBitableRecord,
  extractMarkdownSections
};
