#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projetos\Inventario TI - Instancia 2\inventario-ti"

function Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

$Required = @(
    "src\types\evidence.ts",
    "src\data\evidence-service.ts",
    "src\lib\evidence-image.ts",
    "src\components\evidence\EvidencePanel.tsx",
    "src\pages\AssetDetailPage.tsx",
    "src\pages\AuditExecutionPage.tsx",
    "src\pages\StockDetailPage.tsx"
)

foreach ($Relative in $Required) {
    $Path = Join-Path $ProjectRoot $Relative

    if (-not (Test-Path $Path)) {
        throw "Arquivo ausente: $Relative"
    }
}

Ok "Arquivos M06 Frontend presentes"

$Checks = @(
    @{
        File = "src\pages\AssetDetailPage.tsx"
        Text = "EvidencePanel"
    },
    @{
        File = "src\pages\AuditExecutionPage.tsx"
        Text = "EvidencePanel"
    },
    @{
        File = "src\pages\StockDetailPage.tsx"
        Text = "EvidencePanel"
    },
    @{
        File = "src\data\evidence-service.ts"
        Text = "evidence-upload"
    },
    @{
        File = "src\data\evidence-service.ts"
        Text = "evidence-file"
    },
    @{
        File = "src\data\evidence-service.ts"
        Text = "evidence-revoke"
    }
)

foreach ($Check in $Checks) {
    $Path = Join-Path $ProjectRoot $Check.File
    $Content = Get-Content -Raw -Encoding UTF8 $Path

    if (-not $Content.Contains($Check.Text)) {
        throw "Validacao falhou em $($Check.File): $($Check.Text)"
    }
}

Ok "Integracoes de evidencia confirmadas"

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
Write-Host " WISDOM TI - M06 FRONTEND VALIDADO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host ""
