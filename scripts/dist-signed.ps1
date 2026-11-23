<#
.SYNOPSIS
Builds signed Windows artifacts and verifies their Authenticode signatures.

.DESCRIPTION
Requires either:
  - an active `azureSignOptions` block in electron-builder.yml (Azure Trusted Signing), or
  - CSC_LINK / CSC_KEY_PASSWORD environment variables (local PFX).

See docs/CODE_SIGNING.md for setup. No certificate material is stored in this repo.
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$config = Get-Content -LiteralPath 'electron-builder.yml' -Raw
$azureEnabled = [bool]($config -match '(?m)^\s{2}azureSignOptions:\s*$')
$pfxEnabled = [bool]$env:CSC_LINK

if (-not $azureEnabled -and -not $pfxEnabled) {
  throw "No signing configuration found. Enable azureSignOptions in electron-builder.yml or set CSC_LINK. See docs/CODE_SIGNING.md."
}

if ($pfxEnabled) {
  Write-Host "[pulse] signing with local PFX from CSC_LINK"
  if (-not $env:CSC_KEY_PASSWORD) {
    Write-Host "[pulse] note: CSC_KEY_PASSWORD is not set (fine for a hardware token)"
  }
} else {
  Write-Host "[pulse] signing with Azure Trusted Signing (requires az login or AZURE_* env vars)"
}

npm run dist:win
if ($LASTEXITCODE -ne 0) { throw "Signed build failed with exit code $LASTEXITCODE." }

powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'verify-signatures.ps1')
