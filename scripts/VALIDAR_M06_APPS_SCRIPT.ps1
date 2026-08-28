#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projetos\Inventario TI - Instancia 2\inventario-ti"

$Required = @(
    "supabase\functions\_shared\apps-script.ts",
    "supabase\functions\drive-health\index.ts",
    "supabase\functions\evidence-upload\index.ts",
    "supabase\functions\evidence-file\index.ts",
    "supabase\functions\evidence-revoke\index.ts",
    "supabase\functions\.env.example",
    "docs\M06_GOOGLE_DRIVE_APPS_SCRIPT.md"
)

foreach ($Relative in $Required) {
    $Path = Join-Path $ProjectRoot $Relative

    if (-not (Test-Path $Path)) {
        throw "Arquivo ausente: $Relative"
    }
}

$OldDrive = Join-Path `
    $ProjectRoot `
    "supabase\functions\_shared\drive.ts"

if (Test-Path $OldDrive) {
    throw "Implementacao antiga drive.ts ainda existe."
}

$SecretExample = Get-Content `
    -Raw `
    -Encoding UTF8 `
    (Join-Path $ProjectRoot "supabase\functions\.env.example")

if (
    $SecretExample.Contains(
        "GOOGLE_SERVICE_ACCOUNT"
    )
) {
    throw "Configuracao antiga de Service Account ainda presente."
}

Push-Location $ProjectRoot

try {
    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Build falhou."
    }

    Write-Host "[OK] Build" -ForegroundColor Green

    & npm.cmd run lint

    if ($LASTEXITCODE -ne 0) {
        throw "Lint falhou."
    }

    Write-Host "[OK] Lint" -ForegroundColor Green
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "[OK] Backend Apps Script M06 validado." -ForegroundColor Green
