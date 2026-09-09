<#
tools/trim-icons.ps1

Device-review Pass DR7 ("Icons even bigger — fill the square without
overflowing"): icons/optimized/*.png (04-06's downscaled 144px set) still
look small on the map because the SOURCE art in icons/*.png (1254px
originals) carries a wide transparent margin around the actual opaque
glyph — drawFeatureIcon() draws at a fixed fraction of the cell regardless
of how much of that square is real pixel content, so padding in the source
shows up as visual "smallness" on the map no matter how the draw factor is
tuned.

This is the same dependency-free PowerShell/System.Drawing approach 04-06's
original downscale commit used (see that commit's own message: "mirroring
02-04's launcher-icon pipeline since @capacitor/assets is broken in this
environment") — no npm image library, just .NET's built-in GDI+ bindings,
which every Windows dev box already has.

For each icons/*.png (1254x1254 source, untouched):
  1. Scan for the bounding box of pixels whose alpha exceeds ALPHA_THRESHOLD
     (trims fully-transparent padding without being thrown off by a few
     stray near-invisible anti-alias fringe pixels).
  2. Crop to that bounding box — the art now touches its own edges with zero
     padding.
  3. Scale the crop (preserving aspect ratio — never stretched/distorted) so
     its LARGER dimension exactly fills OUT_SIZE, then center it on a fully
     transparent OUT_SIZE x OUT_SIZE canvas.
  4. Save to icons/optimized/<name>.png, overwriting the existing (padded)
     downscale.

Combined with drawFeatureIcon()'s size factor (src/browser/icons.js, this
same round: 1.08 -> 1.0), a feature icon now visibly fills its map cell
edge-to-edge on at least one axis, with no overflow past the cell — "fill
the square" rather than "fill the square and then some" (1.08) or "float in
the middle of it" (padded source at 1.0).

Usage: pwsh -File tools/trim-icons.ps1   (or: powershell -File ...)
Re-run any time icons/*.png sources change; icons/optimized/*.png is
committed output, not a build artifact.
#>

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$srcDir = Join-Path $root "icons"
$outDir = Join-Path $root "icons\optimized"
$outSize = 144
$alphaThreshold = 10   # ignore near-fully-transparent anti-alias fringe when finding the bounding box

if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}

function Get-OpaqueBounds([System.Drawing.Bitmap]$bmp) {
  $w = $bmp.Width
  $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $stride = $data.Stride
    $bytes = New-Object byte[] ($stride * $h)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  } finally {
    $bmp.UnlockBits($data)
  }

  $minX = $w; $maxX = -1; $minY = $h; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    $rowOffset = $y * $stride
    for ($x = 0; $x -lt $w; $x++) {
      # BGRA byte order in a 32bppArgb GDI+ bitmap; alpha is the 4th byte.
      $alpha = $bytes[$rowOffset + ($x * 4) + 3]
      if ($alpha -gt $alphaThreshold) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0) {
    # Fail-open: an all-transparent source (shouldn't happen for real art)
    # falls back to the full image rather than throwing.
    return New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  }
  return New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
}

$sources = Get-ChildItem -Path $srcDir -Filter "*.png" -File
if ($sources.Count -eq 0) {
  throw "No PNG sources found in $srcDir"
}

foreach ($file in $sources) {
  $name = $file.BaseName
  Write-Output "Processing $name.png..."

  $src = [System.Drawing.Bitmap]::FromFile($file.FullName)
  try {
    $bounds = Get-OpaqueBounds $src

    $cropped = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $g = [System.Drawing.Graphics]::FromImage($cropped)
      try {
        $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $bounds.Width, $bounds.Height)), $bounds, [System.Drawing.GraphicsUnit]::Pixel)
      } finally {
        $g.Dispose()
      }

      # Scale to fit OUT_SIZE on the larger axis, preserving aspect ratio —
      # never stretched/distorted, and never overflowing the output canvas.
      $scale = [Math]::Min([double]$outSize / $bounds.Width, [double]$outSize / $bounds.Height)
      $destW = [Math]::Max(1, [int][Math]::Round($bounds.Width * $scale))
      $destH = [Math]::Max(1, [int][Math]::Round($bounds.Height * $scale))
      $destX = [int](([double]$outSize - $destW) / 2)
      $destY = [int](([double]$outSize - $destH) / 2)

      $out = New-Object System.Drawing.Bitmap($outSize, $outSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        $g2 = [System.Drawing.Graphics]::FromImage($out)
        try {
          $g2.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
          $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $g2.Clear([System.Drawing.Color]::Transparent)
          $g2.DrawImage($cropped, (New-Object System.Drawing.Rectangle($destX, $destY, $destW, $destH)))
        } finally {
          $g2.Dispose()
        }

        $outPath = Join-Path $outDir "$name.png"
        $out.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Output "  -> $outPath ($destW x $destH content on a ${outSize}x${outSize} canvas, cropped from $($bounds.Width)x$($bounds.Height))"
      } finally {
        $out.Dispose()
      }
    } finally {
      $cropped.Dispose()
    }
  } finally {
    $src.Dispose()
  }
}

Write-Output "Done. Re-run 'npm run build:www' to ship the updated icons/optimized/*.png."
