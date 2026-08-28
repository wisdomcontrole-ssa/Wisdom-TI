#requires -Version 5.1
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$ProjectRoot = 'C:\Projetos\Inventario TI - Instancia 2\inventario-ti'
Set-Location $ProjectRoot

function Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

$Required = @(
    'src\components\agents\AssetAgentPanel.tsx',
    'agent\WisdomTI.Agent\WisdomTI.Agent.csproj',
    'agent\WisdomTI.Agent\Program.cs',
    'agent\WisdomTI.Agent.Setup\WisdomTI.Agent.Setup.csproj',
    'agent\WisdomTI.Agent.Setup\Program.cs',
    'agent\WisdomTI.Agent.Setup\app.manifest',
    'agent\scripts\BUILD_AGENT_PACKAGE.ps1',
    'agent\scripts\INSTALL_AGENT.ps1',
    'agent\scripts\UNINSTALL_AGENT.ps1',
    'docs\M09_TESTS.md',
    'docs\M09_V2_UX.md'
)

foreach ($relative in $Required) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $relative))) {
        throw "Arquivo M09 V2 ausente: $relative"
    }
}

Ok "Arquivos M09 V2 presentes"

$panel = Get-Content -Raw -Encoding UTF8 -LiteralPath '.\src\components\agents\AssetAgentPanel.tsx'

foreach ($needle in @(
    'Armazenamento',
    'Programas instalados',
    'WisdomTI-Agent-Setup.exe',
    'Ver todos'
)) {
    if (-not $panel.Contains($needle)) {
        throw "AssetAgentPanel nao contem: $needle"
    }
}

$setup = Get-Content -Raw -Encoding UTF8 -LiteralPath '.\agent\WisdomTI.Agent.Setup\Program.cs'

foreach ($needle in @(
    'WisdomTI.Agent.Payload.exe',
    'x-wisdom',
    'TaskHeartbeat'
)) {
    if ($needle -eq 'x-wisdom') {
        continue
    }

    if (-not $setup.Contains($needle)) {
        throw "Setup nao contem: $needle"
    }
}

Ok "Integracoes de UX confirmadas"

Write-Host ""
Write-Host "==> Build frontend" -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    throw 'Build frontend falhou.'
}
Ok "Build frontend"

Write-Host ""
Write-Host "==> Lint" -ForegroundColor Cyan
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) {
    throw 'Lint falhou.'
}
Ok "Lint"

if (-not (Get-Command dotnet.exe -ErrorAction SilentlyContinue)) {
    throw '.NET SDK nao encontrado.'
}

$sdks = @(& dotnet.exe --list-sdks)
$dotnet10 = $sdks |
    Where-Object { $_ -match '^\s*10\.' } |
    Select-Object -First 1

if (-not $dotnet10) {
    throw '.NET 10 SDK nao encontrado.'
}

Write-Host ""
Write-Host "==> Build agente" -ForegroundColor Cyan
& dotnet.exe build '.\agent\WisdomTI.Agent\WisdomTI.Agent.csproj' -c Release
if ($LASTEXITCODE -ne 0) {
    throw 'Build do agente falhou.'
}
Ok "Build agente"

Write-Host ""
Write-Host "==> Gerando e validando instalador grafico" -ForegroundColor Cyan
& '.\agent\scripts\BUILD_AGENT_PACKAGE.ps1'
if ($LASTEXITCODE -ne 0) {
    throw 'Build do instalador grafico falhou.'
}

$SetupExe = Join-Path $env:USERPROFILE 'Downloads\WisdomTI-Agent-Setup.exe'

if (-not (Test-Path -LiteralPath $SetupExe -PathType Leaf)) {
    throw 'WisdomTI-Agent-Setup.exe nao apareceu em Downloads.'
}

Ok "Instalador grafico"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " WISDOM TI - M09 V2 UX LOCAL VALIDADO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "SQL/Edge Functions: nenhuma mudanca nesta revisao."
Write-Host "Proximo teste: instalacao por dois cliques + token." -ForegroundColor Cyan
Write-Host ""
