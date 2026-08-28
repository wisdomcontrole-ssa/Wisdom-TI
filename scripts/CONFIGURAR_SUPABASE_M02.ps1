#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projetos\Inventario TI - Instancia 2\inventario-ti"
Set-Location $ProjectRoot

Write-Host ""
Write-Host "WISDOM TI - CONFIGURAR SUPABASE" -ForegroundColor Cyan
Write-Host ""

$url = Read-Host "Cole o Project URL do Supabase"
$key = Read-Host "Cole a Publishable key do Supabase"

if (-not $url.StartsWith("https://")) { throw "Project URL inválido." }
if ([string]::IsNullOrWhiteSpace($key)) { throw "Publishable key vazia." }

$content = @"
VITE_SUPABASE_URL=$($url.Trim())
VITE_SUPABASE_PUBLISHABLE_KEY=$($key.Trim())
"@

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $ProjectRoot ".env.local"), $content, $utf8)

Write-Host ""
Write-Host "[OK] .env.local criado." -ForegroundColor Green
Write-Host "Não envie essas credenciais pelo chat." -ForegroundColor Yellow
Write-Host ""
Write-Host 'Reinicie usando C:\Projetos\TI Wisdom\INICIAR_WISDOM_TI.cmd' -ForegroundColor Cyan
