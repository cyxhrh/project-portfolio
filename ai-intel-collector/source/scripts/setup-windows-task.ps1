param(
  [string]$TaskName = "AI Intel Collector Daily",
  [Alias("Time")]
  [string]$RunTime = "08:30",
  [switch]$Create,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $ProjectRoot "logs"
$LogFile = Join-Path $LogDir "ai-intel-auto-scheduled.log"
$Command = "cd /d `"$ProjectRoot`" && npm run ai:intel:auto >> `"$LogFile`" 2>&1"
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $Command"
$Trigger = New-ScheduledTaskTrigger -Daily -At $RunTime

Write-Host "AI Intel Collector Windows task preview"
Write-Host "Project root: $ProjectRoot"
Write-Host "Task name: $TaskName"
Write-Host "Run time: $RunTime"
Write-Host "Command: $Command"
Write-Host ""

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

if (-not $Create) {
  Write-Host "No task was created."
  Write-Host "To create it after confirming the preview, run:"
  Write-Host "powershell -ExecutionPolicy Bypass -File scripts/setup-windows-task.ps1 -Create"
  exit 0
}

if (-not $Yes) {
  $answer = Read-Host "Create this scheduled task now? Type YES to continue"
  if ($answer -ne "YES") {
    Write-Host "Cancelled. No task was created."
    exit 0
  }
}

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Description "Run AI Intel Collector daily automation" -Force | Out-Null
Write-Host "Scheduled task created: $TaskName"
