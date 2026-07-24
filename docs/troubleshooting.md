# Troubleshooting the setup

The questions everyone asks, collected from real installs. Read the entry that matches what
you're seeing; each one says what it means and what to do. If you're mid-setup with Claude, you
can also just paste the error into the chat and say "check docs/troubleshooting.md" — it will
find the fix and walk you through it.

## "git", "GitHub", "GitHub Desktop", "gh" — which is which?

Four similar names, four different things. You need two of them:

- **git** — the version-control program on your computer. Records every change. You need it.
- **GitHub** — the website (github.com) where your repo's online copy lives. You need an account.
- **gh** (the GitHub CLI) — a small command-line tool that connects your computer to your GitHub
  account. It's how the setup logs you in and creates repos without touching a browser form. You
  need it.
- **GitHub Desktop** — a separate graphical app. **You don't need it** for this kit; if you
  installed it thinking it was "GitHub", no harm, but it's not the tool the setup uses.

So "install GitHub locally" isn't a thing: you install **git** and **gh** locally, and **GitHub**
is the website where your account lives.

## Mac: a popup about "command line developer tools"

Typing `git` (or almost any developer command) on a fresh Mac triggers a system popup offering to
install the "command line developer tools". That's normal and it's the right way to get git:
click **Install**, let it finish (a few minutes), then run your command again. If you dismissed
the popup, bring it back with:

```sh
xcode-select --install
```

## "command not found" right after installing something

The terminal window you already had open doesn't know about tools installed a minute ago (its
PATH was read when it opened). Close the terminal window entirely, open a fresh one, try again.
This is the single most common stumble on both Mac and Windows.

## Windows: `winget` not found, or PowerShell vs "Command Prompt"

- Use **PowerShell** (right-click the Start button → *Terminal*), not the old Command Prompt.
- If `winget` isn't found, install/update **App Installer** from the Microsoft Store, then reopen
  the terminal.
- Same reopen-the-terminal rule as above after every install.

## Desktop app, command line, or Claude Code in the cloud?

Three ways to run Claude Code, and the setup differs:

- **Desktop app** (Mac/Windows) — easiest on-ramp: no terminal needed to run Claude itself; open
  the project folder in the app and talk. The machine still needs git and gh for publishing
  (Claude can install them for you, per SETUP.md's Option A).
- **CLI** (`claude` in a terminal) — same thing for people already comfortable in a terminal.
- **Cloud** (claude.ai/code in the browser) — runs on Anthropic's machines, not yours. It can
  create and edit your GitHub repo directly, and since Cloudflare publishes from GitHub (not from
  your computer), the publish loop works fully in the cloud too. What you lose is the local
  preview (`npm run dev`) and the local inbox folder; you review via the live `.workers.dev` URL
  instead. If installing things locally keeps failing, this is the escape hatch: create your copy
  on GitHub with **Use this template**, open it in Claude Code on the web, and skip every local
  install.

## GitHub login: do I need an SSH key?

No. `gh auth login` with **HTTPS** and the browser login is the intended path; no key to
generate, upload, or lose. If git ever answers `Permission denied (publickey)`, your repo is
configured for SSH remotes — ask Claude to "switch my remote to HTTPS" (one command), or
re-run `gh auth login` and pick HTTPS.

## Cloudflare's branch dropdown is empty (or won't take "main")

When connecting the repo (Workers Builds, or the older Pages), the branch dropdown only lists
branches that **already exist on GitHub**, and a brand-new repo has none until the first push.
This trips almost everyone who connects Cloudflare before building anything.

Fix: build your v0 with Claude first. When it commits and pushes, the `main` branch comes into
existence, and Cloudflare's dropdown will then offer it. The production branch is always `main`.

## Cloudflare deployed something, but it's not my site (or the build fails)

Two usual causes:

- **Root directory**: on **Workers** leave the root directory at the repo root (`/`); the
  `wrangler.jsonc` there already points at the built site (`site/dist`), so you don't set the root
  to `site`. (The older Pages setup was the opposite: it needed **Root directory: `site`**. If you
  followed an old Pages guide and set `site`, that's the mismatch.)
- **Node version complaints in the build log**: set the build's Node version to a current LTS (for
  example `22`) in the build settings.

## Second project: new repo or a folder inside this one?

One project = one repo. A genuinely distinct project (a different brand, a different site, a
webapp next to your lab's site) gets its **own repo** from the template and its own Cloudflare
Worker; don't nest it as a subfolder of an existing one. If you're unsure whether
something is a new project or a variant of the current one, ask Claude — the `new-project` skill
exists exactly for that call.

## Still stuck?

Paste the exact error message to Claude and ask it to diagnose step by step. And if your problem
wasn't in this list, it should be: once it's solved, ask Claude to add the entry here so the next
person finds it.
