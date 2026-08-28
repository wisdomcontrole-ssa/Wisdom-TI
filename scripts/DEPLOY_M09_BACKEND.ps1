#requires -Version 5.1
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$ProjectRoot = 'C:\Projetos\Inventario TI - Instancia 2\inventario-ti'
$ProjectRef = 'yresuszqnakdxupewtsf'

Set-Location $ProjectRoot

function Run-Deploy(
    [string]$FunctionName,
    [switch]$NoVerifyJwt
) {
    Write-Host ''
    Write-Host "==> Deploy $FunctionName" -ForegroundColor Cyan

    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    try {
        if ($NoVerifyJwt) {
            & npx.cmd supabase functions deploy $FunctionName `
                --project-ref $ProjectRef `
                --use-api `
                --no-verify-jwt
        }
        else {
            & npx.cmd supabase functions deploy $FunctionName `
                --project-ref $ProjectRef `
                --use-api
        }

        $exit = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $old
    }

    if ($exit -ne 0) {
        throw "Deploy $FunctionName falhou."
    }

    Write-Host "[OK] $FunctionName publicada" -ForegroundColor Green
}

Write-Host ''
Write-Host 'WISDOM TI - DEPLOY M09 BACKEND' -ForegroundColor Cyan
Write-Host "Project Ref: $ProjectRef" -ForegroundColor Yellow
Write-Host ''
Write-Host 'PRE-REQUISITO: M09_SUPABASE.sql aplicado no SQL Editor.' -ForegroundColor Yellow

Run-Deploy -FunctionName 'agent-admin'
Run-Deploy -FunctionName 'agent-ingest' -NoVerifyJwt

Write-Host ''
Write-Host '[OK] Backend M09 publicado.' -ForegroundColor Green
Write-Host ''
