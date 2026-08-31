#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Instancia 1 = GitHub wisdomcontrole-ssa / Supabase dqfbzsneaamihfphjfcj" -ForegroundColor Cyan
Write-Host "Instancia 2 = GitHub juliocpsprof-afk / Supabase yresuszqnakdxupewtsf" -ForegroundColor Cyan

if ((git status --porcelain).Count -gt 0) {
    throw "Working tree precisa estar limpa antes da publicacao."
}

npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Build falhou." }

npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw "Lint falhou." }

git diff --check
if ($LASTEXITCODE -ne 0) { throw "git diff --check falhou." }

$Sha = (git rev-parse HEAD).Trim()
Write-Host "SHA a publicar: $Sha" -ForegroundColor Yellow

git push --dry-run instancia1 HEAD:main
if ($LASTEXITCODE -ne 0) { throw "Dry-run GitHub Instancia 1 falhou." }

git push --dry-run instancia2 HEAD:main
if ($LASTEXITCODE -ne 0) { throw "Dry-run GitHub Instancia 2 falhou." }

Write-Host ""
Write-Host "ATENCAO: este publicador pressupoe que migrations/Edge Functions da etapa ja foram aplicadas aos DOIS Supabases." -ForegroundColor Yellow
$Confirm = Read-Host "Digite PUBLICAR para enviar o mesmo SHA aos dois GitHubs"
if ($Confirm -ne "PUBLICAR") { throw "Publicacao cancelada." }

git push instancia1 HEAD:main
if ($LASTEXITCODE -ne 0) { throw "Push Instancia 1 falhou." }

git push instancia2 HEAD:main
if ($LASTEXITCODE -ne 0) { throw "Push Instancia 2 falhou." }

git fetch instancia1 main --prune
git fetch instancia2 main --prune

$I1 = (git rev-parse instancia1/main).Trim()
$I2 = (git rev-parse instancia2/main).Trim()

if ($I1 -ne $Sha -or $I2 -ne $Sha) {
    throw "Divergencia apos push. Local=$Sha I1=$I1 I2=$I2"
}

Write-Host "DUAS INSTANCIAS OK - MESMO SHA: $Sha" -ForegroundColor Green