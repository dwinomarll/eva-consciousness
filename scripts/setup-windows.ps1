#Requires -Version 5.1
<#
.SYNOPSIS
  Eva Consciousness — Windows Setup
.DESCRIPTION
  Installs Node.js, Python, git, opencode, Claude Code,
  and sets up the eva-consciousness CLI via winget + npm.
.NOTES
  Run from PowerShell as Administrator:
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  .\setup-windows.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Eva Consciousness — Windows Setup   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

function Has-Command($cmd) {
  return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ── winget check ──────────────────────────────────────────────────
if (-not (Has-Command winget)) {
  Write-Host "ERROR: winget not found. Install App Installer from the Microsoft Store." -ForegroundColor Red
  exit 1
}

# ── git ───────────────────────────────────────────────────────────
if (-not (Has-Command git)) {
  Write-Host "▶ Installing git..." -ForegroundColor Yellow
  winget install --id Git.Git -e --source winget --silent
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
} else {
  Write-Host "✓ git already installed" -ForegroundColor Green
}

# ── Node.js ───────────────────────────────────────────────────────
if (-not (Has-Command node)) {
  Write-Host "▶ Installing Node.js..." -ForegroundColor Yellow
  winget install --id OpenJS.NodeJS.LTS -e --source winget --silent
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
} else {
  Write-Host "✓ Node.js $(node --version) already installed" -ForegroundColor Green
}

# ── Python ────────────────────────────────────────────────────────
if (-not (Has-Command python)) {
  Write-Host "▶ Installing Python..." -ForegroundColor Yellow
  winget install --id Python.Python.3.12 -e --source winget --silent
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
} else {
  Write-Host "✓ Python $(python --version) already installed" -ForegroundColor Green
}

# ── uv ────────────────────────────────────────────────────────────
if (-not (Has-Command uv)) {
  Write-Host "▶ Installing uv..." -ForegroundColor Yellow
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
} else {
  Write-Host "✓ uv already installed" -ForegroundColor Green
}

# ── opencode ──────────────────────────────────────────────────────
if (-not (Has-Command opencode)) {
  Write-Host "▶ Installing opencode..." -ForegroundColor Yellow
  npm install -g opencode-ai
} else {
  Write-Host "✓ opencode already installed" -ForegroundColor Green
}

# ── Claude Code ───────────────────────────────────────────────────
if (-not (Has-Command claude)) {
  Write-Host "▶ Installing Claude Code..." -ForegroundColor Yellow
  npm install -g @anthropic-ai/claude-code
} else {
  Write-Host "✓ Claude Code already installed" -ForegroundColor Green
}

# ── Clone eva-consciousness ───────────────────────────────────────
$RepoDir = "$HOME\eva-consciousness"
if (-not (Test-Path $RepoDir)) {
  Write-Host "▶ Cloning eva-consciousness..." -ForegroundColor Yellow
  git clone https://github.com/dwinomarll/eva-consciousness.git $RepoDir
} else {
  Write-Host "✓ eva-consciousness already at $RepoDir" -ForegroundColor Green
}

# ── Build and link CLI ────────────────────────────────────────────
Write-Host "▶ Building CLI..." -ForegroundColor Yellow
Set-Location $RepoDir
npm install
npm run build
npm link

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Setup complete!                     ║" -ForegroundColor Cyan
Write-Host "║                                      ║" -ForegroundColor Cyan
Write-Host "║  Run: eva-consciousness spawn        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
