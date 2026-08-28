#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$AgentToken,

    [string]$ProjectUrl = 'https://yresuszqnakdxupewtsf.supabase.co'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Principal = New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent()
)

if (-not $Principal.IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)) {
    throw "Execute este instalador como Administrador."
}

if (-not $ProjectUrl.StartsWith('https://')) {
    throw "ProjectUrl precisa usar HTTPS."
}

if (-not $AgentToken.StartsWith('wti_')) {
    throw "AgentToken invalido."
}

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceExe = Join-Path $SourceDir 'WisdomTI.Agent.exe'

if (-not (Test-Path -LiteralPath $SourceExe -PathType Leaf)) {
    throw "WisdomTI.Agent.exe nao encontrado ao lado do instalador."
}

$Root = Join-Path $env:ProgramData 'WisdomTI\Agent'
$Exe = Join-Path $Root 'WisdomTI.Agent.exe'
$Config = Join-Path $Root 'agent.json'
$Logs = Join-Path $Root 'logs'

New-Item -ItemType Directory -Path $Root -Force | Out-Null
New-Item -ItemType Directory -Path $Logs -Force | Out-Null

Copy-Item -LiteralPath $SourceExe -Destination $Exe -Force

$configObject = @{
    project_url = $ProjectUrl.TrimEnd('/')
    agent_token = $AgentToken
}

$configJson = $configObject | ConvertTo-Json
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($Config, $configJson, $Utf8NoBom)

# Restrict ProgramData folder to SYSTEM and local Administrators by SID.
& icacls.exe $Root `
    /inheritance:r `
    /grant:r `
    '*S-1-5-18:(OI)(CI)F' `
    '*S-1-5-32-544:(OI)(CI)F' | Out-Null

if ($LASTEXITCODE -ne 0) {
    throw "Nao foi possivel aplicar ACL segura em $Root."
}

$TaskStartup = 'Wisdom TI Agent - Startup'
$TaskHeartbeat = 'Wisdom TI Agent - Heartbeat'
$TaskCommand = "`"$Exe`" --config `"$Config`""

# Excluir tarefa inexistente e um caso normal. Nao deve abortar a instalacao.
$PreviousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'

try {
    & schtasks.exe /Delete /TN $TaskStartup /F 2>$null | Out-Null
    & schtasks.exe /Delete /TN $TaskHeartbeat /F 2>$null | Out-Null
}
finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
}

# Criar tarefa no boot.
& schtasks.exe `
    /Create `
    /TN $TaskStartup `
    /TR $TaskCommand `
    /SC ONSTART `
    /RU SYSTEM `
    /RL HIGHEST `
    /F | Out-Null

if ($LASTEXITCODE -ne 0) {
    throw "Falha ao criar tarefa de startup."
}

# Criar heartbeat a cada 15 minutos.
& schtasks.exe `
    /Create `
    /TN $TaskHeartbeat `
    /TR $TaskCommand `
    /SC MINUTE `
    /MO 15 `
    /RU SYSTEM `
    /RL HIGHEST `
    /F | Out-Null

if ($LASTEXITCODE -ne 0) {
    throw "Falha ao criar tarefa de heartbeat."
}

# Token is no longer needed in the script process.
$AgentToken = $null

Write-Host ""
Write-Host "[OK] Wisdom TI Agent instalado." -ForegroundColor Green
Write-Host "Executavel: $Exe"
Write-Host "Config:     $Config"
Write-Host "Heartbeat:  a cada 15 minutos"
Write-Host ""

Write-Host "==> Executando primeira coleta" -ForegroundColor Cyan

& $Exe --config $Config
$firstExit = $LASTEXITCODE

if ($firstExit -ne 0) {
    Write-Host "[ATENCAO] Primeira coleta retornou codigo $firstExit." -ForegroundColor Yellow
    Write-Host "Consulte: $Logs\agent.log" -ForegroundColor Yellow
}
else {
    Write-Host "[OK] Primeira coleta enviada." -ForegroundColor Green
}
