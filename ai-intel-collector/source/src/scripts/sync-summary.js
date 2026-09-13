const { writeText } = require("../utils/fileStore");
const { log } = require("../utils/logger");
const {
  dailySyncSummaryReportPath,
  manualAcceptanceChecklistPath,
  productionReadinessReportPath,
  round11ReportPath
} = require("../utils/paths");
const { buildDailySyncSummaryReport } = require("../reports/dailySyncSummary");
const {
  buildManualAcceptanceChecklist,
  buildProductionReadinessReport,
  buildRound11Report
} = require("../reports/round11Reports");

function main() {
  const startedAt = new Date().toISOString();
  const finishedAt = new Date().toISOString();

  writeText(dailySyncSummaryReportPath, buildDailySyncSummaryReport({ startedAt, finishedAt }));
  writeText(manualAcceptanceChecklistPath, buildManualAcceptanceChecklist({ generatedAt: finishedAt }));
  writeText(productionReadinessReportPath, buildProductionReadinessReport({ generatedAt: finishedAt }));
  writeText(round11ReportPath, buildRound11Report({ generatedAt: finishedAt }));

  log(`Daily sync summary report: ${dailySyncSummaryReportPath}`);
  log(`Manual acceptance checklist: ${manualAcceptanceChecklistPath}`);
  log(`Production readiness report: ${productionReadinessReportPath}`);
  log(`Round 11 report: ${round11ReportPath}`);
}

main();
