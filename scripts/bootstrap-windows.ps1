# Set up a Windows machine for the agentic-organization kit: installs whatever's missing
# (git, Node, GitHub CLI, Claude Code), authenticates GitHub, makes ~\Projects the folder
# that holds the repositories, then does one of three things, asked at the start:
#   1. new    create the organization's repo from this template, clone it, give the parent
#             folder the repo's guards, and open Claude on the setup (the STACK.md walk)
#   2. join   clone a repo that already runs on the kit (owner/repo), give the parent folder
#             its guards, and open Claude on the newcomer's first session (QUICKSTART.md, section 7)
#   3. tools  stop after the tools: for someone with no repo yet, or who will get one later
#
# Run it directly, from a PowerShell window (right-click Start -> "Terminal"):
#   irm https://raw.githubusercontent.com/pyduan/agentic-organization/main/scripts/bootstrap-windows.ps1 | iex
# Skip the question (irm | iex takes no arguments, so it reads the environment):
#   $env:AO_JOIN="<owner>/<repo>"; irm https://raw.githubusercontent.com/pyduan/agentic-organization/main/scripts/bootstrap-windows.ps1 | iex
#   $env:AO_MODE="new" (or "tools") does the same for the other two.
#
# Cloudflare is asked too, since not everyone needs it: whoever publishes needs the
# Cloudflare login (Wrangler), and the agent can also get Cloudflare's own plugin, so it
# creates Workers and Access rules itself. $env:AO_CLOUDFLARE="no" | "login" | "plugin"
# answers in advance. A newcomer gets the plugin only if CONNECTORS.md approves it.
# or clone the repo first and run .\scripts\bootstrap-windows.ps1
#
# Safe to re-run: every step checks whether it's already done before acting.

$ErrorActionPreference = "Stop"
$Template = "pyduan/agentic-organization"
$Mode = "$env:AO_MODE"
$JoinRepo = "$env:AO_JOIN"
$Cloudflare = "$env:AO_CLOUDFLARE"
if ($JoinRepo -and -not $Mode) { $Mode = "join" }

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

# --- Cloudflare, for whoever needs it ---
# The login lets the agent deploy with Wrangler; the plugin lets it create Workers and Access
# rules through Cloudflare's own tools. Neither is needed to read and write the repository.
function Invoke-CloudflareLogin {
  Write-Host ""
  Write-Host "Logging into Cloudflare, so your agent can publish without you clicking through a dashboard."
  try { npx --yes wrangler whoami | Out-Null; $ok = ($LASTEXITCODE -eq 0) } catch { $ok = $false }
  if ($ok) { Write-Host "OK Already logged into Cloudflare"; return }
  Write-Host "A browser window will open to authorize Cloudflare (Ctrl+C to skip and do it later):"
  try { npx --yes wrangler login } catch { Write-Host "!! Skipped -- Claude can run 'npx wrangler login' with you later." }
}
# Installed for the folder the sessions open on (scope local), never for the whole machine:
# a plugin loaded everywhere is what check-conflicts exists to find.
$CfPluginDone = "no"
function Install-CloudflarePlugin($dir) {
  if (-not (Test-Command "claude")) {
    Write-Host "!! Claude Code's command is not on your PATH, so Cloudflare's plugin waits: ask your agent to install it."
    return "no"
  }
  try { claude plugin marketplace add cloudflare/skills 2>$null | Out-Null } catch { }
  Push-Location $dir
  try { claude plugin install cloudflare@cloudflare --scope local 2>$null | Out-Null; $ok = ($LASTEXITCODE -eq 0) } catch { $ok = $false }
  Pop-Location
  if ($ok) { Write-Host "OK Cloudflare's plugin installed for sessions opened on $dir"; return "yes" }
  Write-Host "!! Cloudflare's plugin did not install; ask your agent to install cloudflare@cloudflare for this folder."
  return "no"
}

# --- What this machine is for ---
if (-not $Mode) {
  Write-Host ""
  Write-Host "What are you setting up?"
  Write-Host "  1) A new organization: create our repository from the kit (default)"
  Write-Host "  2) Join an organization that already runs on the kit: clone its repository"
  Write-Host "  3) Just the tools for now: I will get a repository later"
  $ModeChoice = Read-Host "Choose 1, 2 or 3 [1]"
  $Mode = switch ($ModeChoice) { "2" { "join" } "3" { "tools" } default { "new" } }
}

$DefaultDir = Join-Path $HOME "Projects"
New-Item -ItemType Directory -Force -Path $DefaultDir | Out-Null

if ($Mode -eq "tools") {
  Write-Host ""
  Write-Host "== Done. The tools are installed, and $DefaultDir is where your repositories go. =="
  Write-Host ""
  Write-Host "When you have one, run this script again with the repository it should clone:"
  Write-Host "  `$env:AO_JOIN=`"<owner>/<repo>`"; irm https://raw.githubusercontent.com/$Template/main/scripts/bootstrap-windows.ps1 | iex"
  Write-Host "or with `$env:AO_MODE=`"new`" to create your organization's own."
  return
}

# Windows PowerShell 5.1 turns a native command's stderr into an exception under "Stop",
# so every gh/git call that may fail on purpose sits in a try.
function Test-RepoReadable($repo) {
  try { gh repo view $repo --json name 2>$null | Out-Null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}
function Get-GhText($arguments) {
  try { return (& gh @arguments 2>$null | Out-String).Trim() } catch { return "" }
}

if ($Mode -eq "join") {
  # --- Joining: the repo exists, and it carries how the agent behaves there ---
  while ([string]::IsNullOrWhiteSpace($JoinRepo)) {
    $JoinRepo = Read-Host "Which repository are you joining? (owner/repo, as in github.com/owner/repo)"
  }
  # Accept a pasted URL as well as owner/repo.
  $JoinRepo = $JoinRepo.Trim() -replace '^(https?://)?(www\.)?github\.com[/:]', '' -replace '^git@github\.com:', '' -replace '\.git$', '' -replace '/+$', ''
  $JoinOwner = $JoinRepo.Split('/')[0]
  $RepoName = $JoinRepo.Split('/')[-1]

  if (-not (Test-RepoReadable $JoinRepo)) {
    # The usual reason is an invitation sent and never accepted. Offer to accept it here.
    $OrgPending = Get-GhText @("api", "user/memberships/orgs", "--jq", ".[] | select(.state==`"pending`" and .organization.login==`"$JoinOwner`") | .organization.login")
    $RepoInvite = Get-GhText @("api", "user/repository_invitations", "--jq", ".[] | select(.repository.full_name==`"$JoinRepo`") | .id")
    if ($OrgPending -or $RepoInvite) {
      Write-Host ""
      $Accept = Read-Host "You have a pending invitation to $JoinOwner. Accept it now? [Y/n]"
      if ($Accept -ne "n" -and $Accept -ne "N") {
        if ($OrgPending) { gh api -X PATCH "user/memberships/orgs/$JoinOwner" -f state=active | Out-Null }
        if ($RepoInvite) { gh api -X PATCH "user/repository_invitations/$RepoInvite" | Out-Null }
      }
    }
  }
  if (-not (Test-RepoReadable $JoinRepo)) {
    $Login = Get-GhText @("api", "user", "--jq", ".login")
    Write-Host ""
    Write-Host "Your GitHub account ($Login) cannot read $JoinRepo."
    Write-Host "Check the spelling, and ask whoever runs it to invite this account. Then run this again."
    return
  }

  $ParentDir = Read-Host "Where should it live on your computer? [$DefaultDir]"
  if ([string]::IsNullOrWhiteSpace($ParentDir)) { $ParentDir = $DefaultDir }
  New-Item -ItemType Directory -Force -Path $ParentDir | Out-Null
  $Target = Join-Path $ParentDir $RepoName

  $Origin = ""
  if (Test-Path (Join-Path $Target ".git")) { try { $Origin = (git -C $Target remote get-url origin 2>$null | Out-String).Trim() } catch { } }
  if ($Origin -match "[/:]$([regex]::Escape($JoinRepo))(\.git)?$") {
    Write-Host "OK Already cloned at $Target, bringing it up to date"
    try { git -C $Target pull --ff-only } catch { }
    if ($LASTEXITCODE -ne 0) { Write-Host "!! Could not fast-forward; your agent will sort it out in the first session." }
  } else {
    if ((Test-Path $Target) -and (Get-ChildItem -Force $Target | Select-Object -First 1)) {
      Write-Host ""
      Write-Host "$Target already exists and is not $JoinRepo."
      $CleanStart = Read-Host "Move it aside and clone $JoinRepo there? [Y/n]"
      if ($CleanStart -eq "n" -or $CleanStart -eq "N") {
        Write-Host "Stopping here, nothing changed. Choose another folder and run this again."
        return
      }
      $Aside = "$Target.before-$(Get-Date -Format yyyy-MM-dd-HHmm)"
      Move-Item $Target $Aside
      Write-Host "OK moved aside to $Aside (nothing deleted)"
    }
    Write-Host "Cloning $JoinRepo to $Target"
    gh repo clone $JoinRepo $Target
  }
  Set-Location $Target
  if (Test-Path "package.json") {
    try { npm install --silent | Out-Null } catch { Write-Host "!! npm install had trouble; your agent will sort it in the first session." }
  }

  # Most newcomers use what the others publish, and need nothing from Cloudflare.
  $CfApproved = (Test-Path "CONNECTORS.md") -and [bool](Get-Content "CONNECTORS.md" | Where-Object { $_ -match '(?i)cloudflare' -and $_ -match '(?i)\|\s*authorized\s*\|' })
  if (-not $Cloudflare) {
    Write-Host ""
    Write-Host "Will you publish for the organization (its site, its intranet, its apps)?"
    Write-Host "  1) No, I use what the others publish (default)"
    Write-Host "  2) Yes: log me into Cloudflare so my agent can deploy"
    if ($CfApproved) {
      Write-Host "  3) Yes, and give my agent Cloudflare's plugin too, so it creates Workers and Access rules itself"
    }
    $CfChoice = Read-Host "Choose [1]"
    $Cloudflare = switch ($CfChoice) { "2" { "login" } "3" { "plugin" } default { "no" } }
  }
  if ($Cloudflare -eq "plugin" -and -not $CfApproved) {
    Write-Host "!! CONNECTORS.md has no authorized Cloudflare row, so the plugin is not installed: ask the owner."
    $Cloudflare = "login"
  }
  if ($Cloudflare -eq "login" -or $Cloudflare -eq "plugin") { Invoke-CloudflareLogin }
}

if ($Mode -eq "new") {
  # --- Where to put the project ---
  Write-Host ""
  $ProjectName = Read-Host "What should we call your repository? (e.g. riverside-coop)"
  while ([string]::IsNullOrWhiteSpace($ProjectName)) {
    $ProjectName = Read-Host "Please enter a name"
  }

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
  if ($HostChoice -eq "2") {
    $HostExisting = Read-Host "What are you using? (a name is enough)"
    if ([string]::IsNullOrWhiteSpace($HostExisting)) { $HostExisting = "unspecified" }
    $HostNote = "existing host: $HostExisting"
  } else {
    Write-Host ""
    Write-Host "Installing the deploy tooling."
    try { npm install --silent | Out-Null } catch { Write-Host "!! npm install had trouble; Claude will sort it in the first session." }
    if ($Cloudflare -ne "no") { Invoke-CloudflareLogin }
    if (-not $Cloudflare) {
      Write-Host ""
      $CfPlugin = Read-Host "Also give your agent Cloudflare's plugin, so it creates Workers and Access rules itself? [Y/n]"
      $Cloudflare = if ($CfPlugin -eq "n" -or $CfPlugin -eq "N") { "login" } else { "plugin" }
    }
  }

}   # new

# --- Anything else instructing this agent ---
# The kit's whole premise is one source of truth. A user-level CLAUDE.md, plugins and
# skills installed for an earlier experiment, globally declared MCP servers and
# forgotten scheduled tasks all load on every session and contradict quietly, and the
# owner cannot see any of it. Look now, while there is a person here to decide;
# nothing is ever deleted, only moved aside.
Write-Host ""
$Conflicts = ""
if (Test-Path "scripts/check-conflicts.mjs") { $Conflicts = (node "scripts/check-conflicts.mjs" 2>&1 | Out-String) }
if ($Conflicts) { Write-Host $Conflicts }
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

if ($Cloudflare -eq "plugin") { $CfPluginDone = Install-CloudflarePlugin $LaunchDir }
$CfLoggedIn = "no"
if ($Cloudflare -eq "login" -or $Cloudflare -eq "plugin") {
  try { npx --yes wrangler whoami | Out-Null; if ($LASTEXITCODE -eq 0) { $CfLoggedIn = "yes" } } catch { }
}

# --- Joining ends here: no setup answers to write, the repo is already set up ---
if ($Mode -eq "join") {
  $StatusScript = if ($LaunchDir -eq (Get-Location).Path) { "scripts/setup-status.mjs" } else { "$RepoName/scripts/setup-status.mjs" }
  $JoinPrompt = "I am joining $JoinRepo, which already runs on the agentic-organization kit; the install script cloned it into $Target. Read its AGENTS.md, source/brief.md, the repo map in ORGANIGRAM.md and CONNECTORS.md, ask me what my job is, and clone beside it only the repos that job needs, skipping without a word any I cannot read. Run node $StatusScript, fix what is red, and tell me which connectors the organization has approved for me to connect, and nothing else. Then tell me in plain words what the organization already does with you, starting from its intranet and its recipes, so we find my first task and run it as a recipe too."
  if ($Cloudflare -eq "login" -or $Cloudflare -eq "plugin") {
    $JoinPrompt += " I said I will publish for the organization: logged into Cloudflare: $CfLoggedIn; Cloudflare's plugin installed: $CfPluginDone."
  } else {
    $JoinPrompt += " I said I will not publish, so I need nothing from Cloudflare."
  }
  Write-Host ""
  Write-Host "== Done. $JoinRepo is at: $Target =="
  Write-Host ""
  Write-Host "Work with your agent in Claude Code's Code tab (desktop app) or in a terminal, never in"
  Write-Host "the chat: only a Code session reads the repository."
  Write-Host ""
  Set-Location $LaunchDir
  if (Test-Command "claude") {
    Write-Host "Launching Claude Code in $LaunchDir on your first session."
    Write-Host ""
    claude $JoinPrompt
  } else {
    Write-Host "Open the Claude Code desktop app on $LaunchDir, in the Code tab, and paste:"
    Write-Host ""
    Write-Host $JoinPrompt
  }
  return
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
- Cloudflare's plugin for the agent: $CfPluginDone (installed for $LaunchDir; a row to approve in CONNECTORS.md during the walk)
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
