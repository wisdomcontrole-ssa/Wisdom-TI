#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$BaseUrl = $BaseUrl.TrimEnd('/')

if (-not $BaseUrl.StartsWith('https://')) {
    throw 'BaseUrl precisa usar HTTPS.'
}

function Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host " INVENTARIO TI - SMOKE TEST CLOUDFLARE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host ""

$paths = @(
    '/',
    '/login',
    '/dashboard',
    '/patrimonio',
    '/relatorios'
)

foreach ($path in $paths) {
    $response = Invoke-WebRequest `
        -Uri ($BaseUrl + $path) `
        -UseBasicParsing `
        -MaximumRedirection 5

    if ($response.StatusCode -ne 200) {
        throw "$path retornou HTTP $($response.StatusCode)."
    }

    Ok "$path -> HTTP 200"
}

$root = Invoke-WebRequest `
    -Uri ($BaseUrl + '/') `
    -UseBasicParsing

$requiredHeaders = @(
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'X-Robots-Tag',
    'Content-Security-Policy'
)

foreach ($name in $requiredHeaders) {
    $value = $root.Headers[$name]

    if ([string]::IsNullOrWhiteSpace([string]$value)) {
        throw "Header ausente em producao: $name"
    }

    Ok "$name"
}

$manifest = Invoke-WebRequest `
    -Uri ($BaseUrl + '/manifest.webmanifest') `
    -UseBasicParsing

if ($manifest.StatusCode -ne 200) {
    throw 'Manifest PWA indisponivel.'
}

Ok "Manifest PWA"

$sw = Invoke-WebRequest `
    -Uri ($BaseUrl + '/sw.js') `
    -UseBasicParsing

if ($sw.StatusCode -ne 200) {
    throw 'Service Worker indisponivel.'
}

Ok "Service Worker"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " INVENTARIO TI - CLOUDFLARE SMOKE TEST OK" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
