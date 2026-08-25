#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projetos\TI Wisdom\wisdom-ti"

if (-not (Test-Path $ProjectRoot)) {
    throw "Projeto nao encontrado: $ProjectRoot"
}

$Required = @(
    "supabase\functions\_shared\http.ts",
    "supabase\functions\_shared\supabase.ts",
    "supabase\functions\_shared\permissions.ts",
    "supabase\functions\_shared\context.ts",
    "supabase\functions\_shared\drive.ts",
    "supabase\functions\_shared\evidence.ts",
    "supabase\functions\drive-health\index.ts",
    "supabase\functions\evidence-upload\index.ts",
    "supabase\functions\evidence-file\index.ts",
    "supabase\functions\evidence-revoke\index.ts",
    "supabase\functions\.env.example"
)

foreach ($Relative in $Required) {
    $Path = Join-Path $ProjectRoot $Relative

    if (-not (Test-Path $Path)) {
        throw "Arquivo M06 ausente: $Relative"
    }
}

$LeakPatterns = @(
    "-----BEGIN PRIVATE KEY-----",
    "sb_secret_",
    "service_role="
)

$FilesToScan = Get-ChildItem `
    (Join-Path $ProjectRoot "supabase\functions") `
    -Recurse `
    -File

foreach ($File in $FilesToScan) {
    $Text = Get-Content -Raw -Encoding UTF8 $File.FullName

    foreach ($Pattern in $LeakPatterns) {
        if ($Text.Contains($Pattern)) {
            throw "Possivel segredo real encontrado em $($File.FullName): $Pattern"
        }
    }
}

Push-Location $ProjectRoot

try {
    Write-Host "==> Build" -ForegroundColor Cyan
    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Build falhou."
    }

    Write-Host "[OK] Build" -ForegroundColor Green

    Write-Host "==> Lint" -ForegroundColor Cyan
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
Write-Host "[OK] Backend local M06 validado." -ForegroundColor Green
