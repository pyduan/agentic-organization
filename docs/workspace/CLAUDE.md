# Workspace

This folder holds the organization's repos side by side. It is not a repo itself. This file and
`.claude/settings.json` beside it were written by `node {{ROUTER}}/scripts/install-workspace.mjs`
from `{{ROUTER}}/docs/workspace/`. Rerun that script after an update rather than editing them here.

The router is `{{ROUTER}}/`. **Read `{{ROUTER}}/CLAUDE.md` before anything else**: every path it cites
(`source/…`, `scripts/…`, `.claude/skills/…`) is relative to `{{ROUTER}}/`. Each other folder is a
repo whose own `CLAUDE.md` says what it holds and who may read it.

A session opened here does not load the router's `.claude/settings.json`, so `.claude/settings.json`
in this folder runs the router's guards instead: at the start, a fast-forward pull of every repo and
the router's notices; before a message leaves, the send guard; at the end of a turn, the turn check
and an end-of-session check across every repo. A repo the start could not update is named in the
first lines of the session: `git pull --rebase` in it before writing.

@{{ROUTER}}/CLAUDE.md
