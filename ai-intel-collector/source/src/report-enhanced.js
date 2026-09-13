const path = require("path");
const { readJson, writeText, ensureDir } = require("./utils/fileStore");
const { log } = require("./utils/logger");
const {
  enhancedItemsPath,
  dailyOutputDir,
  userFocusPath,
  summaryReportPath,
  feishuRenderCheckReportPath
} = require("./utils/paths");
const { loadModelSettings } = require("./llm/openaiCompatibleClient");
const { formatDate, buildEnhancedDailyMarkdown, buildSummaryReport } = require("./reporting");

function countSectionLines(markdown, heading, nextHeading) {
  const start = markdown.indexOf(heading);
  if (start === -1) {
    return [];
  }

  const rest = markdown.slice(start + heading.length);
  const end = nextHeading ? rest.indexOf(nextHeading) : -1;
  return (end === -1 ? rest : rest.slice(0, end)).split("\n");
}

function countTableDataRows(markdown, heading, nextHeading) {
  return countSectionLines(markdown, heading, nextHeading).filter((line) => line.trim().startsWith("| [")).length;
}

function countBulletLines(markdown, heading, nextHeading) {
  return countSectionLines(markdown, heading, nextHeading).filter((line) => /^- /.test(line.trim())).length;
}

function buildFeishuRenderCheckReport({ startedAt, finishedAt, enhancedDailyPath, markdown, enhancedItems }) {
  const expectedHeadings = [
    "## 今日概览",
    "## 今日一句话判断",
    "## 今日核心洞察",
    "## 深度分析情报",
    "## 项目启发",
    "## 行动清单",
    "## 建议深挖",
    "## 规则摘要 / 待复核",
    "## 低优先级归档",
    "## 今日采集统计",
    "## 明日跟进",
    "## 备注"
  ];
  const missingHeadings = expectedHeadings.filter((heading) => !markdown.includes(heading));
  const aiSummaryCount = enhancedItems.filter((item) => item.summary_status === "ai_summary_success").length;
  const reviewRows = countTableDataRows(markdown, "## 规则摘要 / 待复核", "## 低优先级归档");
  const archiveRows = countTableDataRows(markdown, "## 低优先级归档", "## 今日采集统计");
  const actionCount = countSectionLines(markdown, "## 行动清单", "## 建议深挖").filter((line) => line.trim().startsWith("- [ ]")).length;
  const tomorrowCount = countBulletLines(markdown, "## 明日跟进", "## 备注");
  const visibleMarkdown = markdown.replace(/\]\(https?:\/\/[^)]+\)/g, "]");
  const longLines = visibleMarkdown.split("\n").filter((line) => line.length > 220);
  const hasApiKeyLeakRisk = /DEEPSEEK_API_KEY|sk-[A-Za-z0-9_-]{12,}/.test(markdown);

  const checks = [
    ["必要章节完整", missingHeadings.length === 0, missingHeadings.length ? `缺失：${missingHeadings.join("、")}` : "全部存在"],
    ["真实 AI 摘要区域", aiSummaryCount > 0 && markdown.includes("## 深度分析情报"), `真实 AI 摘要数量：${aiSummaryCount}`],
    ["规则摘要 / 待复核数量", reviewRows <= 15, `${reviewRows} / 15`],
    ["低优先级归档数量", archiveRows <= 15, `${archiveRows} / 15`],
    ["行动清单数量", actionCount <= 10, `${actionCount} / 10`],
    ["明日跟进数量", tomorrowCount <= 5, `${tomorrowCount} / 5`],
    ["长行风险", longLines.length === 0, longLines.length ? `${longLines.length} 行超过 220 字符，复制到飞书后建议抽查` : "未发现明显超长行"],
    ["API Key 泄露检查", !hasApiKeyLeakRisk, hasApiKeyLeakRisk ? "发现疑似密钥文本，需要立即人工检查" : "未发现疑似密钥文本"]
  ];

  return [
    "# Feishu Render Check Report",
    "",
    "## 本轮检查范围",
    "- 只检查 enhanced daily report 的 Markdown 结构和复制到飞书前的可读性风险。",
    "- 不调用飞书 API，不修改采集链路，不读取或输出 API Key。",
    "",
    "## 运行信息",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- Enhanced daily report: ${enhancedDailyPath}`,
    `- True AI summaries: ${aiSummaryCount}`,
    "",
    "## 检查结果",
    "| 检查项 | 结果 | 说明 |",
    "|---|---|---|",
    ...checks.map(([name, passed, detail]) => `| ${name} | ${passed ? "PASS" : "REVIEW"} | ${String(detail).replace(/\|/g, "/")} |`),
    "",
    "## 渲染建议",
    "- 规则摘要 / 待复核与低优先级归档已限制在 15 条以内，避免日报前半部分被列表淹没。",
    "- 长标题在表格中会截断展示，但链接仍保留在标题上。",
    "- 真实 AI 摘要仍建议人工抽查事实细节，尤其是包含产品名、数字、功能名的条目。",
    "",
    "## 下一步建议",
    "- 下一轮再做飞书 API 同步时，优先复用当前 Markdown 结构，并增加发送前预览。",
    "- 如果飞书表格仍显得拥挤，可将待复核和归档区继续改成短列表格式。",
    ""
  ].join("\n");
}

function main() {
  const startedAt = new Date().toISOString();
  const enhancedItems = readJson(enhancedItemsPath, []);
  const userFocus = readJson(userFocusPath, {});
  const settings = loadModelSettings();
  const date = formatDate(new Date(), userFocus.timezone || "UTC");
  const enhancedDailyPath = path.join(dailyOutputDir, `enhanced-ai-intel-daily-${date}.md`);

  ensureDir(dailyOutputDir);
  const enhancedMarkdown = buildEnhancedDailyMarkdown({ date, enhancedItems });
  writeText(enhancedDailyPath, enhancedMarkdown);
  writeText(
    summaryReportPath,
    buildSummaryReport({
      startedAt,
      finishedAt: new Date().toISOString(),
      settings,
      rawCount: enhancedItems.length,
      enhancedItems,
      enhancedItemsPath,
      enhancedDailyPath
    })
  );
  writeText(
    feishuRenderCheckReportPath,
    buildFeishuRenderCheckReport({
      startedAt,
      finishedAt: new Date().toISOString(),
      enhancedDailyPath,
      markdown: enhancedMarkdown,
      enhancedItems
    })
  );

  log(`Enhanced daily report: ${enhancedDailyPath}`);
  log(`Summary report: ${summaryReportPath}`);
  log(`Feishu render check report: ${feishuRenderCheckReportPath}`);
}

main();
