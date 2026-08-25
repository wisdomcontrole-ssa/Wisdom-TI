#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\Projetos\TI Wisdom\wisdom-ti"
Set-Location $ProjectRoot

if (-not (Test-Path ".\.env.local")) {
  Write-Host "[ATENÇÃO] .env.local ainda não existe." -ForegroundColor Yellow
} else {
  Write-Host "[OK] .env.local encontrado." -ForegroundColor Green
}

& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Build falhou." }
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw "Lint falhou." }
Write-Host "[OK] Validação local M02 concluída." -ForegroundColor Green
