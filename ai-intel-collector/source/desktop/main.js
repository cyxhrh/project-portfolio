const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const taskName = "AI Intel Collector Daily";

let mainWindow;
let runningProcess = null;

function readText(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson(relativePath, fallback) {
  try {
    const text = readText(relativePath);
    return text.trim() ? JSON.parse(text) : fallback;
  } catch (_) {
    return fallback;
  }
}

function parseEnv() {
  const text = readText(".env");
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

function matchLine(text, label) {
  const match = text.match(new RegExp(`- ${label}:\\s*(.+)`));
  return match ? match[1].trim() : "";
}

function sanitize(text) {
  return String(text || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/tenant_access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+/g, "tenant_access_token=[REDACTED]")
    .replace(/user_access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+/g, "user_access_token=[REDACTED]")
    .replace(/(DEEPSEEK_API_KEY|FEISHU_APP_SECRET|FEISHU_APP_ID)\s*=\s*\S+/g, "$1=[REDACTED]");
}

function latestAutoLogPath() {
  const logsDir = path.join(projectRoot, "logs");
  if (!fs.existsSync(logsDir)) return "";
  const logs = fs.readdirSync(logsDir)
    .filter((name) => /^ai-intel-auto-\d{4}-\d{2}-\d{2}\.log$/.test(name))
    .map((name) => {
      const fullPath = path.join(logsDir, name);
      return { name, fullPath, mtime: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return logs[0]?.fullPath || "";
}

function getStatus() {
  const env = parseEnv();
  const autoReport = readText("auto_run_report.md");
  const dailySummary = readText("daily_sync_summary_report.md");
  const bitableState = readJson("output/feishu/feishu_cli_bitable_state.json", {});

  return {
    runMode: env.AI_INTEL_RUN_MODE || "test",
    feishuSyncMode: env.FEISHU_SYNC_MODE || "cli",
    feishuTargetEnv: env.FEISHU_TARGET_ENV || "test",
    lastRunTime: matchLine(autoReport, "Finished at") || matchLine(dailySummary, "Finished at") || "暂无记录",
    lastRunResult: matchLine(autoReport, "Overall status") || "unknown",
    intelTotal: matchLine(dailySummary, "Intel total") || "0",
    aiSummaryCount: matchLine(dailySummary, "Real AI summaries in enhanced_items effective count")
      || matchLine(dailySummary, "Real AI summaries in payload preview")
      || "0",
    feishuDailyUrl: matchLine(dailySummary, "Document URL"),
    feishuBitableUrl: matchLine(dailySummary, "Bitable URL") || bitableState.base_url || "",
    reports: {
      auto: sanitize(autoReport),
      summary: sanitize(dailySummary),
      log: sanitize(latestAutoLogPath() ? fs.readFileSync(latestAutoLogPath(), "utf8") : "")
    },
    paths: {
      projectRoot,
      logs: path.join(projectRoot, "logs"),
      latestLog: latestAutoLogPath()
    }
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    title: "AI Intel Collector",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function runPowerShell(args) {
  return new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], {
      cwd: projectRoot,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    child.on("close", (code) => {
      resolve({ ok: code === 0, code, stdout: sanitize(stdout), stderr: sanitize(stderr) });
    });
  });
}

ipcMain.handle("status:get", () => getStatus());

ipcMain.handle("auto:run", () => new Promise((resolve) => {
  if (runningProcess) {
    resolve({ ok: false, message: "already_running" });
    return;
  }

  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm run ai:intel:auto"] : ["run", "ai:intel:auto"];
  runningProcess = spawn(command, args, { cwd: projectRoot, windowsHide: true });

  mainWindow.webContents.send("auto:running", { running: true });
  runningProcess.stdout.on("data", (data) => mainWindow.webContents.send("auto:log", sanitize(data.toString())));
  runningProcess.stderr.on("data", (data) => mainWindow.webContents.send("auto:log", sanitize(data.toString())));
  runningProcess.on("close", (code) => {
    runningProcess = null;
    mainWindow.webContents.send("auto:running", { running: false });
    resolve({ ok: code === 0, code, status: getStatus() });
  });
}));

ipcMain.handle("task:setTime", async (_event, time) => {
  const safeTime = String(time || "").match(/^\d{2}:\d{2}$/) ? time : "08:30";
  return runPowerShell(["-File", "scripts\\setup-windows-task.ps1", "-Time", safeTime, "-Create", "-Yes"]);
});

ipcMain.handle("task:status", () => runPowerShell(["-Command", `Get-ScheduledTask -TaskName '${taskName}' | Select-Object TaskName,State,TaskPath | Format-List; $task = Get-ScheduledTask -TaskName '${taskName}'; $task.Triggers | Select-Object Enabled,DaysInterval,StartBoundary | Format-List`]));
ipcMain.handle("task:enable", () => runPowerShell(["-Command", `Enable-ScheduledTask -TaskName '${taskName}' | Out-Null; Get-ScheduledTask -TaskName '${taskName}' | Select-Object TaskName,State | Format-List`]));
ipcMain.handle("task:disable", () => runPowerShell(["-Command", `Disable-ScheduledTask -TaskName '${taskName}' | Out-Null; Get-ScheduledTask -TaskName '${taskName}' | Select-Object TaskName,State | Format-List`]));

ipcMain.handle("open:url", (_event, url) => {
  if (!url) return false;
  shell.openExternal(url);
  return true;
});

ipcMain.handle("open:path", (_event, target) => {
  const allowList = {
    logs: path.join(projectRoot, "logs"),
    project: projectRoot
  };
  const targetPath = allowList[target];
  if (!targetPath) return false;
  shell.openPath(targetPath);
  return true;
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
