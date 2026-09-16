#requires -Version 5.1
param(
    [string]$ProjectRoot = "C:\Projetos\TI Wisdom\wisdom-ti"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Step([string]$Text) {
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Fail([string]$Text) {
    throw $Text
}

function Read-DotEnvValue(
    [string[]]$Files,
    [string]$Name
) {
    foreach ($File in $Files) {
        if (-not (Test-Path $File)) {
            continue
        }

        foreach ($Line in Get-Content $File) {
            $Trimmed = $Line.Trim()

            if (
                -not $Trimmed -or
                $Trimmed.StartsWith("#") -or
                -not $Trimmed.StartsWith("$Name=")
            ) {
                continue
            }

            $Value = $Trimmed.Substring(
                $Name.Length + 1
            ).Trim()

            if (
                ($Value.StartsWith('"') -and $Value.EndsWith('"')) -or
                ($Value.StartsWith("'") -and $Value.EndsWith("'"))
            ) {
                $Value = $Value.Substring(
                    1,
                    $Value.Length - 2
                )
            }

            return $Value
        }
    }

    return $null
}

if (-not (Test-Path $ProjectRoot)) {
    Fail "Projeto nao encontrado: $ProjectRoot"
}

Set-Location $ProjectRoot

if (-not (Get-Command dotnet.exe -ErrorAction SilentlyContinue)) {
    Fail ".NET SDK nao encontrado."
}

$Sdk = @(& dotnet.exe --list-sdks) |
    Where-Object { $_ -match '^\s*10\.' } |
    Select-Object -First 1

if (-not $Sdk) {
    Fail ".NET 10 SDK necessario para compilar o agente."
}

Ok ".NET 10: $Sdk"

$EnvFiles = @(
    (Join-Path $ProjectRoot ".env.local"),
    (Join-Path $ProjectRoot ".env")
)

$ProjectUrl = Read-DotEnvValue `
    $EnvFiles `
    "VITE_SUPABASE_URL"

$PublishableKey = Read-DotEnvValue `
    $EnvFiles `
    "VITE_SUPABASE_PUBLISHABLE_KEY"

if (
    [string]::IsNullOrWhiteSpace($ProjectUrl) -or
    $ProjectUrl -notmatch '^https://[a-z0-9-]+\.supabase\.co/?$'
) {
    Fail "VITE_SUPABASE_URL ausente ou invalida em .env.local/.env."
}

if (
    [string]::IsNullOrWhiteSpace($PublishableKey) -or
    $PublishableKey.Length -lt 20
) {
    Fail "VITE_SUPABASE_PUBLISHABLE_KEY ausente ou invalida em .env.local/.env."
}

$AgentProject = Join-Path $ProjectRoot "agent\InventarioTI.Agent\InventarioTI.Agent.csproj"
$BuildRoot = Join-Path $ProjectRoot ".build\agent-v201"
$PublishDir = Join-Path $BuildRoot "publish"
$TempConfig = Join-Path $BuildRoot "instance-config.json"
$DownloadsExe = Join-Path $env:USERPROFILE "Downloads\InventarioTI-Agent-Setup.exe"
$PublicDir = Join-Path $ProjectRoot "public\downloads"
$PublicExe = Join-Path $PublicDir "InventarioTI-Agent-Setup.exe"

if (Test-Path $BuildRoot) {
    Remove-Item $BuildRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $PublishDir -Force | Out-Null
New-Item -ItemType Directory -Path $PublicDir -Force | Out-Null

$InstanceConfig = @{
    project_url = $ProjectUrl.TrimEnd("/")
    publishable_key = $PublishableKey
} | ConvertTo-Json -Compress

[System.IO.File]::WriteAllText(
    $TempConfig,
    $InstanceConfig,
    [System.Text.UTF8Encoding]::new($false)
)

try {
    Step "Compilando Inventário TI Agent 2.0.1"

    & dotnet.exe publish $AgentProject `
        -c Release `
        -r win-x64 `
        --self-contained true `
        -p:PublishSingleFile=true `
        -p:PublishTrimmed=true `
        -p:TrimMode=partial `
        -p:EnableCompressionInSingleFile=true `
        -p:DebugType=None `
        -p:DebugSymbols=false `
        "-p:InstanceConfigPath=$TempConfig" `
        -o $PublishDir

    if ($LASTEXITCODE -ne 0) {
        Fail "Publish do agente falhou."
    }

    $PublishedExe = Join-Path $PublishDir "InventarioTI.Agent.exe"

    if (-not (Test-Path $PublishedExe)) {
        Fail "InventarioTI.Agent.exe nao foi gerado."
    }

    $SizeBytes = (Get-Item $PublishedExe).Length
    $SizeMiB = $SizeBytes / 1MB
    $CloudflareLimit = 25MB

    Copy-Item $PublishedExe $DownloadsExe -Force

    Write-Host ""
    Write-Host ("Tamanho do instalador: {0:N2} MiB" -f $SizeMiB) -ForegroundColor Yellow

    if ($SizeBytes -ge $CloudflareLimit) {
        Remove-Item $PublicExe -Force -ErrorAction SilentlyContinue

        Fail (
            "O instalador foi gerado em Downloads, mas possui " +
            ("{0:N2} MiB" -f $SizeMiB) +
            " e excede o limite de 25 MiB do Cloudflare Pages. " +
            "Nao publique ainda."
        )
    }

    Copy-Item $PublishedExe $PublicExe -Force

    $Hash = (
        Get-FileHash `
            -Algorithm SHA256 `
            -Path $PublishedExe
    ).Hash

    Ok "Instalador pronto para ser servido pelo proprio sistema"
    Write-Host "SHA256: $Hash"
    Write-Host "Downloads: $DownloadsExe"
    Write-Host "App:       $PublicExe"
}
finally {
    Remove-Item $TempConfig -Force -ErrorAction SilentlyContinue
}
