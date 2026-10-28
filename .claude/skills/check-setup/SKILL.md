---
name: check-setup
description: "Check that this machine is set up the way the kit expects and show it as one table, green, orange or red, with the fix for each row: git and Node, the GitHub login, the git identity, the repo map, whether the clones are up to date, the workspace folder's guards, whether the session hooks run, the kit version, and what instructs the agent from outside the repo. Use when the owner says 'check my setup', 'is everything installed', 'is my computer ready', 'why does the agent behave differently on this machine', right after an install, and when a second person has just joined."
---

# Check my setup

A setup goes wrong quietly. A clone that stopped updating, a parent folder that does not load the
guards, a GitHub login that expired, a plugin installed for some earlier experiment: none of them
turns anything red, and what the owner sees is an agent that behaves differently on one computer.
Each piece already has its own check; `scripts/setup-status.mjs` runs them together and changes
nothing.

## Run it

```sh
node scripts/setup-status.mjs --json        # what you read
node scripts/setup-status.mjs --offline     # no network: the clones as last fetched
```

## Show it

One table, in the owner's language, one row per check, in the order the JSON gives:

| | What | Where it stands |
|---|---|---|
| 🟢 | Git identity | Your commits are signed with your name and address. |
| 🟠 | Clones | One of your repos has two new commits nobody has pulled yet. |
| 🔴 | GitHub login | You are not logged into GitHub, so saving to it will fail. |

🟢 is `ok`, 🟠 is `warn`, 🔴 is `fail`, ⚪ is `info` (does not apply on this machine). Say what each
row means for them, never the raw command. Under the table, one line counted from the JSON's
`green`, `orange` and `red`, never written before you have read them.

## Then fix, red first

**Yours to do, then say what you did.** These only touch this machine's clones and folders, and
each one can be undone:

- clones behind: `node scripts/workspace-sync.mjs sync`. It only fast-forwards a clean default
  branch; anything else it names and leaves alone.
- the workspace folder missing its guards: `node scripts/install-workspace.mjs`.
- leftovers that also instruct the agent: say what `node scripts/check-conflicts.mjs` found, then
  `--park` moves the safe ones aside into a dated folder, with a note on how to put each back.

**Needs the owner, one sentence each:**

- the GitHub login: you run `gh auth login --web`, they click once in the browser.
- the git identity: ask the name and address they want on their commits, then set them yourself.
- a file in the workspace folder that someone else wrote and the installer will not touch (a `AGENTS.md`
  without the import, a `settings.json` that is not valid JSON): say what it lacks, and add it with their yes.
- a kit update not taken: run the `update-kit` skill, which shows what each update brings.
- a clone with changes or commits in the way: find out whose they are before anything else.

**Never** discard changes or commits to turn a row green: they may be another session's work, or
another person's. Never delete what `check-conflicts` found.

## Then run it again

A fix counts once its row is green on the second run: a command that exits zero says nothing about
the row. Show the second table, and say in one line what is left and why.

## What it does not check

Whether the code works is `npm test`. Whether what you published is still up is the `freshness`
skill. Connectors (mail, calendar, drive) are declared per session and are not visible from here:
if one matters to the owner, ask them to try it once.
