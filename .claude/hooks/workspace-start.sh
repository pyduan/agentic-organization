#!/bin/bash
# SessionStart for a session opened on the workspace: the folder that holds the router
# and the other repos side by side, where the router's own .claude/settings.json does
# not load. Installed by scripts/install-workspace.mjs (templates in docs/workspace/).
#
# 1. Fast-forwards every repo, never a merge or a rebase, and names the ones it could
#    not update. Working from a stale clone is how newer work gets overwritten.
# 2. Warns when git has no identity on this machine. Commits then go out signed
#    <user>@<computer name>, attached to no account, and nobody notices until someone
#    reads the history: a new organization's whole first day of commits went out so.
# 3. Runs the router's own start-of-session notices (kit news, open decisions).

router="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$router")}" || exit 0

ok=0
notes=()
for d in */; do
  d="${d%/}"
  [ -e "$d/.git" ] || continue
  if ! git -C "$d" rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then
    notes+=("• $d: no upstream branch, not pulled")
  elif git -C "$d" pull --ff-only -q >/dev/null 2>&1; then
    ok=$((ok + 1))
  else
    notes+=("• $d: NOT updated (local changes in the way, or the histories diverged). Run git pull --rebase in it before writing.")
  fi
done
echo "Workspace: $ok repo(s) up to date."
for n in "${notes[@]}"; do echo "$n"; done

email="$(git -C "$router" config user.email 2>/dev/null)"
case "$email" in
  "" | *@*.local | *@*.home | *@*.lan | *@*.localdomain | *@*.internal)
    echo "▲ Git has no identity on this machine: commits go out signed with the computer's name, tied to no account. Set user.name and user.email once (docs/troubleshooting.md ▸ Commits signed with the computer's name)." ;;
esac

[ -f "$router/scripts/kit-news.mjs" ] && node "$router/scripts/kit-news.mjs" 2>/dev/null
[ -f "$router/scripts/open-decisions.mjs" ] && node "$router/scripts/open-decisions.mjs" 2>/dev/null
exit 0
