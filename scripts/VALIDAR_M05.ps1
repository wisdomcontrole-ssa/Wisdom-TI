#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projetos\Inventario TI - Instancia 2\inventario-ti"

if (-not (Test-Path $ProjectRoot)) {
    throw "Projeto nao encontrado: $ProjectRoot"
}

$required = @(
    "src\types\audit.ts",
    "src\data\audit-service.ts",
    "src\components\audits\AuditScanner.tsx",
    "src\components\assets\AssetQrLabelCard.tsx",
    "src\pages\AuditsPage.tsx",
    "src\pages\AuditExecutionPage.tsx"
)

foreach ($relative in $required) {
    $path = Join-Path $ProjectRoot $relative

    if (-not (Test-Path $path)) {
        throw "Arquivo M05 ausente: $relative"
    }
}

Push-Location $ProjectRoot

try {
    Write-Host "==> Build M05" -ForegroundColor Cyan
    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Build M05 falhou."
    }

    Write-Host "[OK] Build" -ForegroundColor Green

    Write-Host "==> Lint M05" -ForegroundColor Cyan
    & npm.cmd run lint

    if ($LASTEXITCODE -ne 0) {
        throw "Lint M05 falhou."
    }

    Write-Host "[OK] Lint" -ForegroundColor Green
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "[OK] Validacao local M05 concluida." -ForegroundColor Green
