# Truth Shield v3 installer for Windows
# Usage: irm https://raw.githubusercontent.com/BAS-More/truth-shield/master/install.ps1 | iex

$ErrorActionPreference = "Stop"

$skillDir = "$env:USERPROFILE\.claude\skills"
$skillFile = "$skillDir\truth-shield.md"
$hookDir = "$env:USERPROFILE\.claude\hooks"
$hookFile = "$hookDir\truth-shield-enforcer.js"
$repoUrl = "https://raw.githubusercontent.com/BAS-More/truth-shield/master"

Write-Host ""
Write-Host "  Truth Shield v3 Installer" -ForegroundColor Cyan
Write-Host "  =========================" -ForegroundColor Cyan
Write-Host ""

# Create skills directory if it doesn't exist
if (-not (Test-Path $skillDir)) {
    Write-Host "  Creating $skillDir ..."
    New-Item -ItemType Directory -Path $skillDir -Force | Out-Null
}

# Download or copy SKILL.md
if (Test-Path "SKILL.md") {
    Write-Host "  Installing skill from local SKILL.md ..."
    Copy-Item "SKILL.md" $skillFile -Force
} else {
    Write-Host "  Downloading skill from GitHub ..."
    Invoke-WebRequest -Uri "$repoUrl/SKILL.md" -OutFile $skillFile -UseBasicParsing
}

Write-Host "  Skill installed to: $skillFile" -ForegroundColor Green

# Optional: install enforcement hook
Write-Host ""
Write-Host "  Optional: enforcement hook (ensures verification in shield-on mode)" -ForegroundColor Yellow

$installHook = $env:TRUTH_SHIELD_HOOK
if (-not $installHook) {
    try {
        $response = Read-Host "  Install hook? [Y/n]"
        if ($response -ne "n" -and $response -ne "N") {
            $installHook = "yes"
        } else {
            $installHook = "no"
        }
    } catch {
        # Non-interactive — skip
        $installHook = "no"
        Write-Host "  Skipping hook (non-interactive). Set TRUTH_SHIELD_HOOK=yes to install."
    }
}

if ($installHook -eq "yes") {
    if (-not (Test-Path $hookDir)) {
        New-Item -ItemType Directory -Path $hookDir -Force | Out-Null
    }
    if (Test-Path "hooks\truth-shield-enforcer.js") {
        Copy-Item "hooks\truth-shield-enforcer.js" $hookFile -Force
    } else {
        Invoke-WebRequest -Uri "$repoUrl/hooks/truth-shield-enforcer.js" -OutFile $hookFile -UseBasicParsing
    }
    Write-Host "  Hook installed to: $hookFile" -ForegroundColor Green
    Write-Host "  NOTE: Add the hook to ~/.claude/hooks.json — see ENHANCE.md for config." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Done! Open Claude Code and type:" -ForegroundColor Green
Write-Host ""
Write-Host "    verify this" -ForegroundColor Yellow
Write-Host ""
Write-Host "  after any response to fact-check it."
Write-Host ""
Write-Host "  Or type 'shield on' for continuous verification." -ForegroundColor Yellow
Write-Host ""
