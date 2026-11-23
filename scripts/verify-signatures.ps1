<#
.SYNOPSIS
Verifies Authenticode signatures on Antigravity Pulse Windows artifacts.

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-signatures.ps1
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$targets = @()
$targets += Get-ChildItem -LiteralPath 'dist' -File -Filter '*.exe' -ErrorAction SilentlyContinue
$targets += Get-ChildItem -LiteralPath (Join-Path 'dist' 'win-unpacked') -File -Filter '*.exe' -ErrorAction SilentlyContinue

if ($targets.Count -eq 0) {
  throw 'No executable artifacts found. Run npm run dist:win (or scripts/dist-signed.ps1) first.'
}

$rows = foreach ($file in $targets) {
  $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
  [PSCustomObject]@{
    File     = $file.Name
    Status   = $signature.Status
    Signer   = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { '(unsigned)' }
    Message  = $signature.StatusMessage
  }
}

$rows | Format-Table -AutoSize

$invalid = @($rows | Where-Object { $_.Status -ne 'Valid' })
if ($invalid.Count -gt 0) {
  Write-Warning "$($invalid.Count) file(s) are not validly signed. Unsigned files are expected for the v1.0.0 public release."
  exit 1
}

Write-Host '[pulse] all artifacts are validly signed.'
