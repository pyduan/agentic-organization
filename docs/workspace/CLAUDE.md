# Workspace

This folder holds the organization's repos side by side. It is not a repo itself. This file and
`.claude/settings.json` beside it were written by `node {{ROUTER}}/scripts/install-workspace.mjs`
from `{{ROUTER}}/docs/workspace/`. Rerun that script after an update: it refreshes what it wrote and
adds the hooks a settings file lacks, leaving the rest as it is.

The router is `{{ROUTER}}/`. **Read `{{ROUTER}}/CLAUDE.md` before anything else**: every path it cites
(`source/…`, `scripts/…`, `.claude/skills/…`) is relative to `{{ROUTER}}/`. Each other folder is a
repo whose own `CLAUDE.md` says what it holds and who may read it.

A session opened here does not load the router's `.claude/settings.json`, so `.claude/settings.json`
in this folder runs the router's guards instead: at the start, a note of what is already unsaved, a
fast-forward pull of every repo, a warning if git has no identity, the router's notices and the map
checked against this machine; before a message leaves, the send guard; at the end of a turn, the
turn check and an end-of-session check across every repo. A repo the start could not update is named
in the first lines of the session: `git pull --rebase` in it before writing. `.claude/skills/` here
holds a relay to each skill of the repos, since Claude Code does not look inside them for skills
until the agent reads a file there.

@{{ROUTER}}/CLAUDE.md
