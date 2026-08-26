#requires -Version 5.1
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Principal = New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent()
)

if (-not $Principal.IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)) {
    throw 'Execute como Administrador.'
}

$Root = Join-Path $env:ProgramData 'WisdomTI\Agent'

foreach ($task in @(
    'Wisdom TI Agent - Startup',
    'Wisdom TI Agent - Heartbeat'
)) {
    & schtasks.exe /Delete /TN $task /F 2>$null | Out-Null
}

if (Test-Path -LiteralPath $Root) {
    Remove-Item -LiteralPath $Root -Recurse -Force
}

Write-Host '[OK] Wisdom TI Agent removido deste Windows.' -ForegroundColor Green
