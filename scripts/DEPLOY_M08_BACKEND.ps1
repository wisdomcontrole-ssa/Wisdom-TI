#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projetos\Inventario TI - Instancia 2\inventario-ti"
Set-Location $ProjectRoot

Write-Host ""
Write-Host "WISDOM TI - DEPLOY M08 BACKEND" -ForegroundColor Cyan
Write-Host ""
Write-Host "PRE-REQUISITO: M08_SUPABASE.sql ja deve ter sido executado no Supabase SQL Editor." -ForegroundColor Yellow
Write-Host ""

$FunctionPath = Join-Path $ProjectRoot "supabase\functions\admin-users\index.ts"
if (-not (Test-Path -LiteralPath $FunctionPath)) {
    throw "Edge Function admin-users ausente."
}

$Npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
if (-not $Npx) {
    throw "npx.cmd nao encontrado. Node/npm precisam estar instalados."
}

Write-Host "==> Verificando Supabase CLI" -ForegroundColor Cyan
& npx.cmd supabase --version
if ($LASTEXITCODE -ne 0) {
    throw "Supabase CLI indisponivel. Autentique/instale antes de continuar."
}

Write-Host ""
Write-Host "==> Publicando admin-users" -ForegroundColor Cyan
& npx.cmd supabase functions deploy admin-users
if ($LASTEXITCODE -ne 0) {
    throw "Deploy da Edge Function admin-users falhou."
}

Write-Host ""
Write-Host "[OK] Edge Function admin-users publicada." -ForegroundColor Green
Write-Host ""
Write-Host "Agora execute os testes de docs\M08_TESTS.md." -ForegroundColor Cyan
