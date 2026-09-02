#!/bin/bash
# Bootstrap a new agentic-organization project on macOS: installs whatever's missing
# (Homebrew, git, Node, GitHub CLI, Claude Code), authenticates GitHub, creates
# a new repo from this template, clones it, and hands off to Claude.
#
# Run it directly:
#   curl -fsSL https://raw.githubusercontent.com/pyduan/agentic-organization/main/scripts/bootstrap-mac.sh | bash
# or clone the repo first and run ./scripts/bootstrap-mac.sh
#
# Safe to re-run: every step checks whether it's already done before acting.

set -e

TEMPLATE="pyduan/agentic-organization"

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

# --- Where to put the project ---
echo
read -p "What should we call your project? (e.g. mariana-site): " PROJECT_NAME
while [ -z "$PROJECT_NAME" ]; do
  read -p "Please enter a name: " PROJECT_NAME
done

DEFAULT_DIR="$HOME/Projects"
mkdir -p "$DEFAULT_DIR"
read -p "Where should it live on your computer? [$DEFAULT_DIR]: " PARENT_DIR
PARENT_DIR="${PARENT_DIR:-$DEFAULT_DIR}"
mkdir -p "$PARENT_DIR"
TARGET="$PARENT_DIR/$PROJECT_NAME"

if [ -d "$TARGET" ]; then
  echo "$TARGET already exists — using it as-is (skipping repo creation)."
  cd "$TARGET"
else
  echo
  echo "Creating your own private copy of the template on GitHub, and cloning it to:"
  echo "  $TARGET"
  cd "$PARENT_DIR"
  gh repo create "$PROJECT_NAME" --template "$TEMPLATE" --private --clone --description "My site, run by Claude"
  cd "$PROJECT_NAME"
fi

# --- Hosting, and getting the agent able to deploy on its own ---
echo
echo "Where should the site be published?"
echo "  1) A fresh Cloudflare account (default: free, and it holds domain + DNS + apps in one place)"
echo "  2) Somewhere I already have (Vercel, Netlify, my own server, an existing Cloudflare account)"
read -p "Choose 1 or 2 [1]: " HOST_CHOICE
HOST_CHOICE="${HOST_CHOICE:-1}"

HOST_NOTE="Cloudflare (fresh account)"
if [ "$HOST_CHOICE" = "2" ]; then
  read -p "What are you using? (a name is enough): " HOST_EXISTING
  HOST_NOTE="existing host: ${HOST_EXISTING:-unspecified}"
else
  echo
  echo "Installing the deploy tooling and logging into Cloudflare, so Claude can publish"
  echo "without you clicking through a dashboard every time."
  npm install --silent >/dev/null 2>&1 || echo "▲ npm install had trouble; Claude will sort it in the first session."
  if npx --yes wrangler whoami >/dev/null 2>&1; then
    echo "✓ Already logged into Cloudflare"
  else
    echo "A browser window will open to authorize Cloudflare (Ctrl+C to skip and do it later):"
    npx --yes wrangler login || echo "▲ Skipped — Claude can run 'npx wrangler login' with you later."
  fi
fi

# Two things wrangler's token cannot do, so nobody hunts for a command that
# does not exist: writing a DNS record, and creating an Access policy. Both are
# dashboard steps (or an API call with a broader token). Written down for the
# first session rather than discovered mid-deploy.
mkdir -p source/inbox
cat > source/inbox/setup-answers.md <<ANSWERS
# Answers from the bootstrap script

Written by scripts/bootstrap-mac.sh on $(date +%Y-%m-%d). The setup skill should read this,
act on it, and delete the file (inbox protocol).

- Machine: macOS, $(sw_vers -productVersion 2>/dev/null || echo "version unknown")
- Project folder: $TARGET
- Hosting: $HOST_NOTE
- Cloudflare CLI logged in: $(npx --yes wrangler whoami >/dev/null 2>&1 && echo yes || echo no)
- SSH key present: $([ -f "$HOME/.ssh/id_ed25519.pub" ] || [ -f "$HOME/.ssh/id_rsa.pub" ] && echo yes || echo no)

Still needs a human in the Cloudflare dashboard (the CLI token cannot do these):
writing DNS records, and enabling Zero Trust / creating the Access policy that
protects the private dashboard. See docs/deploy-cloudflare.md.
ANSWERS
echo "✓ Wrote source/inbox/setup-answers.md for the first session"

echo
echo "== Done. Your project is at: $TARGET =="
echo
if command -v claude >/dev/null 2>&1; then
  echo "Launching Claude Code — once it opens, just say: \"set up my site\""
  echo
  exec claude
else
  echo "Open the Claude Code desktop app and open this folder, then say: \"set up my site\""
fi
