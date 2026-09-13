$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AssetsDir = Join-Path $ProjectRoot "assets"
$PngPath = Join-Path $AssetsDir "ai-intel-collector-icon.png"
$IcoPath = Join-Path $AssetsDir "ai-intel-collector-icon.ico"

if (-not (Test-Path $AssetsDir)) {
  New-Item -ItemType Directory -Path $AssetsDir | Out-Null
}

Add-Type -AssemblyName System.Drawing

$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-Brush($hex) {
  return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function New-Pen($hex, $width) {
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($hex)), $width
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  return $pen
}

function Fill-RoundedRectangle($g, $brush, $x, $y, $w, $h, $r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($x, $y, $r, $r, 180, 90)
  $path.AddArc($x + $w - $r, $y, $r, $r, 270, 90)
  $path.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90)
  $path.AddArc($x, $y + $h - $r, $r, $r, 90, 90)
  $path.CloseFigure()
  $g.FillPath($brush, $path)
  $path.Dispose()
}

$bg = New-Brush "#101827"
Fill-RoundedRectangle $graphics $bg 18 18 220 220 44

$glowBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle 32, 28, 190, 200),
  [System.Drawing.ColorTranslator]::FromHtml("#123B64"),
  [System.Drawing.ColorTranslator]::FromHtml("#102A28"),
  35
)
Fill-RoundedRectangle $graphics $glowBrush 32 30 192 196 36

$cyanPen = New-Pen "#39D6FF" 12
$greenPen = New-Pen "#49E68B" 10
$bluePen = New-Pen "#6B8CFF" 8
$whitePen = New-Pen "#EAF7FF" 6

$graphics.DrawArc($cyanPen, 58, 58, 140, 140, 205, 240)
$graphics.DrawArc($greenPen, 78, 78, 100, 100, 215, 225)
$graphics.DrawArc($bluePen, 99, 99, 58, 58, 230, 200)

$centerBrush = New-Brush "#EAF7FF"
$accentBrush = New-Brush "#49E68B"
$graphics.FillEllipse($centerBrush, 112, 112, 32, 32)
$graphics.FillEllipse($accentBrush, 121, 121, 14, 14)

$graphics.DrawLine($whitePen, 128, 128, 177, 78)
$graphics.FillEllipse((New-Brush "#FFD166"), 172, 68, 22, 22)

$font = New-Object System.Drawing.Font "Segoe UI", 38, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$textBrush = New-Brush "#EAF7FF"
$graphics.DrawString("AI", $font, $textBrush, 78, 154)

$bitmap.Save($PngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [System.IO.File]::Open($IcoPath, [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()

$graphics.Dispose()
$bitmap.Dispose()
$icon.Dispose()

Write-Host "Icon PNG: $PngPath"
Write-Host "Icon ICO: $IcoPath"
