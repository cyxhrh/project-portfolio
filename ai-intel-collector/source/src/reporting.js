function formatDate(date = new Date(), timezone = "UTC") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(date);
}

function toBullet(item) {
  const published = item.published_at ? ` | published: ${item.published_at}` : "";
  return `- [${item.title}](${item.url}) - ${item.source_name} / ${item.category} / ${item.importance}${published}`;
}

function buildDailyMarkdown({ date, sources, reports, newItems }) {
  const successfulReports = reports.filter((report) => report.status === "success");
  const failedReports = reports.filter((report) => report.status !== "success");
  const highPriorityItems = newItems.filter((item) => item.source_priority === "high");

  const lines = [
    `# AI Intel Daily - ${date}`,
    "",
    "## 今日概览",
    `- 收集来源数量：${sources.length}`,
    `- 成功来源数量：${successfulReports.length}`,
    `- 失败来源数量：${failedReports.length}`,
    `- 新增情报数量：${newItems.length}`,
    "",
    "## 高优先级来源动态",
    highPriorityItems.length ? highPriorityItems.map(toBullet).join("\n") : "- 暂无新增高优先级动态。",
    "",
    "## 全部收集结果",
    newItems.length ? newItems.map(toBullet).join("\n") : "- 暂无新增情报。",
    "",
    "## 失败/待适配来源",
    failedReports.length
      ? failedReports.map((report) => `- ${report.source_name}：${report.status}${report.error ? ` - ${report.error}` : ""}`).join("\n")
      : "- 暂无失败或待适配来源。",
    "",
    "## 下一步建议",
    "- 为 `pending_confirm` 来源确认官方 URL。",
    "- 为高价值网页源编写专门 adapter，提高标题、日期和摘要质量。",
    "- 增加更细的规则分类和重要度评分。",
    ""
  ];

  return lines.join("\n");
}

function buildExecutionReport({ startedAt, finishedAt, dailyPath, rawItemsPath, reports, newItems, seenCount }) {
  const successCount = reports.filter((report) => report.status === "success").length;
  const failedReports = reports.filter((report) => report.status !== "success");

  return [
    "# Execution Report",
    "",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- Sources checked: ${reports.length}`,
    `- Successful sources: ${successCount}`,
    `- Failed or pending sources: ${failedReports.length}`,
    `- New items: ${newItems.length}`,
    `- Seen URL records: ${seenCount}`,
    `- Raw items: ${rawItemsPath}`,
    `- Daily markdown: ${dailyPath}`,
    "",
    "## Source Results",
    ...reports.map((report) => {
      const detail = report.error ? ` - ${report.error}` : "";
      return `- ${report.source_name} (${report.source_type}): ${report.status}, items=${report.item_count}${detail}`;
    }),
    "",
    "## Notes",
    "- This is round 0: collectors are intentionally generic and conservative.",
    "- Pending sources are recorded instead of blocking the whole run.",
    "- Classification is keyword-based placeholder logic, not AI classification.",
    ""
  ].join("\n");
}

function buildAdapterReport({ startedAt, finishedAt, reports, newItems }) {
  const successfulReports = reports.filter((report) => report.status === "success");
  const failedReports = reports.filter((report) => report.status !== "success");
  const pendingReports = reports.filter((report) => report.status === "pending_confirm" || report.status === "pending_adapter");
  const itemsWithDates = newItems.filter((item) => item.published_at).length;
  const titlesThatLookUseful = newItems.filter((item) => item.title && item.title.length >= 12 && !/^skip to/i.test(item.title)).length;

  return [
    "# Adapter Report",
    "",
    "## 本轮完成了什么",
    "- 将部分来源从通用 webpage 改为 RSS 或 GitHub releases。",
    "- 增加 source-specific adapter registry。",
    "- 增强 RSS 字段解析：title、link、published_at、summary、categories。",
    "- 增强 GitHub releases 字段：release title、tag、published_at、url、body snippet、repo metadata。",
    "- 增强网页采集：403 降级、article/main 链接提取、meta/time/summary 基础提取。",
    "",
    "## 哪些来源成功",
    successfulReports.length
      ? successfulReports.map((report) => `- ${report.source_name} (${report.source_type})：items=${report.item_count}`).join("\n")
      : "- 暂无成功来源。",
    "",
    "## 哪些来源失败",
    failedReports.length
      ? failedReports.map((report) => `- ${report.source_name}：${report.status}${report.error ? ` - ${report.error}` : ""}`).join("\n")
      : "- 暂无失败来源。",
    "",
    "## 哪些来源仍需人工确认",
    pendingReports.length
      ? pendingReports.map((report) => `- ${report.source_name}：${report.status}${report.error ? ` - ${report.error}` : ""}`).join("\n")
      : "- 暂无需要人工确认的来源。",
    "",
    "## raw_items.json 数据质量检查",
    `- 新增条目：${newItems.length}`,
    `- 含 published_at：${itemsWithDates}`,
    `- 标题看起来可用：${titlesThatLookUseful}`,
    "- 当前仍可能存在网页列表页标题过长或夹带分类/日期的问题，需在下一轮继续做专用清洗。",
    "",
    "## 下一轮建议",
    "- 为 OpenAI API Changelog、ChatGPT Release Notes、Claude Release Notes 确认可稳定抓取的一手入口。",
    "- 给 Anthropic、Google、Qwen 写更精细的结构化页面 adapter。",
    "- 给 RSS 来源加入按发布时间过滤和历史窗口控制。",
    "- 增加离线 fixture 测试，避免每次验证完全依赖网络。",
    "",
    `Started at: ${startedAt}`,
    `Finished at: ${finishedAt}`,
    ""
  ].join("\n");
}

function truncateText(value, maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function statusLabel(item) {
  return item.summary_status === "ai_summary_success" ? "真实 AI 摘要" : "规则摘要";
}

function itemLine(item) {
  const score = item.importance_score ?? "-";
  const deepDive = item.should_deep_dive ? "建议深挖" : "观察";
  return `[${item.title}](${item.url})｜${item.source_name}｜${item.category}｜${score}｜${deepDive}｜${statusLabel(item)}`;
}

function compactCard(item) {
  return [
    `### ${item.title}`,
    `- 链接：${item.url}`,
    `- 来源：${item.source_name}｜分类：${item.category}｜评分：${item.importance_score ?? "-"}｜${statusLabel(item)}`,
    `- 一句话：${truncateText(item.one_sentence_summary, 220)}`,
    item.why_it_matters ? `- 为什么重要：${truncateText(item.why_it_matters, 220)}` : null,
    item.project_inspiration ? `- 项目灵感：${truncateText(item.project_inspiration, 220)}` : null,
    Array.isArray(item.suggested_actions) && item.suggested_actions.length > 0
      ? `- 建议动作：${item.suggested_actions.slice(0, 2).map((action) => truncateText(action, 90)).join("；")}`
      : null,
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

function archiveLine(item) {
  return `- ${itemLine(item)}\n  - ${truncateText(item.one_sentence_summary, 120)}`;
}

function mdCell(value, maxLength = 80) {
  return truncateText(value, maxLength).replace(/\|/g, "/").replace(/\n/g, " ");
}

function linkedTitle(item, maxLength = 42) {
  return `[${mdCell(item.title, maxLength)}](${item.url})`;
}

function tableRows(items, rowBuilder) {
  return items.length ? items.map(rowBuilder).join("\n") : "| - | - | - | - | - |";
}

function buildOneSentenceJudgment({ aiSummaryItems, deepDiveItems, contentSuccessItems, enhancedItems }) {
  if (aiSummaryItems.length > 0) {
    const themes = Array.from(new Set(aiSummaryItems.map((item) => item.category))).slice(0, 3).join("、");
    return `今日重点信号集中在${themes || "高价值官方动态"}，已有 ${aiSummaryItems.length} 条真实 AI 摘要可直接进入人工复核。`;
  }

  if (deepDiveItems.length > 0) {
    return `今日有 ${deepDiveItems.length} 条值得深挖的情报，但尚未生成真实 AI 摘要，建议先复核 Top N。`;
  }

  return `今日共归档 ${enhancedItems.length} 条情报，其中 ${contentSuccessItems.length} 条抓到正文，可作为后续趋势观察样本。`;
}

function buildEnhancedDailyMarkdown({ date, enhancedItems }) {
  const deepDiveItems = enhancedItems.filter((item) => item.should_deep_dive);
  const highScoreItems = enhancedItems.filter((item) => item.importance_score >= 70);
  const failedItems = enhancedItems.filter((item) => item.summary_status === "failed");
  const aiSummaryItems = enhancedItems.filter((item) => item.summary_status === "ai_summary_success");
  const ruleSummaryItems = enhancedItems.filter((item) => item.summary_status !== "ai_summary_success");
  const contentSuccessItems = enhancedItems.filter((item) => item.content_fetch_status === "success");
  const contentFailedItems = enhancedItems.filter((item) => item.content_fetch_status && item.content_fetch_status !== "success");
  const inspirationItems = enhancedItems
    .filter((item) => item.summary_status === "ai_summary_success" && item.project_inspiration)
    .slice(0, 8);
  const actionItems = aiSummaryItems
    .filter((item) => Array.isArray(item.suggested_actions) && item.suggested_actions.length > 0 && (item.summary_status === "ai_summary_success" || item.importance_score >= 80))
    .slice(0, 10);
  const deepDiveDisplayItems = [...aiSummaryItems, ...deepDiveItems.filter((item) => item.summary_status !== "ai_summary_success")]
    .slice(0, 10);
  const reviewItems = ruleSummaryItems
    .filter((item) => item.importance_score >= 70 || item.should_deep_dive)
    .sort((a, b) => (b.importance_score || 0) - (a.importance_score || 0))
    .slice(0, 15);
  const archiveItems = enhancedItems
    .filter((item) => !item.should_deep_dive && item.summary_status !== "ai_summary_success" && (item.importance_score || 0) < 70)
    .sort((a, b) => (b.importance_score || 0) - (a.importance_score || 0))
    .slice(0, 15);
  const sourceCounts = enhancedItems.reduce((counts, item) => {
    counts[item.source_name] = (counts[item.source_name] || 0) + 1;
    return counts;
  }, {});
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const oneSentence = buildOneSentenceJudgment({
    aiSummaryItems,
    deepDiveItems,
    contentSuccessItems,
    enhancedItems
  });
  const coreInsightItems = aiSummaryItems.length >= 2 ? aiSummaryItems.slice(0, 3) : [...aiSummaryItems, ...highScoreItems.filter((item) => item.summary_status !== "ai_summary_success")].slice(0, 3);
  const followUpItems = [
    ...actionItems.map((item) => `${item.title}：${truncateText((item.suggested_actions || [])[0], 90)}`),
    ...reviewItems.slice(0, 5).map((item) => `${item.title}：复核规则摘要与原文内容。`)
  ].slice(0, 5);
  const highImportanceCount = enhancedItems.filter((item) => (item.importance_score || 0) >= 80).length;
  const mediumImportanceCount = enhancedItems.filter((item) => (item.importance_score || 0) >= 60 && (item.importance_score || 0) < 80).length;
  const lowImportanceCount = enhancedItems.filter((item) => (item.importance_score || 0) < 60).length;

  return [
    `# AI 情报日报 - ${date}`,
    "",
    "## 今日概览",
    `- 情报总数：${enhancedItems.length}`,
    `- 真实 AI 摘要数量：${aiSummaryItems.length}`,
    `- 规则摘要数量：${ruleSummaryItems.length}`,
    `- 建议深挖数量：${deepDiveItems.length}`,
    `- 正文抓取成功数量：${contentSuccessItems.length}`,
    `- 摘要失败数量：${failedItems.length}`,
    "",
    "## 今日一句话判断",
    aiSummaryItems.length ? oneSentence : "今日暂无真实 AI 摘要，建议先完成摘要配置后再判断趋势。",
    "",
    "## 今日核心洞察",
    coreInsightItems.length
      ? coreInsightItems
          .map((item) => {
            const label = item.summary_status === "ai_summary_success" ? "真实 AI 摘要" : "待复核";
            return `- ${linkedTitle(item, 70)}（${label}）：${truncateText(item.why_it_matters || item.one_sentence_summary, 180)}`;
          })
          .join("\n")
      : "- 暂无可提取核心洞察。",
    "",
    "## 深度分析情报（真实 AI 摘要）",
    aiSummaryItems.length ? aiSummaryItems.slice(0, 8).map(compactCard).join("\n") : "- 暂无真实 AI 摘要；当前为规则摘要或未启用 API。",
    "",
    "## 项目启发",
    inspirationItems.length
      ? inspirationItems.map((item) => `- ${item.title}：${truncateText(item.project_inspiration, 150)}`).join("\n")
      : "- 暂无明确项目灵感。",
    "",
    "## 行动清单",
    actionItems.length
      ? actionItems
          .flatMap((item) => item.suggested_actions.slice(0, 2).map((action) => `- [ ] ${item.title}：${truncateText(action, 120)}`))
          .slice(0, 10)
          .join("\n")
      : "- 暂无明确行动项。",
    "",
    "## 建议深挖",
    deepDiveDisplayItems.length
      ? deepDiveDisplayItems
          .map((item) => `- ${itemLine(item)}\n  - 深挖原因：${truncateText(item.deep_dive_reason || item.importance_reason || item.why_it_matters, 150)}`)
          .join("\n")
      : "- 暂无建议深挖条目。",
    "",
    "## 规则摘要 / 待复核",
    "| 标题 | 来源 | 分类 | 重要度 | 待复核原因 |",
    "|---|---|---|---:|---|",
    tableRows(reviewItems, (item) => `| ${linkedTitle(item)} | ${mdCell(item.source_name, 24)} | ${mdCell(item.category, 16)} | ${item.importance_score ?? "-"} | ${mdCell(item.content_fetch_status && item.content_fetch_status !== "success" ? item.content_fetch_status : "规则摘要，建议人工复核", 36)} |`),
    "",
    "## 低优先级归档",
    "| 标题 | 来源 | 分类 | 重要度 | 备注 |",
    "|---|---|---|---:|---|",
    tableRows(archiveItems, (item) => `| ${linkedTitle(item)} | ${mdCell(item.source_name, 24)} | ${mdCell(item.category, 16)} | ${item.importance_score ?? "-"} | ${mdCell(item.one_sentence_summary, 42)} |`),
    "",
    "## 今日采集统计",
    "| 指标 | 数量 |",
    "|---|---:|",
    `| 情报总数 | ${enhancedItems.length} |`,
    `| 真实 AI 摘要 | ${aiSummaryItems.length} |`,
    `| 规则摘要 | ${ruleSummaryItems.length} |`,
    `| 正文抓取成功 | ${contentSuccessItems.length} |`,
    `| 正文抓取失败 | ${contentFailedItems.length} |`,
    `| 高重要度 | ${highImportanceCount} |`,
    `| 中重要度 | ${mediumImportanceCount} |`,
    `| 低重要度 | ${lowImportanceCount} |`,
    "",
    "| 来源 | 数量 |",
    "|---|---:|",
    ...(topSources.length ? topSources.map(([source, count]) => `| ${mdCell(source, 40)} | ${count} |`) : ["| 暂无 | 0 |"]),
    "",
    "## 明日跟进",
    followUpItems.length ? followUpItems.map((item) => `- ${truncateText(item, 140)}`).join("\n") : "- 暂无明确跟进事项。",
    "",
    "## 备注",
    "- 模板版本：Work Buddy AI 情报日报模板 v1",
    "- 生成工具：AI Intel Collector",
    `- 摘要模型：${aiSummaryItems[0]?.model_used || "未启用或无真实摘要"}`,
    "- 下次优化方向：继续校准核心洞察排序、飞书表格宽度和待复核工作流。",
    failedItems.length ? `- 摘要失败：${failedItems.length} 条，详见 enhanced_items.json。` : "- 摘要失败：0 条。",
    ""
  ].join("\n");
}

function buildSummaryReport({ startedAt, finishedAt, settings, rawCount, enhancedItems, enhancedItemsPath, enhancedDailyPath }) {
  const statusCounts = enhancedItems.reduce((counts, item) => {
    counts[item.summary_status] = (counts[item.summary_status] || 0) + 1;
    return counts;
  }, {});
  const failedItems = enhancedItems.filter((item) => item.summary_status === "failed");
  const deepDiveItems = enhancedItems.filter((item) => item.should_deep_dive);

  return [
    "# Summary Report",
    "",
    "## 本轮完成了什么",
    "- 读取 raw_items.json 并生成行动型 AI 情报卡片。",
    "- 增加 DeepSeek/OpenAI-compatible 模型接口配置。",
    "- 在无 API Key 或 AI_SUMMARY_ENABLED=false 时自动跳过模型调用。",
    "- 增加规则评分、深挖判断、项目灵感和建议动作。",
    "",
    "## 运行概览",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- Raw items: ${rawCount}`,
    `- Enhanced items: ${enhancedItems.length}`,
    `- Suggested deep dives: ${deepDiveItems.length}`,
    `- Model provider: ${settings.provider}`,
    `- Model used: ${settings.model}`,
    `- AI summary enabled: ${settings.summaryEnabled}`,
    `- API key present: ${Boolean(settings.apiKey)}`,
    "",
    "## 摘要状态统计",
    ...Object.entries(statusCounts).map(([status, count]) => `- ${status}: ${count}`),
    "",
    "## 摘要失败记录",
    failedItems.length ? failedItems.map((item) => `- ${item.title}：${item.summary_error}`).join("\n") : "- 暂无摘要失败。",
    "",
    "## 输出文件",
    `- Enhanced items: ${enhancedItemsPath}`,
    `- Enhanced daily report: ${enhancedDailyPath}`,
    "",
    "## 下一轮建议",
    "- 增加正文抓取后再做高价值情报深度摘要。",
    "- 加入离线 fixture 测试，固定摘要状态和评分规则。",
    "- 对 GitHub release 与 arXiv 论文加入更细的过滤策略。",
    ""
  ].join("\n");
}

module.exports = {
  formatDate,
  buildDailyMarkdown,
  buildExecutionReport,
  buildAdapterReport,
  buildEnhancedDailyMarkdown,
  buildSummaryReport
};
