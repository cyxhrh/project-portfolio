const state = {
  status: null,
  activeTab: "autoReport",
  liveLog: ""
};

const $ = (id) => document.getElementById(id);

function setText(id, value) {
  $(id).textContent = value || "-";
}

function renderViewer() {
  const reports = state.status?.reports || {};
  const map = {
    autoReport: reports.auto || "暂无 auto_run_report.md",
    summaryReport: reports.summary || "暂无 daily_sync_summary_report.md",
    latestLog: reports.log || "暂无日志",
    liveLog: state.liveLog || "本次还没有运行输出。"
  };
  $("textViewer").textContent = map[state.activeTab] || "";
}

function renderStatus() {
  const status = state.status;
  if (!status) return;

  setText("runMode", status.runMode);
  setText("feishuMode", `${status.feishuSyncMode} / ${status.feishuTargetEnv}`);
  setText("lastRunTime", status.lastRunTime);
  setText("lastRunResult", status.lastRunResult);
  setText("intelTotal", status.intelTotal);
  setText("aiSummaryCount", status.aiSummaryCount);

  $("lastRunResult").className = status.lastRunResult === "success" ? "success" : "failed";
  $("linkHint").textContent = status.feishuDailyUrl || status.feishuBitableUrl
    ? "链接来自最近一次同步报告。"
    : "暂未读取到飞书链接，请先运行一次同步。";

  renderViewer();
}

async function refreshStatus() {
  state.status = await window.aiIntel.getStatus();
  renderStatus();
}

function setRunning(isRunning) {
  $("runBtn").disabled = isRunning;
  $("runBtn").textContent = isRunning ? "运行中..." : "立即运行 AI 情报收集";
  $("runHint").textContent = isRunning
    ? "正在执行，请不要重复点击。运行完成后会自动刷新。"
    : "执行完整测试闭环，并同步到飞书测试文档和测试多维表。";
}

async function runNow() {
  state.liveLog = "";
  state.activeTab = "liveLog";
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === "liveLog"));
  renderViewer();
  setRunning(true);
  const result = await window.aiIntel.runNow();
  setRunning(false);
  await refreshStatus();
  state.liveLog += `\n运行结束：${result.ok ? "成功" : "失败"}，退出码：${result.code ?? "n/a"}\n`;
  renderViewer();
}

async function setTaskTime() {
  const time = $("taskTime").value || "08:30";
  $("taskOutput").textContent = "正在保存自动化时间...";
  const result = await window.aiIntel.setTaskTime(time);
  $("taskOutput").textContent = `${result.stdout || ""}\n${result.stderr || ""}`.trim() || `完成，状态码：${result.code}`;
}

async function taskAction(action) {
  $("taskOutput").textContent = "正在执行...";
  const result = await window.aiIntel[action]();
  $("taskOutput").textContent = `${result.stdout || ""}\n${result.stderr || ""}`.trim() || `完成，状态码：${result.code}`;
}

async function openDaily() {
  const url = state.status?.feishuDailyUrl;
  if (!url) {
    $("linkHint").textContent = "暂未读取到飞书日报链接。";
    return;
  }
  await window.aiIntel.openUrl(url);
}

async function openBitable() {
  const url = state.status?.feishuBitableUrl;
  if (!url) {
    $("linkHint").textContent = "暂未读取到飞书多维表链接。";
    return;
  }
  await window.aiIntel.openUrl(url);
}

document.addEventListener("DOMContentLoaded", async () => {
  $("refreshBtn").addEventListener("click", refreshStatus);
  $("runBtn").addEventListener("click", runNow);
  $("saveTaskBtn").addEventListener("click", setTaskTime);
  $("enableTaskBtn").addEventListener("click", () => taskAction("taskEnable"));
  $("disableTaskBtn").addEventListener("click", () => taskAction("taskDisable"));
  $("taskStatusBtn").addEventListener("click", () => taskAction("taskStatus"));
  $("openDailyBtn").addEventListener("click", openDaily);
  $("openBitableBtn").addEventListener("click", openBitable);
  $("openLogsBtn").addEventListener("click", () => window.aiIntel.openPath("logs"));
  $("openProjectBtn").addEventListener("click", () => window.aiIntel.openPath("project"));

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeTab = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
      renderViewer();
    });
  });

  window.aiIntel.onRunLog((data) => {
    state.liveLog += data;
    if (state.activeTab === "liveLog") renderViewer();
  });
  window.aiIntel.onRunning((data) => setRunning(data.running));

  await refreshStatus();
});
