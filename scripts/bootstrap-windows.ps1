# Bootstrap a new agentic-organization project on Windows: installs whatever's missing
# (git, Node, GitHub CLI, Claude Code), authenticates GitHub, creates a new
# repo from this template, clones it, and hands off to Claude.
#
# Run it directly, from a PowerShell window (right-click Start -> "Terminal"):
#   irm https://raw.githubusercontent.com/pyduan/agentic-organization/main/scripts/bootstrap-windows.ps1 | iex
# or clone the repo first and run .\scripts\bootstrap-windows.ps1
#
# Safe to re-run: every step checks whether it's already done before acting.

$ErrorActionPreference = "Stop"
$Template = "pyduan/agentic-organization"

Write-Host "== agentic-organization setup =="
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

# --- SSH key (a fallback; the HTTPS login above is the default path) ---
$KeyPath = Join-Path $HOME ".ssh\id_ed25519"
if (-not (Test-Path "$KeyPath.pub")) {
  Write-Host ""
  $MakeKey = Read-Host "Also create an SSH key for GitHub, as a fallback if HTTPS is ever blocked? [Y/n]"
  if ($MakeKey -ne "n" -and $MakeKey -ne "N") {
    New-Item -ItemType Directory -Force -Path (Split-Path $KeyPath) | Out-Null
    ssh-keygen -t ed25519 -N '""' -f $KeyPath -C "$env:COMPUTERNAME (agentic-organization setup)"
    try {
      gh ssh-key add "$KeyPath.pub" --title "$env:COMPUTERNAME (agentic-organization setup)"
      Write-Host "OK SSH key created and added to your GitHub account"
    } catch {
      Write-Host "!! Key created locally; adding it to GitHub needs a wider scope (gh auth refresh -s admin:public_key). Not urgent."
    }
  }
} else {
  Write-Host "OK SSH key already present"
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

# --- Hosting, and getting the agent able to deploy on its own ---
Write-Host ""
Write-Host "Where should the site be published?"
Write-Host "  1) A fresh Cloudflare account (default: free, and it holds domain + DNS + apps in one place)"
Write-Host "  2) Somewhere I already have (Vercel, Netlify, my own server, an existing Cloudflare account)"
$HostChoice = Read-Host "Choose 1 or 2 [1]"
if ([string]::IsNullOrWhiteSpace($HostChoice)) { $HostChoice = "1" }

$HostNote = "Cloudflare (fresh account)"
$CfLoggedIn = "no"
if ($HostChoice -eq "2") {
  $HostExisting = Read-Host "What are you using? (a name is enough)"
  if ([string]::IsNullOrWhiteSpace($HostExisting)) { $HostExisting = "unspecified" }
  $HostNote = "existing host: $HostExisting"
} else {
  Write-Host ""
  Write-Host "Installing the deploy tooling and logging into Cloudflare, so Claude can publish"
  Write-Host "without you clicking through a dashboard every time."
  try { npm install --silent | Out-Null } catch { Write-Host "!! npm install had trouble; Claude will sort it in the first session." }
  try { npx --yes wrangler whoami | Out-Null; $CfLoggedIn = "yes"; Write-Host "OK Already logged into Cloudflare" }
  catch {
    Write-Host "A browser window will open to authorize Cloudflare (Ctrl+C to skip and do it later):"
    try { npx --yes wrangler login; $CfLoggedIn = "yes" } catch { Write-Host "!! Skipped -- Claude can run 'npx wrangler login' with you later." }
  }
}

# Two things the Cloudflare CLI token cannot do, written down now rather than
# discovered mid-deploy: writing a DNS record, and creating an Access policy.
$SshPresent = if (Test-Path "$KeyPath.pub") { "yes" } else { "no" }
New-Item -ItemType Directory -Force -Path "source/inbox" | Out-Null
@"
# Answers from the bootstrap script

Written by scripts/bootstrap-windows.ps1 on $(Get-Date -Format yyyy-MM-dd). The setup skill should
read this, act on it, and delete the file (inbox protocol).

- Machine: Windows $([System.Environment]::OSVersion.Version)
- Project folder: $Target
- Hosting: $HostNote
- Cloudflare CLI logged in: $CfLoggedIn
- SSH key present: $SshPresent

Still needs a human in the Cloudflare dashboard (the CLI token cannot do these):
writing DNS records, and enabling Zero Trust / creating the Access policy that
protects the private dashboard. See docs/deploy-cloudflare.md.
"@ | Set-Content -Path "source/inbox/setup-answers.md" -Encoding UTF8
Write-Host "OK Wrote source/inbox/setup-answers.md for the first session"

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
