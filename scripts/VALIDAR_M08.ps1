#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projetos\TI Wisdom\wisdom-ti"

function Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

$Required = @(
    "src\types\admin.ts",
    "src\data\admin-service.ts",
    "src\pages\UsersPage.tsx",
    "src\pages\LogsPage.tsx",
    "src\pages\SettingsPage.tsx",
    "src\components\layout\navigation.ts",
    "src\App.tsx",
    "supabase\functions\admin-users\index.ts",
    "supabase\migrations\20260826_110000_m08_administration.sql",
    "supabase\sql-history\M08_SUPABASE.sql",
    "docs\M08_TESTS.md"
)

foreach ($Relative in $Required) {
    $Path = Join-Path $ProjectRoot $Relative

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Arquivo M08 ausente: $Relative"
    }
}

Ok "Arquivos M08 presentes"

$Checks = @(
    @{ File = "src\App.tsx"; Text = 'path="/logs"' },
    @{ File = "src\App.tsx"; Text = 'permission="logs.view"' },
    @{ File = "src\components\layout\navigation.ts"; Text = "path: '/logs'" },
    @{ File = "src\pages\UsersPage.tsx"; Text = "inviteAdminUser" },
    @{ File = "src\pages\SettingsPage.tsx"; Text = "updateSystemSetting" },
    @{ File = "src\pages\LogsPage.tsx"; Text = "listAuditLogs" },
    @{ File = "src\data\admin-service.ts"; Text = "'admin-users'" },
    @{ File = "supabase\functions\admin-users\index.ts"; Text = "inviteUserByEmail" },
    @{ File = "supabase\sql-history\M08_SUPABASE.sql"; Text = "update_system_setting" }
)

foreach ($Check in $Checks) {
    $Path = Join-Path $ProjectRoot $Check.File
    $Content = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path

    if (-not $Content.Contains($Check.Text)) {
        throw "Validacao M08 falhou em $($Check.File): $($Check.Text)"
    }
}

Ok "Integracoes M08 confirmadas"

$M07Checks = @(
    "src\pages\MaintenancePage.tsx",
    "src\pages\MaintenanceDetailPage.tsx",
    "src\data\maintenance-service.ts",
    "supabase\migrations\20260825_093600_m07_maintenance_lifecycle.sql"
)

foreach ($Relative in $M07Checks) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $Relative))) {
        throw "Regressao: arquivo M07 ausente: $Relative"
    }
}

Ok "M07 preservado"

Push-Location $ProjectRoot
try {
    Write-Host ""
    Write-Host "==> Build" -ForegroundColor Cyan
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build M08 falhou."
    }
    Ok "Build"

    Write-Host ""
    Write-Host "==> Lint" -ForegroundColor Cyan
    & npm.cmd run lint
    if ($LASTEXITCODE -ne 0) {
        throw "Lint M08 falhou."
    }
    Ok "Lint"
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host " WISDOM TI - M08 LOCAL VALIDADO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host ""
