#!/bin/bash
# Stop hook: the safety net behind "everything is saved and published".
# If the session is about to end with unsaved or unpublished work, ask the
# AI to finish the loop (commit, push, reflect) before stopping. Nontechnical
# owners won't know to ask for this, so the repo does.

input=$(cat)

# Don't loop: if we already blocked once this stop, let it through.
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

dirty=$(git status --porcelain 2>/dev/null)
unpushed=""
if git rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then
  unpushed=$(git log '@{upstream}..HEAD' --oneline 2>/dev/null)
fi

if [ -n "$dirty" ] || [ -n "$unpushed" ]; then
  cat <<'EOF'
{"decision": "block", "reason": "End-of-session check: there are unsaved or unpublished changes in this repo. Before finishing: (1) commit the files you touched by name, with git commit --only -- <paths> (git add a new file first), so nothing another session staged rides along; (2) push so the change goes live; (3) run the reflection pass from .claude/skills/reflect/SKILL.md, folding anything learned this session into the guides; (4) tell the owner in plain words what was published and saved. If the leftover files are not yours to commit, say so to the owner instead of committing blindly."}
EOF
  exit 0
fi

exit 0
