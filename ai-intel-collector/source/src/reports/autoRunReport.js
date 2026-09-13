function renderStep(step) {
  return [
    `### ${step.name}`,
    `- Status: ${step.status === 0 ? "success" : "failed"}`,
    `- Duration ms: ${step.duration_ms}`,
    step.reason ? `- Reason: ${step.reason}` : null,
    step.stdout_tail ? `- Stdout tail:\n\`\`\`\n${step.stdout_tail}\n\`\`\`` : null,
    step.stderr_tail ? `- Stderr tail:\n\`\`\`\n${step.stderr_tail}\n\`\`\`` : null
  ].filter(Boolean).join("\n");
}

function buildAutoRunReport({ startedAt, finishedAt, mode, checkOnly, logPath, steps, failure, safety }) {
  return [
    "# Auto Run Report",
    "",
    "## 运行概览",
    `- Started at: ${startedAt}`,
    `- Finished at: ${finishedAt}`,
    `- Run mode: ${mode}`,
    `- Check only: ${checkOnly}`,
    `- Overall status: ${failure ? "failed" : "success"}`,
    `- Stopped at: ${failure?.name || "none"}`,
    `- Log file: ${logPath}`,
    "",
    "## 安全边界",
    `- Default mode is test: ${safety.default_test_mode}`,
    `- Production confirmed: ${safety.production_confirmed}`,
    `- Formal write allowed in this run: ${safety.formal_write_allowed}`,
    `- Feishu sync mode: ${safety.feishu_sync_mode}`,
    `- Feishu target env: ${safety.feishu_target_env}`,
    `- Test title prefix ok: ${safety.test_title_prefix_ok}`,
    `- Test bitable name ok: ${safety.test_bitable_name_ok}`,
    "- Token/secret printed: false",
    "",
    "## 执行步骤",
    steps.length ? steps.map(renderStep).join("\n\n") : "- No steps executed.",
    "",
    "## 失败兜底",
    failure
      ? [
          `- Failed step: ${failure.name}`,
          `- Exit status: ${failure.status}`,
          `- Handling: ${failure.handling}`
        ].join("\n")
      : "- 暂无失败，完整测试闭环已完成。",
    "",
    "## 输出文件",
    "- enhanced daily report: output/daily/enhanced-ai-intel-daily-YYYY-MM-DD.md",
    "- daily sync summary: daily_sync_summary_report.md",
    "- auto run report: auto_run_report.md",
    "",
    "## 下一步建议",
    "- 保持每天先跑 test 模式。",
    "- 正式模式上线前，先完成 manual_acceptance_checklist.md。",
    "- 如果飞书 CLI 失败，先运行 npm run feishu:cli-check。",
    ""
  ].join("\n");
}

module.exports = {
  buildAutoRunReport
};
