<#
.SYNOPSIS
Writes dist/SHA256SUMS.txt for all release artifacts.

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/make-checksums.ps1
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'

if (-not (Test-Path -LiteralPath $dist)) {
  throw "No dist directory found. Run 'npm run dist:win' first."
}

$artifacts = Get-ChildItem -LiteralPath $dist -File |
  Where-Object {
    ($_.Extension -in @('.exe', '.zip', '.dmg', '.AppImage', '.yml')) -and
    $_.Name -ne 'builder-debug.yml'
  } |
  Sort-Object Name

if ($artifacts.Count -eq 0) {
  throw 'No release artifacts found in dist.'
}

$lines = foreach ($artifact in $artifacts) {
  $hash = (Get-FileHash -LiteralPath $artifact.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  "{0}  {1}" -f $hash, $artifact.Name
}

$output = Join-Path $dist 'SHA256SUMS.txt'
Set-Content -LiteralPath $output -Value $lines -Encoding utf8

Write-Host "[pulse] wrote $output"
$lines | ForEach-Object { Write-Host "  $_" }
