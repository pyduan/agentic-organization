#!/bin/bash
# SessionStart for a session opened on the workspace: the folder that holds the router
# and the other repos side by side, where the router's own .claude/settings.json does
# not load. Installed by scripts/install-workspace.mjs (templates in docs/workspace/).
#
# 1. Fast-forwards every repo, never a merge or a rebase, and names the ones it could
#    not update. Working from a stale clone is how newer work gets overwritten. The rules
#    (default branch only, nothing uncommitted in the way) are scripts/workspace-sync.mjs.
# 2. Warns when git has no identity on this machine. Commits then go out signed
#    <user>@<computer name>, attached to no account, and nobody notices until someone
#    reads the history: a new organization's whole first day of commits went out so.
# 3. Runs the router's own start-of-session notices (kit news, open decisions).

router="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$router")}" || exit 0

if command -v node >/dev/null 2>&1; then
  node "$router/scripts/workspace-sync.mjs" sync --siblings 2>/dev/null
else
  echo "▲ Node is not installed on this machine, so no repo was brought up to date and the guards cannot run. Install it (QUICKSTART ▸ Install, in one paste)."
fi

email="$(git -C "$router" config user.email 2>/dev/null)"
case "$email" in
  "" | *@*.local | *@*.home | *@*.lan | *@*.localdomain | *@*.internal)
    echo "▲ Git has no identity on this machine: commits go out signed with the computer's name, tied to no account. Set user.name and user.email once (docs/troubleshooting.md ▸ Commits signed with the computer's name)." ;;
esac

[ -f "$router/scripts/kit-news.mjs" ] && node "$router/scripts/kit-news.mjs" 2>/dev/null
[ -f "$router/scripts/open-decisions.mjs" ] && node "$router/scripts/open-decisions.mjs" 2>/dev/null
exit 0
