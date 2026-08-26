#requires -Version 5.1
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$ProjectRoot = 'C:\Projetos\TI Wisdom\wisdom-ti'
Set-Location $ProjectRoot

function Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

$Required = @(
    'src\branding\BrandContext.tsx',
    'src\branding\branding-service.ts',
    'src\pages\ReportsPage.tsx',
    'src\data\m10-service.ts',
    'src\types\m10.ts',
    'supabase\migrations\20260826_170000_m10_consolidation_branding_reports.sql',
    'supabase\sql-history\M10_SUPABASE.sql',
    'public\inventario-ti.svg',
    'public\_redirects',
    'docs\M10_TESTS.md',
    'docs\M10_DEPLOY_CLOUDFLARE.md'
)

foreach ($relative in $Required) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $relative))) {
        throw "Arquivo M10 ausente: $relative"
    }
}

Ok "Arquivos M10 presentes"

$Checks = @(
    @{ File = 'src\components\brand\WisdomMark.tsx'; Text = 'branding.logoUrl' },
    @{ File = 'src\components\assets\AssetQrLabelCard.tsx'; Text = 'branding.organizationName' },
    @{ File = 'src\pages\SettingsPage.tsx'; Text = 'uploadInstitutionLogo' },
    @{ File = 'src\pages\DashboardPage.tsx'; Text = 'getDashboardSummary' },
    @{ File = 'src\pages\ReportsPage.tsx'; Text = 'getOperationalReport' },
    @{ File = 'src\App.tsx'; Text = '/relatorios' },
    @{ File = 'src\types\auth.ts'; Text = 'reports.view' },
    @{ File = 'vite.config.ts'; Text = 'Inventário TI' },
    @{ File = 'supabase\sql-history\M10_SUPABASE.sql'; Text = 'get_public_branding' }
)

foreach ($check in $Checks) {
    $content = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $ProjectRoot $check.File)

    if (-not $content.Contains($check.Text)) {
        throw "Validacao M10 falhou: $($check.File) / $($check.Text)"
    }
}

Ok "Integracoes M10 confirmadas"

Write-Host ""
Write-Host "==> Build" -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    throw 'Build M10 falhou.'
}
Ok "Build"

Write-Host ""
Write-Host "==> Lint" -ForegroundColor Cyan
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) {
    throw 'Lint M10 falhou.'
}
Ok "Lint"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " INVENTARIO TI - M10 LOCAL VALIDADO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
