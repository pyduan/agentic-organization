#!/bin/bash
# Set up a Mac for the agentic-organization kit: installs whatever's missing (Homebrew,
# git, Node, GitHub CLI, Claude Code), authenticates GitHub, makes ~/Projects the folder
# that holds the repositories, then does one of three things, asked at the start:
#   1. new    create the organization's repo from this template, clone it, give the parent
#             folder the repo's guards, and open Claude on the setup (the STACK.md walk)
#   2. join   clone a repo that already runs on the kit (owner/repo), give the parent folder
#             its guards, and open Claude on the newcomer's first session (QUICKSTART.md ▸ 7)
#   3. tools  stop after the tools: for someone with no repo yet, or who will get one later
#
# Run it directly:
#   curl -fsSL https://raw.githubusercontent.com/pyduan/agentic-organization/main/scripts/bootstrap-mac.sh | bash
# Skip the question:
#   … | bash -s -- --join <owner>/<repo>      (or --new, --tools-only)
# or clone the repo first and run ./scripts/bootstrap-mac.sh [--join <owner>/<repo>]
# AO_JOIN=<owner>/<repo> or AO_MODE=new|join|tools in the environment do the same.
#
# Cloudflare is asked too, since not everyone needs it: whoever publishes needs the
# Cloudflare login (Wrangler), and the agent can also get Cloudflare's own plugin, so it
# creates Workers and Access rules itself. --cloudflare=no|login|plugin (or AO_CLOUDFLARE)
# answers in advance. A newcomer gets the plugin only if CONNECTORS.md approves it.
#
# Safe to re-run: every step checks whether it's already done before acting.

set -e

# Run the documented way (`curl … | bash`), stdin is the script itself, so every
# `read` below would consume the next lines of the script rather than wait for an
# answer: the run appears to answer its own questions and races to the end. Point
# the interactive reads at the terminal instead.
if [ ! -t 0 ] && [ -e /dev/tty ]; then exec < /dev/tty; fi

TEMPLATE="pyduan/agentic-organization"

MODE="${AO_MODE:-}"
JOIN_REPO="${AO_JOIN:-}"
CLOUDFLARE="${AO_CLOUDFLARE:-}"
[ -n "$JOIN_REPO" ] && MODE="${MODE:-join}"
while [ $# -gt 0 ]; do
  case "$1" in
    --new) MODE=new ;;
    --join) MODE=join; JOIN_REPO="${2:-}"; [ $# -gt 1 ] && shift ;;
    --join=*) MODE=join; JOIN_REPO="${1#--join=}" ;;
    --tools-only|--tools) MODE=tools ;;
    --cloudflare=*) CLOUDFLARE="${1#--cloudflare=}" ;;
    --no-cloudflare) CLOUDFLARE=no ;;
    *) echo "Unknown option: $1 (expected --new, --join <owner>/<repo>, --tools-only, --cloudflare=no|login|plugin)"; exit 1 ;;
  esac
  shift
done

echo "== agentic-organization setup =="
echo

# --- Homebrew ---
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew (the macOS package manager) isn't installed. Installing it now —"
  echo "this will ask for your Mac password partway through."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
else
  echo "✓ Homebrew found"
fi

# --- git ---
if ! command -v git >/dev/null 2>&1; then
  echo "Installing git..."
  brew install git
else
  echo "✓ git found"
fi

# --- Node.js ---
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js..."
  brew install node
elif ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)'; then
  echo "Node $(node --version) is too old (the sites need 22.12 or later). Updating..."
  if brew list node >/dev/null 2>&1; then brew upgrade node; else brew install node; fi
else
  echo "✓ Node found ($(node --version))"
fi

# --- GitHub CLI ---
if ! command -v gh >/dev/null 2>&1; then
  echo "Installing the GitHub CLI..."
  brew install gh
else
  echo "✓ GitHub CLI found"
fi

# --- Claude Code ---
if ! command -v claude >/dev/null 2>&1; then
  echo
  echo "Claude Code isn't installed yet. The easiest path is the desktop app:"
  echo "  https://claude.com/claude-code"
  echo "Download it, sign in, then re-run this script (or come back to this"
  echo "terminal once it's installed)."
  read -p "Press Enter once Claude Code is installed to continue, or Ctrl+C to stop here: " _
  if ! command -v claude >/dev/null 2>&1; then
    echo "Still not found on your PATH. If you installed the desktop app, this"
    echo "script's later steps (creating your repo) still work without it —"
    echo "you can just open the app and point it at the folder afterward."
  fi
else
  echo "✓ Claude Code found"
fi

# --- GitHub auth: SSH key, created and uploaded by gh (Paul, 2026-09-03) ---
# The agent is the owner's go-between with GitHub, so nothing may ever ask the owner to log in
# again: an SSH key on the account does that, on Mac as on Windows. Browser login is the fallback.
echo
if ! gh auth status >/dev/null 2>&1; then
  echo "Log into GitHub (a browser window will open):"
  gh auth login --hostname github.com --git-protocol ssh --web
else
  echo "✓ Already logged into GitHub"
fi

# --- Git identity ---
# Without this, git signs commits as "Name <user@Machine.local>". They still land,
# but GitHub can route them to nobody: the contributor graph shows zero, and a
# maintainer checking whether someone has been working sees an empty column and
# concludes the wrong thing. Observed on a real onboarding, a month late.
# Take the identity from the GitHub account we just logged into, so it matches.
if [ -z "$(git config --global user.email)" ]; then
  GH_LOGIN="$(gh api user --jq .login 2>/dev/null || true)"
  GH_NAME="$(gh api user --jq '.name // .login' 2>/dev/null || true)"
  GH_EMAIL="$(gh api user/emails --jq '[.[] | select(.primary)][0].email' 2>/dev/null || true)"
  # A user who keeps their address private has no primary email exposed; GitHub's
  # noreply address is the routable substitute and links commits correctly.
  if [ -z "$GH_EMAIL" ] && [ -n "$GH_LOGIN" ]; then
    GH_ID="$(gh api user --jq .id 2>/dev/null || true)"
    [ -n "$GH_ID" ] && GH_EMAIL="${GH_ID}+${GH_LOGIN}@users.noreply.github.com"
  fi
  if [ -n "$GH_EMAIL" ]; then
    git config --global user.email "$GH_EMAIL"
    [ -n "$GH_NAME" ] && git config --global user.name "$GH_NAME"
    echo "✓ Git will sign your commits as ${GH_NAME:-$GH_LOGIN} <$GH_EMAIL>"
  else
    echo "▲ Could not read your GitHub identity, so commits may not be credited to you."
    echo "  Tell your agent: 'my commits are not linked to my GitHub account', and it will fix it."
  fi
else
  echo "✓ Git identity already set ($(git config --global user.email))"
fi

# --- SSH key: make sure one exists and is on the account (gh offers to create one during
# login; this covers the case where the owner declined or was already logged in) ---
if [ ! -f "$HOME/.ssh/id_ed25519.pub" ] && [ ! -f "$HOME/.ssh/id_rsa.pub" ]; then
  echo
  echo "Creating the SSH key your agent will use to talk to GitHub for you (no passphrase, on purpose):"
  if true; then
    ssh-keygen -t ed25519 -N "" -f "$HOME/.ssh/id_ed25519" -C "$(git config user.email 2>/dev/null || echo "$USER@$(hostname)")"
    gh ssh-key add "$HOME/.ssh/id_ed25519.pub" --title "$(hostname) (agentic-organization setup)" 2>/dev/null \
      && echo "✓ SSH key created and added to your GitHub account" \
      || echo "▲ Key created locally; adding it to GitHub needs the 'admin:public_key' scope (gh auth refresh -s admin:public_key). Tell your agent: 'add my SSH key to GitHub'."
  fi
else
  echo "✓ SSH key already present"
fi

# --- Cloudflare, for whoever needs it ---
# The login lets the agent deploy with Wrangler; the plugin lets it create Workers and Access
# rules through Cloudflare's own tools. Neither is needed to read and write the repository.
cloudflare_login() {
  echo
  echo "Logging into Cloudflare, so your agent can publish without you clicking through a dashboard."
  if npx --yes wrangler whoami >/dev/null 2>&1; then
    echo "✓ Already logged into Cloudflare"
  else
    echo "A browser window will open to authorize Cloudflare (Ctrl+C to skip and do it later):"
    npx --yes wrangler login || echo "▲ Skipped — Claude can run 'npx wrangler login' with you later."
  fi
}
# Installed for the folder the sessions open on (scope local), never for the whole machine:
# a plugin loaded everywhere is what check-conflicts exists to find.
cloudflare_plugin() {
  if ! command -v claude >/dev/null 2>&1; then
    echo "▲ Claude Code's command is not on your PATH, so Cloudflare's plugin waits: ask your agent to install it."
    CF_PLUGIN_DONE=no; return
  fi
  claude plugin marketplace add cloudflare/skills >/dev/null 2>&1 || true
  if (cd "$1" && claude plugin install cloudflare@cloudflare --scope local >/dev/null 2>&1); then
    echo "✓ Cloudflare's plugin installed for sessions opened on $1"
    CF_PLUGIN_DONE=yes
  else
    echo "▲ Cloudflare's plugin did not install; ask your agent to install cloudflare@cloudflare for this folder."
    CF_PLUGIN_DONE=no
  fi
}
CF_PLUGIN_DONE=no

# --- What this machine is for ---
if [ -z "$MODE" ]; then
  echo
  echo "What are you setting up?"
  echo "  1) A new organization: create our repository from the kit (default)"
  echo "  2) Join an organization that already runs on the kit: clone its repository"
  echo "  3) Just the tools for now: I will get a repository later"
  read -p "Choose 1, 2 or 3 [1]: " MODE_CHOICE
  case "${MODE_CHOICE:-1}" in 2) MODE=join ;; 3) MODE=tools ;; *) MODE=new ;; esac
fi

DEFAULT_DIR="$HOME/Projects"
mkdir -p "$DEFAULT_DIR"

if [ "$MODE" = tools ]; then
  echo
  echo "== Done. The tools are installed, and $DEFAULT_DIR is where your repositories go. =="
  echo
  echo "When you have one, run this script again with the repository it should clone:"
  echo "  curl -fsSL https://raw.githubusercontent.com/$TEMPLATE/main/scripts/bootstrap-mac.sh | bash -s -- --join <owner>/<repo>"
  echo "or with --new to create your organization's own."
  exit 0
fi

if [ "$MODE" = join ]; then
  # --- Joining: the repo exists, and it carries how the agent behaves there ---
  while [ -z "$JOIN_REPO" ]; do
    read -p "Which repository are you joining? (owner/repo, as in github.com/owner/repo): " JOIN_REPO
  done
  # Accept a pasted URL as well as owner/repo.
  JOIN_REPO="$(printf '%s' "$JOIN_REPO" | sed -E 's#^(https?://)?(www\.)?github\.com[/:]##; s#^git@github\.com:##; s#\.git$##; s#/+$##')"
  JOIN_OWNER="${JOIN_REPO%%/*}"
  REPO_NAME="${JOIN_REPO##*/}"

  if ! gh repo view "$JOIN_REPO" --json name >/dev/null 2>&1; then
    # The usual reason is an invitation sent and never accepted. Offer to accept it here.
    ORG_PENDING="$(gh api user/memberships/orgs --jq ".[] | select(.state==\"pending\" and .organization.login==\"$JOIN_OWNER\") | .organization.login" 2>/dev/null || true)"
    REPO_INVITE="$(gh api user/repository_invitations --jq ".[] | select(.repository.full_name==\"$JOIN_REPO\") | .id" 2>/dev/null || true)"
    if [ -n "$ORG_PENDING" ] || [ -n "$REPO_INVITE" ]; then
      echo
      read -p "You have a pending invitation to $JOIN_OWNER. Accept it now? [Y/n]: " ACCEPT
      if [ "${ACCEPT:-Y}" != "n" ] && [ "${ACCEPT:-Y}" != "N" ]; then
        [ -n "$ORG_PENDING" ] && gh api -X PATCH "user/memberships/orgs/$JOIN_OWNER" -f state=active >/dev/null
        [ -n "$REPO_INVITE" ] && gh api -X PATCH "user/repository_invitations/$REPO_INVITE" >/dev/null
      fi
    fi
  fi
  if ! gh repo view "$JOIN_REPO" --json name >/dev/null 2>&1; then
    echo
    echo "Your GitHub account ($(gh api user --jq .login 2>/dev/null || echo unknown)) cannot read $JOIN_REPO."
    echo "Check the spelling, and ask whoever runs it to invite this account. Then run this again."
    exit 1
  fi

  read -p "Where should it live on your computer? [$DEFAULT_DIR]: " PARENT_DIR
  PARENT_DIR="${PARENT_DIR:-$DEFAULT_DIR}"
  mkdir -p "$PARENT_DIR"
  TARGET="$PARENT_DIR/$REPO_NAME"

  if [ -d "$TARGET/.git" ] && git -C "$TARGET" remote get-url origin 2>/dev/null | grep -Eqi "[/:]$JOIN_REPO(\.git)?$"; then
    echo "✓ Already cloned at $TARGET, bringing it up to date"
    git -C "$TARGET" pull --ff-only || echo "▲ Could not fast-forward; your agent will sort it out in the first session."
  else
    if [ -d "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
      echo
      echo "$TARGET already exists and is not $JOIN_REPO."
      read -p "Move it aside and clone $JOIN_REPO there? [Y/n]: " CLEAN_START
      if [ "${CLEAN_START:-Y}" = "n" ] || [ "${CLEAN_START:-Y}" = "N" ]; then
        echo "Stopping here, nothing changed. Choose another folder and run this again."
        exit 1
      fi
      ASIDE="$TARGET.before-$(date +%Y-%m-%d-%H%M)"
      mv "$TARGET" "$ASIDE"
      echo "✓ moved aside to $ASIDE (nothing deleted)"
    fi
    echo "Cloning $JOIN_REPO to $TARGET"
    gh repo clone "$JOIN_REPO" "$TARGET"
  fi
  cd "$TARGET"
  if [ -f package.json ]; then
    npm install --silent >/dev/null 2>&1 || echo "▲ npm install had trouble; your agent will sort it in the first session."
  fi

  # Most newcomers use what the others publish, and need nothing from Cloudflare.
  CF_APPROVED=no
  grep -i 'cloudflare' CONNECTORS.md 2>/dev/null | grep -qi '| *authorized *|' && CF_APPROVED=yes
  if [ -z "$CLOUDFLARE" ]; then
    echo
    echo "Will you publish for the organization (its site, its intranet, its apps)?"
    echo "  1) No, I use what the others publish (default)"
    echo "  2) Yes: log me into Cloudflare so my agent can deploy"
    if [ "$CF_APPROVED" = yes ]; then
      echo "  3) Yes, and give my agent Cloudflare's plugin too, so it creates Workers and Access rules itself"
    fi
    read -p "Choose [1]: " CF_CHOICE
    case "${CF_CHOICE:-1}" in 2) CLOUDFLARE=login ;; 3) CLOUDFLARE=plugin ;; *) CLOUDFLARE=no ;; esac
  fi
  if [ "$CLOUDFLARE" = plugin ] && [ "$CF_APPROVED" != yes ]; then
    echo "▲ CONNECTORS.md has no authorized Cloudflare row, so the plugin is not installed: ask the owner."
    CLOUDFLARE=login
  fi
  [ "$CLOUDFLARE" = login ] || [ "$CLOUDFLARE" = plugin ] && cloudflare_login
fi

if [ "$MODE" = new ]; then
  # --- Where to put the project ---
  echo
  read -p "What should we call your repository? (e.g. riverside-coop): " PROJECT_NAME
  while [ -z "$PROJECT_NAME" ]; do
    read -p "Please enter a name: " PROJECT_NAME
  done

  read -p "Where should it live on your computer? [$DEFAULT_DIR]: " PARENT_DIR
  PARENT_DIR="${PARENT_DIR:-$DEFAULT_DIR}"
  mkdir -p "$PARENT_DIR"
  TARGET="$PARENT_DIR/$PROJECT_NAME"

  if [ -d "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
    # Reusing a folder that is already there is how a half-finished earlier attempt
    # becomes the project: its stale files look like yours and nothing says otherwise.
    # Offer a clean start, and rename the old one aside rather than deleting it.
    echo
    echo "$TARGET already exists and is not empty."
    read -p "Start clean and move the existing folder aside? [Y/n]: " CLEAN_START
    if [ "${CLEAN_START:-Y}" != "n" ] && [ "${CLEAN_START:-Y}" != "N" ]; then
      ASIDE="$TARGET.before-$(date +%Y-%m-%d-%H%M)"
      mv "$TARGET" "$ASIDE"
      echo "✓ moved aside to $ASIDE (nothing deleted)"
      cd "$PARENT_DIR"
      gh repo create "$PROJECT_NAME" --template "$TEMPLATE" --private --clone --description "Our organization, run from one repository"
      cd "$PROJECT_NAME"
    else
      echo "Using it as-is (skipping repo creation)."
      cd "$TARGET"
    fi
  elif [ -d "$TARGET" ]; then
    cd "$TARGET"
  else
    echo
    echo "Creating your own private copy of the template on GitHub, and cloning it to:"
    echo "  $TARGET"
    cd "$PARENT_DIR"
    gh repo create "$PROJECT_NAME" --template "$TEMPLATE" --private --clone --description "Our organization, run from one repository"
    cd "$PROJECT_NAME"
  fi

  # --- Hosting, and getting the agent able to deploy on its own ---
  echo
  echo "Where should your intranet and your site be published? (Your agent goes over this"
  echo "again with you in the first session, as rows of STACK.md you approve one at a time.)"
  echo "  1) A fresh Cloudflare account in the organization's name (default: free, and it holds"
  echo "     the private intranet behind a sign-in, the site, the domain and DNS in one place)"
  echo "  2) Somewhere I already have (Vercel, Netlify, my own server, an existing Cloudflare account)"
  read -p "Choose 1 or 2 [1]: " HOST_CHOICE
  HOST_CHOICE="${HOST_CHOICE:-1}"

  HOST_NOTE="Cloudflare (fresh account)"
  if [ "$HOST_CHOICE" = "2" ]; then
    read -p "What are you using? (a name is enough): " HOST_EXISTING
    HOST_NOTE="existing host: ${HOST_EXISTING:-unspecified}"
  else
    echo
    echo "Installing the deploy tooling."
    npm install --silent >/dev/null 2>&1 || echo "▲ npm install had trouble; Claude will sort it in the first session."
    [ "$CLOUDFLARE" = no ] || cloudflare_login
    if [ -z "$CLOUDFLARE" ]; then
      echo
      read -p "Also give your agent Cloudflare's plugin, so it creates Workers and Access rules itself? [Y/n]: " CF_PLUGIN
      if [ "${CF_PLUGIN:-Y}" != "n" ] && [ "${CF_PLUGIN:-Y}" != "N" ]; then CLOUDFLARE=plugin; else CLOUDFLARE=login; fi
    fi
  fi

fi   # new

# --- Anything else instructing this agent ---
# The kit's whole premise is one source of truth. A user-level CLAUDE.md, plugins
# and skills installed for an earlier experiment, globally declared MCP servers and
# forgotten scheduled tasks all load on every session and contradict quietly, and the
# owner cannot see any of it. Found on a real first onboarding, where the newcomer's
# session behaved unlike everyone else's for exactly this reason. Look now, while
# there is a person here to decide; nothing is ever deleted, only moved aside.
echo
CONFLICTS=""
[ -f scripts/check-conflicts.mjs ] && CONFLICTS="$(node scripts/check-conflicts.mjs 2>&1 || true)"
[ -n "$CONFLICTS" ] && echo "$CONFLICTS"
if printf '%s' "$CONFLICTS" | grep -q '▸'; then
  echo
  read -p "Move the ▸ ones aside (reversible, nothing deleted)? [Y/n]: " PARK
  if [ "${PARK:-Y}" != "n" ] && [ "${PARK:-Y}" != "N" ]; then
    node scripts/check-conflicts.mjs --park | tail -1
    CONFLICTS="$(node scripts/check-conflicts.mjs 2>&1 || true)"   # what the first session inherits
  fi
fi

# --- The workspace folder's guards ---
# Sessions are opened on the parent folder (repos side by side), which does not load this
# repo's hooks on its own: install-workspace gives it the copy it needs. Idempotent.
# The session then opens on that folder, as every later one should (QUICKSTART.md ▸ 4);
# if it cannot take them (a parent folder that is your home folder, say), it opens here.
echo
LAUNCH_DIR="$PWD"
if WS_OUT="$(node scripts/install-workspace.mjs 2>&1)"; then LAUNCH_DIR="$PARENT_DIR"; fi
printf '%s\n' "$WS_OUT" | grep -v '^Next:' || true
[ "$LAUNCH_DIR" = "$PWD" ] && echo "▲ The workspace folder did not take the guards, so Claude opens in the repository itself; your agent will say why."

[ "$CLOUDFLARE" = plugin ] && cloudflare_plugin "$LAUNCH_DIR"
CF_LOGGED=no; [ "$CLOUDFLARE" = login ] || [ "$CLOUDFLARE" = plugin ] && npx --yes wrangler whoami >/dev/null 2>&1 && CF_LOGGED=yes

# --- Joining ends here: no setup answers to write, the repo is already set up ---
if [ "$MODE" = join ]; then
  STATUS_SCRIPT="$REPO_NAME/scripts/setup-status.mjs"
  [ "$LAUNCH_DIR" = "$PWD" ] && STATUS_SCRIPT="scripts/setup-status.mjs"
  JOIN_PROMPT="I am joining $JOIN_REPO, which already runs on the agentic-organization kit; the install script cloned it into $TARGET. Read its AGENTS.md, source/brief.md, the repo map in ORGANIGRAM.md and CONNECTORS.md, ask me what my job is, and clone beside it only the repos that job needs, skipping without a word any I cannot read. Run node $STATUS_SCRIPT, fix what is red, and tell me which connectors the organization has approved for me to connect, and nothing else. Then tell me in plain words what the organization already does with you, starting from its intranet and its recipes, so we find my first task and run it as a recipe too."
  case "$CLOUDFLARE" in
    login|plugin) JOIN_PROMPT="$JOIN_PROMPT I said I will publish for the organization: logged into Cloudflare: $CF_LOGGED; Cloudflare's plugin installed: $CF_PLUGIN_DONE." ;;
    *) JOIN_PROMPT="$JOIN_PROMPT I said I will not publish, so I need nothing from Cloudflare." ;;
  esac
  echo
  echo "== Done. $JOIN_REPO is at: $TARGET =="
  echo
  echo "Work with your agent in Claude Code's Code tab (desktop app) or in a terminal, never in"
  echo "the chat: only a Code session reads the repository."
  echo
  cd "$LAUNCH_DIR"
  if command -v claude >/dev/null 2>&1; then
    echo "Launching Claude Code in $LAUNCH_DIR on your first session."
    echo
    exec claude "$JOIN_PROMPT"
  fi
  echo "Open the Claude Code desktop app on $LAUNCH_DIR, in the Code tab, and paste:"
  echo
  echo "$JOIN_PROMPT"
  exit 0
fi

# Two things wrangler's token cannot do, so nobody hunts for a command that
# does not exist: writing a DNS record, and enabling Zero Trust. The Access
# policy itself is scripts/protect-access.mjs, with a token of its own.
# Written down for the first session rather than discovered mid-deploy.
mkdir -p source/inbox
cat > source/inbox/setup-answers.md <<ANSWERS
# Answers from the bootstrap script

Written by scripts/bootstrap-mac.sh on $(date +%Y-%m-%d). The setup skill should read this,
act on it, and delete the file (inbox protocol).

- Machine: macOS, $(sw_vers -productVersion 2>/dev/null || echo "version unknown")
- Project folder: $TARGET
- Hosting: $HOST_NOTE
- Cloudflare CLI logged in: $CF_LOGGED
- Cloudflare's plugin for the agent: $CF_PLUGIN_DONE (installed for $LAUNCH_DIR; a row to approve in CONNECTORS.md during the walk)
- SSH key present: $([ -f "$HOME/.ssh/id_ed25519.pub" ] || [ -f "$HOME/.ssh/id_rsa.pub" ] && echo yes || echo no)

## Still instructing this agent from outside the repo

$CONFLICTS

## For the setup

The hosting answer above is a proposal for the stack walk (setup ▸ 1), not a decision:
walk STACK.md and CONNECTORS.md with the owner row by row before relying on it.

Still needs a human in the Cloudflare dashboard (the CLI token cannot do these):
enabling Zero Trust once on the account, and writing DNS records. The Access policy
that protects the intranet is scripts/protect-access.mjs, with an API token of its
own (setup ▸ 2). See docs/deploy-cloudflare.md.
ANSWERS
echo "✓ Wrote source/inbox/setup-answers.md for the first session"

# --- The next step, from the repo's own files (lib/setup-stage.mjs) ---
# A fresh repo opens on the setup, whose first step is the STACK.md walk; a repo already
# set up opens on whatever its files say is next. setup-status --next is the one wording.
NEXT="$(node scripts/setup-status.mjs --next 2>/dev/null || echo 'say "set up my organization"')"

echo
echo "== Done. Your repository is at: $TARGET =="
echo
echo "Work with your agent in Claude Code's Code tab (desktop app) or in a terminal, never in"
echo "the chat: only a Code session reads the repository."
echo
FRESH=no; grep -q 'TODO' source/brief.md 2>/dev/null && FRESH=yes
cd "$LAUNCH_DIR"
if command -v claude >/dev/null 2>&1; then
  if [ "$FRESH" = yes ]; then
    echo "Launching Claude Code in $LAUNCH_DIR on the setup: it starts by walking STACK.md with you."
    echo
    exec claude "set up my organization"
  fi
  echo "Launching Claude Code in $LAUNCH_DIR. Next: $NEXT."
  echo
  exec claude
else
  echo "Open the Claude Code desktop app on $LAUNCH_DIR, in the Code tab, then $NEXT."
fi
