# Bootstrap a new agentic-org project on Windows: installs whatever's missing
# (git, Node, GitHub CLI, Claude Code), authenticates GitHub, creates a new
# repo from this template, clones it, and hands off to Claude.
#
# Run it directly, from a PowerShell window (right-click Start -> "Terminal"):
#   irm https://raw.githubusercontent.com/pyduan/agentic-org/main/scripts/bootstrap-windows.ps1 | iex
# or clone the repo first and run .\scripts\bootstrap-windows.ps1
#
# Safe to re-run: every step checks whether it's already done before acting.

$ErrorActionPreference = "Stop"
$Template = "pyduan/agentic-org"

Write-Host "== agentic-org setup =="
Write-Host ""

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

# --- winget (ships with modern Windows 10/11) ---
if (-not (Test-Command "winget")) {
  Write-Host "winget (the Windows package manager) wasn't found. Please update"
  Write-Host "from the Microsoft Store ('App Installer'), then re-run this script."
  exit 1
}

# --- git ---
if (-not (Test-Command "git")) {
  Write-Host "Installing git..."
  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
} else {
  Write-Host "OK git found"
}

# --- Node.js ---
if (-not (Test-Command "node")) {
  Write-Host "Installing Node.js..."
  winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
} else {
  Write-Host "OK Node found ($(node --version))"
}

# --- GitHub CLI ---
if (-not (Test-Command "gh")) {
  Write-Host "Installing the GitHub CLI..."
  winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
} else {
  Write-Host "OK GitHub CLI found"
}

Write-Host ""
Write-Host "If git/Node/gh were just installed, close this window and reopen a"
Write-Host "fresh terminal so your PATH picks them up, then run this script again."
Write-Host ""

# --- Claude Code ---
if (-not (Test-Command "claude")) {
  Write-Host "Claude Code isn't installed yet. The easiest path is the desktop app:"
  Write-Host "  https://claude.com/claude-code"
  Write-Host "Download it, sign in, then come back to this terminal."
  Read-Host "Press Enter once Claude Code is installed to continue (or Ctrl+C to stop here)"
} else {
  Write-Host "OK Claude Code found"
}

# --- GitHub auth (HTTPS + browser login, no SSH key needed) ---
Write-Host ""
$authed = $false
try { gh auth status | Out-Null; $authed = $true } catch { $authed = $false }
if (-not $authed) {
  Write-Host "Log into GitHub (a browser window will open):"
  gh auth login --hostname github.com --git-protocol https --web
} else {
  Write-Host "OK Already logged into GitHub"
}

# --- Where to put the project ---
Write-Host ""
$ProjectName = Read-Host "What should we call your project? (e.g. mariana-site)"
while ([string]::IsNullOrWhiteSpace($ProjectName)) {
  $ProjectName = Read-Host "Please enter a name"
}

$DefaultDir = Join-Path $HOME "Projects"
New-Item -ItemType Directory -Force -Path $DefaultDir | Out-Null
$ParentDir = Read-Host "Where should it live on your computer? [$DefaultDir]"
if ([string]::IsNullOrWhiteSpace($ParentDir)) { $ParentDir = $DefaultDir }
New-Item -ItemType Directory -Force -Path $ParentDir | Out-Null
$Target = Join-Path $ParentDir $ProjectName

if (Test-Path $Target) {
  Write-Host "$Target already exists -- using it as-is (skipping repo creation)."
  Set-Location $Target
} else {
  Write-Host ""
  Write-Host "Creating your own private copy of the template on GitHub, and cloning it to:"
  Write-Host "  $Target"
  Set-Location $ParentDir
  gh repo create $ProjectName --template $Template --private --clone --description "My site, run by Claude"
  Set-Location $ProjectName
}

Write-Host ""
Write-Host "== Done. Your project is at: $Target =="
Write-Host ""
if (Test-Command "claude") {
  Write-Host "Launching Claude Code -- once it opens, just say: `"set up my site`""
  Write-Host ""
  claude
} else {
  Write-Host "Open the Claude Code desktop app and open this folder, then say: `"set up my site`""
}
