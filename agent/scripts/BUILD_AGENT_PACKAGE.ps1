#requires -Version 5.1
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$ProjectRoot = 'C:\Projetos\TI Wisdom\wisdom-ti'
$AgentProject = Join-Path $ProjectRoot 'agent\WisdomTI.Agent\WisdomTI.Agent.csproj'
$SetupProject = Join-Path $ProjectRoot 'agent\WisdomTI.Agent.Setup\WisdomTI.Agent.Setup.csproj'
$AgentScripts = Join-Path $ProjectRoot 'agent\scripts'

$BuildRoot = 'C:\Projetos\TI Wisdom\_builds\wisdom-ti-agent'
$PayloadDir = Join-Path $BuildRoot 'payload'
$SetupPublishDir = Join-Path $BuildRoot 'setup'
$FallbackDir = Join-Path $BuildRoot 'fallback'

$SetupExe = Join-Path $BuildRoot 'WisdomTI-Agent-Setup.exe'
$DownloadsSetupExe = Join-Path $env:USERPROFILE 'Downloads\WisdomTI-Agent-Setup.exe'
$FallbackZip = Join-Path $BuildRoot 'WisdomTI-Agent-Fallback-win-x64.zip'

function Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Fail([string]$Text) {
    Write-Host "[ERRO] $Text" -ForegroundColor Red
    throw $Text
}

if (-not (Get-Command dotnet.exe -ErrorAction SilentlyContinue)) {
    Fail '.NET SDK nao encontrado.'
}

$sdks = @(& dotnet.exe --list-sdks)
$dotnet10 = $sdks |
    Where-Object { $_ -match '^\s*10\.' } |
    Select-Object -First 1

if (-not $dotnet10) {
    Fail '.NET 10 SDK necessario.'
}

Ok ".NET 10 SDK confirmado: $dotnet10"

foreach ($required in @(
    $AgentProject,
    $SetupProject,
    (Join-Path $AgentScripts 'INSTALL_AGENT.ps1'),
    (Join-Path $AgentScripts 'UNINSTALL_AGENT.ps1')
)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        Fail "Arquivo ausente: $required"
    }
}

if (Test-Path -LiteralPath $BuildRoot) {
    Remove-Item -LiteralPath $BuildRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $PayloadDir -Force | Out-Null
New-Item -ItemType Directory -Path $SetupPublishDir -Force | Out-Null
New-Item -ItemType Directory -Path $FallbackDir -Force | Out-Null

Write-Host ""
Write-Host "==> 1. Publicando payload do agente" -ForegroundColor Cyan

& dotnet.exe publish $AgentProject `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    -o $PayloadDir

if ($LASTEXITCODE -ne 0) {
    Fail 'Publish do agente falhou.'
}

$PayloadExe = Join-Path $PayloadDir 'WisdomTI.Agent.exe'

if (-not (Test-Path -LiteralPath $PayloadExe -PathType Leaf)) {
    Fail 'Payload WisdomTI.Agent.exe nao foi gerado.'
}

Ok "Payload do agente"

Write-Host ""
Write-Host "==> 2. Gerando instalador grafico unico" -ForegroundColor Cyan

& dotnet.exe publish $SetupProject `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    "-p:AgentPayloadPath=$PayloadExe" `
    -o $SetupPublishDir

if ($LASTEXITCODE -ne 0) {
    Fail 'Publish do instalador grafico falhou.'
}

$PublishedSetup = Join-Path $SetupPublishDir 'WisdomTI.Agent.Setup.exe'

if (-not (Test-Path -LiteralPath $PublishedSetup -PathType Leaf)) {
    Fail 'WisdomTI.Agent.Setup.exe nao foi gerado.'
}

Copy-Item -LiteralPath $PublishedSetup -Destination $SetupExe -Force
Copy-Item -LiteralPath $PublishedSetup -Destination $DownloadsSetupExe -Force

Ok "WisdomTI-Agent-Setup.exe"

Write-Host ""
Write-Host "==> 3. Gerando pacote fallback para TI avancado" -ForegroundColor Cyan

Copy-Item -LiteralPath $PayloadExe -Destination (Join-Path $FallbackDir 'WisdomTI.Agent.exe') -Force
Copy-Item -LiteralPath (Join-Path $AgentScripts 'INSTALL_AGENT.ps1') -Destination (Join-Path $FallbackDir 'INSTALL_AGENT.ps1') -Force
Copy-Item -LiteralPath (Join-Path $AgentScripts 'UNINSTALL_AGENT.ps1') -Destination (Join-Path $FallbackDir 'UNINSTALL_AGENT.ps1') -Force

Compress-Archive `
    -Path (Join-Path $FallbackDir '*') `
    -DestinationPath $FallbackZip `
    -CompressionLevel Optimal `
    -Force

if (-not (Test-Path -LiteralPath $FallbackZip -PathType Leaf)) {
    Fail 'ZIP fallback nao foi gerado.'
}

Ok "Pacote fallback"

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $SetupExe).Hash
$sizeMb = (Get-Item -LiteralPath $SetupExe).Length / 1MB

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " WISDOM TI - INSTALADOR GRAFICO DO AGENTE PRONTO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Arquivo principal:" -ForegroundColor Cyan
Write-Host "  $SetupExe"
Write-Host ""
Write-Host "Copia em Downloads:" -ForegroundColor Cyan
Write-Host "  $DownloadsSetupExe"
Write-Host ""
Write-Host ("Tamanho: {0:N2} MB" -f $sizeMb)
Write-Host "SHA256: $hash"
Write-Host ""
Write-Host "Uso na maquina:" -ForegroundColor Cyan
Write-Host "  1. Dar dois cliques em WisdomTI-Agent-Setup.exe"
Write-Host "  2. Autorizar o UAC"
Write-Host "  3. Colar o token wti_..."
Write-Host "  4. Clicar Instalar"
Write-Host ""
Write-Host "PowerShell nao e necessario na maquina-alvo." -ForegroundColor Green
Write-Host ""
