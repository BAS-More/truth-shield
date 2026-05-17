# Truth Shield installer for Windows
# Usage: irm https://raw.githubusercontent.com/BAS-More/truth-shield/master/install.ps1 | iex

$ErrorActionPreference = "Stop"

$skillDir = "$env:USERPROFILE\.claude\skills"
$skillFile = "$skillDir\truth-shield.md"
$repoUrl = "https://raw.githubusercontent.com/BAS-More/truth-shield/master/SKILL.md"

Write-Host ""
Write-Host "  Truth Shield Installer" -ForegroundColor Cyan
Write-Host "  ======================" -ForegroundColor Cyan
Write-Host ""

# Create skills directory if it doesn't exist
if (-not (Test-Path $skillDir)) {
    Write-Host "  Creating $skillDir ..."
    New-Item -ItemType Directory -Path $skillDir -Force | Out-Null
}

# Download or copy SKILL.md
if (Test-Path "SKILL.md") {
    Write-Host "  Installing from local SKILL.md ..."
    Copy-Item "SKILL.md" $skillFile -Force
} else {
    Write-Host "  Downloading from GitHub ..."
    Invoke-WebRequest -Uri $repoUrl -OutFile $skillFile -UseBasicParsing
}

Write-Host "  Installed to: $skillFile" -ForegroundColor Green
Write-Host ""
Write-Host "  Done! Open Claude Code and type:" -ForegroundColor Green
Write-Host ""
Write-Host "    verify this" -ForegroundColor Yellow
Write-Host ""
Write-Host "  after any response to fact-check it."
Write-Host ""
Write-Host "  Or type 'shield on' for continuous verification." -ForegroundColor Yellow
Write-Host ""
