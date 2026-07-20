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

# --- GitHub auth (HTTPS + browser login, no SSH key needed) ---
echo
if ! gh auth status >/dev/null 2>&1; then
  echo "Log into GitHub (a browser window will open):"
  gh auth login --hostname github.com --git-protocol https --web
else
  echo "✓ Already logged into GitHub"
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
