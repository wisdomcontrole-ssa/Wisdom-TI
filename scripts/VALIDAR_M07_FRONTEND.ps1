#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projetos\TI Wisdom\wisdom-ti"

function Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

$Required = @(
    "src\types\maintenance.ts",
    "src\data\maintenance-service.ts",
    "src\components\maintenance\MaintenanceCreateModal.tsx",
    "src\components\maintenance\AssetLifecyclePanel.tsx",
    "src\pages\MaintenancePage.tsx",
    "src\pages\MaintenanceDetailPage.tsx",
    "src\components\evidence\EvidencePanel.tsx",
    "src\pages\AssetDetailPage.tsx",
    "src\pages\AssetsPage.tsx",
    "src\components\layout\navigation.ts",
    "supabase\migrations\20260825_093600_m07_maintenance_lifecycle.sql",
    "supabase\sql-history\M07_SUPABASE.sql",
    "supabase\sql-history\M07_VALIDAR.sql"
)

foreach ($Relative in $Required) {
    $Path = Join-Path $ProjectRoot $Relative

    if (-not (Test-Path $Path)) {
        throw "Arquivo ausente: $Relative"
    }
}

Ok "Arquivos M07 V3 presentes"

$Checks = @(
    @{ File = "src\App.tsx"; Text = "/manutencoes" },
    @{ File = "src\components\layout\navigation.ts"; Text = "export const mainNavigation" },
    @{ File = "src\components\layout\navigation.ts"; Text = "export const adminNavigation" },
    @{ File = "src\components\layout\navigation.ts"; Text = "path: '/manutencoes'" },
    @{ File = "src\pages\AssetDetailPage.tsx"; Text = "AssetLifecyclePanel" },
    @{ File = "src\pages\MaintenanceDetailPage.tsx"; Text = "Evidências da manutenção" },
    @{ File = "src\data\maintenance-service.ts"; Text = "dispose_asset" },
    @{ File = "src\components\evidence\EvidencePanel.tsx"; Text = "visibleCategories" }
)

foreach ($Check in $Checks) {
    $Path = Join-Path $ProjectRoot $Check.File
    $Content = Get-Content -Raw -Encoding UTF8 $Path

    if (-not $Content.Contains($Check.Text)) {
        throw "Validacao falhou em $($Check.File): $($Check.Text)"
    }
}

Ok "Navegacao e integracoes M07 V3 confirmadas"

Push-Location $ProjectRoot

try {
    Write-Host ""
    Write-Host "==> Build" -ForegroundColor Cyan

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Build falhou."
    }

    Ok "Build"

    Write-Host ""
    Write-Host "==> Lint" -ForegroundColor Cyan

    & npm.cmd run lint

    if ($LASTEXITCODE -ne 0) {
        throw "Lint falhou."
    }

    Ok "Lint"
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host " WISDOM TI - M07 FRONTEND V3 VALIDADO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host ""