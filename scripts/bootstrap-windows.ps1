# Bootstrap a new agentic-organization project on Windows: installs whatever's missing
# (git, Node, GitHub CLI, Claude Code), authenticates GitHub, creates a new
# repo from this template, clones it, gives the parent folder the repo's guards,
# and opens Claude on the first step of the setup: the STACK.md walk.
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
} elseif (-not ([version]((node --version).TrimStart('v')) -ge [version]'22.12.0')) {
  Write-Host "Node $(node --version) is too old (the sites need 22.12 or later). Updating..."
  winget upgrade --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
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

# --- GitHub auth: SSH key, created and uploaded by gh (Paul, 2026-09-03) ---
# The agent is the owner's go-between with GitHub, so nothing may ever ask the owner to log in
# again: an SSH key on the account does that, on Windows as on Mac (OpenSSH ships with Windows 10+).
Write-Host ""
$authed = $false
try { gh auth status | Out-Null; $authed = $true } catch { $authed = $false }
if (-not $authed) {
  Write-Host "Log into GitHub (a browser window will open):"
  gh auth login --hostname github.com --git-protocol ssh --web
} else {
  Write-Host "OK Already logged into GitHub"
}

# --- SSH key: make sure one exists and is on the account ---
$KeyPath = Join-Path $HOME ".ssh\id_ed25519"
if (-not (Test-Path "$KeyPath.pub")) {
  Write-Host ""
  Write-Host "Creating the SSH key your agent will use to talk to GitHub for you (no passphrase, on purpose):"
  if ($true) {
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
$ProjectName = Read-Host "What should we call your repository? (e.g. riverside-coop)"
while ([string]::IsNullOrWhiteSpace($ProjectName)) {
  $ProjectName = Read-Host "Please enter a name"
}

$DefaultDir = Join-Path $HOME "Projects"
New-Item -ItemType Directory -Force -Path $DefaultDir | Out-Null
$ParentDir = Read-Host "Where should it live on your computer? [$DefaultDir]"
if ([string]::IsNullOrWhiteSpace($ParentDir)) { $ParentDir = $DefaultDir }
New-Item -ItemType Directory -Force -Path $ParentDir | Out-Null
$Target = Join-Path $ParentDir $ProjectName

if ((Test-Path $Target) -and (Get-ChildItem -Force $Target | Select-Object -First 1)) {
  # Reusing a folder that is already there is how a half-finished earlier attempt
  # becomes the project: its stale files look like yours and nothing says otherwise.
  # Offer a clean start, and rename the old one aside rather than deleting it.
  Write-Host ""
  Write-Host "$Target already exists and is not empty."
  $CleanStart = Read-Host "Start clean and move the existing folder aside? [Y/n]"
  if ($CleanStart -ne "n" -and $CleanStart -ne "N") {
    $Aside = "$Target.before-$(Get-Date -Format yyyy-MM-dd-HHmm)"
    Move-Item $Target $Aside
    Write-Host "OK moved aside to $Aside (nothing deleted)"
    Set-Location $ParentDir
    gh repo create $ProjectName --template $Template --private --clone --description "Our organization, run from one repository"
    Set-Location $ProjectName
  } else {
    Write-Host "Using it as-is (skipping repo creation)."
    Set-Location $Target
  }
} elseif (Test-Path $Target) {
  Set-Location $Target
} else {
  Write-Host ""
  Write-Host "Creating your own private copy of the template on GitHub, and cloning it to:"
  Write-Host "  $Target"
  Set-Location $ParentDir
  gh repo create $ProjectName --template $Template --private --clone --description "Our organization, run from one repository"
  Set-Location $ProjectName
}

# --- Hosting, and getting the agent able to deploy on its own ---
Write-Host ""
Write-Host "Where should your intranet and your site be published? (Your agent goes over this"
Write-Host "again with you in the first session, as rows of STACK.md you approve one at a time.)"
Write-Host "  1) A fresh Cloudflare account in the organization's name (default: free, and it holds"
Write-Host "     the private intranet behind a sign-in, the site, the domain and DNS in one place)"
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

# --- Anything else instructing this agent ---
# The kit's whole premise is one source of truth. A user-level CLAUDE.md, plugins and
# skills installed for an earlier experiment, globally declared MCP servers and
# forgotten scheduled tasks all load on every session and contradict quietly, and the
# owner cannot see any of it. Look now, while there is a person here to decide;
# nothing is ever deleted, only moved aside.
Write-Host ""
$Conflicts = (node "scripts/check-conflicts.mjs" 2>&1 | Out-String)
Write-Host $Conflicts
if ($Conflicts -match [char]0x25B8) {
  $Park = Read-Host "Move the marked ones aside (reversible, nothing deleted)? [Y/n]"
  if ($Park -ne "n" -and $Park -ne "N") {
    node "scripts/check-conflicts.mjs" --park | Select-Object -Last 1
    $Conflicts = (node "scripts/check-conflicts.mjs" 2>&1 | Out-String)
  }
}

# --- The workspace folder's guards ---
# Sessions are opened on the parent folder (repos side by side), which does not load this
# repo's hooks on its own: install-workspace gives it the copy it needs. Idempotent.
# The session then opens on that folder, as every later one should (QUICKSTART.md, section 4);
# if it cannot take them (a parent folder that is your home folder, say), it opens here.
Write-Host ""
$LaunchDir = (Get-Location).Path
try {
  $WsOut = & node "scripts/install-workspace.mjs" 2>&1
  $WsOk = ($LASTEXITCODE -eq 0)
  $WsOut | Where-Object { "$_" -notmatch '^Next:' } | ForEach-Object { Write-Host "$_" }
  if ($WsOk) { $LaunchDir = $ParentDir }
} catch { }
if ($LaunchDir -eq (Get-Location).Path) {
  Write-Host "!! The workspace folder did not take the guards, so Claude opens in the repository itself; your agent will say why."
}

# Two things the Cloudflare CLI token cannot do, written down now rather than
# discovered mid-deploy: writing a DNS record, and enabling Zero Trust. The Access
# policy itself is scripts/protect-access.mjs, with a token of its own.
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

## Still instructing this agent from outside the repo

$Conflicts

## For the setup

The hosting answer above is a proposal for the stack walk (setup, step 1), not a decision:
walk STACK.md and CONNECTORS.md with the owner row by row before relying on it.

Still needs a human in the Cloudflare dashboard (the CLI token cannot do these):
enabling Zero Trust once on the account, and writing DNS records. The Access policy
that protects the intranet is scripts/protect-access.mjs, with an API token of its
own (setup, step 2). See docs/deploy-cloudflare.md.
"@ | Set-Content -Path "source/inbox/setup-answers.md" -Encoding UTF8
Write-Host "OK Wrote source/inbox/setup-answers.md for the first session"

# --- The next step, from the repo's own files (lib/setup-stage.mjs) ---
# A fresh repo opens on the setup, whose first step is the STACK.md walk; a repo already
# set up opens on whatever its files say is next. setup-status --next is the one wording.
$Next = 'say "set up my organization"'
try { $n = (node "scripts/setup-status.mjs" --next 2>$null | Out-String).Trim(); if ($n) { $Next = $n } } catch { }
$Fresh = (Test-Path "source/brief.md") -and (Select-String -Path "source/brief.md" -Pattern "TODO" -Quiet)

Write-Host ""
Write-Host "== Done. Your repository is at: $Target =="
Write-Host ""
Write-Host "Work with your agent in Claude Code's Code tab (desktop app) or in a terminal, never in"
Write-Host "the chat: only a Code session reads the repository."
Write-Host ""
Set-Location $LaunchDir
if (Test-Command "claude") {
  if ($Fresh) {
    Write-Host "Launching Claude Code in $LaunchDir on the setup: it starts by walking STACK.md with you."
    Write-Host ""
    claude "set up my organization"
  } else {
    Write-Host "Launching Claude Code in $LaunchDir. Next: $Next."
    Write-Host ""
    claude
  }
} else {
  Write-Host "Open the Claude Code desktop app on $LaunchDir, in the Code tab, then $Next."
}
