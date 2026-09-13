param(
  [string]$ShortcutName = "AI Intel Collector"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "$ShortcutName.lnk"
$LauncherPath = Join-Path $ProjectRoot "scripts\start-desktop-hidden.vbs"
$IconPath = Join-Path $ProjectRoot "assets\ai-intel-collector-icon.ico"

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$LauncherPath`""
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.Description = "AI Intel Collector desktop console"
if (Test-Path $IconPath) {
  $Shortcut.IconLocation = $IconPath
}
$Shortcut.Save()

Write-Host "Desktop shortcut created: $ShortcutPath"
