param(
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
  throw "Could not find .venv\Scripts\python.exe. Create the virtual environment and install requirements first."
}

if ($Clean) {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue `
    (Join-Path $ProjectRoot "build"),
    (Join-Path $ProjectRoot "dist"),
    (Join-Path $ProjectRoot "Video Knowledge Mapper.spec")
}

& $VenvPython -m pip install -r (Join-Path $ProjectRoot "requirements.txt")
& $VenvPython -m pip install -r (Join-Path $ProjectRoot "requirements-build.txt")

$PyInstallerArgs = @(
  "-m", "PyInstaller",
  "--noconfirm",
  "--clean",
  "--windowed",
  "--onedir",
  "--name", "Video Knowledge Mapper",
  "--paths", (Join-Path $ProjectRoot "src"),
  "--collect-all", "PySide6",
  "--collect-all", "faster_whisper",
  "--collect-all", "ctranslate2",
  "--collect-all", "tokenizers",
  "--collect-all", "huggingface_hub"
)

$BundledFfmpeg = Join-Path $ProjectRoot "tools\ffmpeg\bin\ffmpeg.exe"
if (Test-Path $BundledFfmpeg) {
  $PyInstallerArgs += @(
    "--add-binary",
    "$BundledFfmpeg;tools\ffmpeg\bin"
  )
}

$PyInstallerArgs += "src\vkm\app.py"

Push-Location $ProjectRoot
try {
  & $VenvPython @PyInstallerArgs
}
finally {
  Pop-Location
}

$ExePath = Join-Path $ProjectRoot "dist\Video Knowledge Mapper\Video Knowledge Mapper.exe"
if (Test-Path $ExePath) {
  Write-Host ""
  Write-Host "Build complete:"
  Write-Host $ExePath
}
else {
  throw "Build finished, but the executable was not found at $ExePath"
}
