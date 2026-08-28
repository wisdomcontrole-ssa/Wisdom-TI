#requires -Version 5.1
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$ProjectRoot = 'C:\Projetos\Inventario TI - Instancia 2\inventario-ti'
Set-Location $ProjectRoot

function Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

$Required = @(
    'public\_headers',
    'public\_redirects',
    'public\robots.txt',
    'src\components\system\ConnectivityBanner.tsx',
    'docs\M11_PRODUCTION.md',
    'scripts\VALIDAR_CLOUDFLARE_PROD.ps1'
)

foreach ($relative in $Required) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $relative))) {
        throw "Arquivo M11 ausente: $relative"
    }
}

$headers = Get-Content -Raw -Encoding UTF8 '.\public\_headers'

foreach ($needle in @(
    'Content-Security-Policy',
    'X-Frame-Options: DENY',
    'Permissions-Policy:',
    'X-Robots-Tag:',
    'yresuszqnakdxupewtsf.supabase.co'
)) {
    if (-not $headers.Contains($needle)) {
        throw "Header de producao ausente: $needle"
    }
}

Ok "Headers de seguranca"

$index = Get-Content -Raw -Encoding UTF8 '.\index.html'

if (-not $index.Contains('noindex,nofollow,noarchive,nosnippet')) {
    throw 'Meta robots de app interno ausente.'
}

Ok "Noindex"

Write-Host ""
Write-Host "==> Build frontend" -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    throw 'Build falhou.'
}
Ok "Build"

Write-Host ""
Write-Host "==> Lint" -ForegroundColor Cyan
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) {
    throw 'Lint falhou.'
}
Ok "Lint"

foreach ($relative in @(
    'dist\_headers',
    'dist\_redirects',
    'dist\robots.txt',
    'dist\manifest.webmanifest',
    'dist\sw.js'
)) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $relative))) {
        throw "Artefato de producao ausente: $relative"
    }
}

Ok "Artefatos Cloudflare/PWA no dist"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " INVENTARIO TI - M11 PRE-PRODUCAO VALIDADO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
