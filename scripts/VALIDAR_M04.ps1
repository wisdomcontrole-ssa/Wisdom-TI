#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projetos\Inventario TI - Instancia 2\inventario-ti"
Set-Location $ProjectRoot

Write-Host ""
Write-Host "WISDOM TI - VALIDACAO M04" -ForegroundColor Cyan
Write-Host ""

& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    throw "Build M04 falhou."
}

& npm.cmd run lint
if ($LASTEXITCODE -ne 0) {
    throw "Lint M04 falhou."
}

Write-Host ""
Write-Host "[OK] Build e lint do M04 concluidos." -ForegroundColor Green
