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

Yes, and `gh` makes it for you: `gh auth login --git-protocol ssh` creates the key and uploads it
to your account in the same step, on Mac and Windows alike (OpenSSH ships with Windows 10+). It is
the default since 2026-09-03 because your agent is your go-between with GitHub, and a key is what
lets it pull, push and clone for you without ever asking you to log in again. If git answers
`Permission denied (publickey)`, the key is missing on this machine or on the account: ask your
agent to "add my SSH key to GitHub" (it runs `gh ssh-key add`). The browser login over HTTPS still
works as a fallback if a network blocks SSH.

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

## "Fix the setting on X" — check that X is actually in the path first

When something doesn't work and the owner names the service they think is responsible, confirm that
service is really handling the thing before you change any of its settings. Where mail, DNS or
traffic actually flows is a fact you can look up in a second, and it is frequently not where anyone
assumes.

A real case: asked to fix why a domain's contact address received nothing, on the assumption its
host was misconfigured. One `dig MX` showed mail was being delivered to an entirely different
provider, so there was no setting on the named service to fix at all — and changing its
configuration would have looked like action while fixing nothing. Diagnose the path, then the
config.

## A renamed repository leaves your local copy pointing at the old name

Renaming a repo on GitHub is safe, and the old name keeps redirecting, which is exactly why this is
easy to miss: your local `git remote` still holds the old URL, `git pull` and `git push` keep
working through the redirect, and nothing ever warns you. It only surfaces later, confusingly.

After any rename, fix it once:

```sh
git remote set-url origin git@github.com:<owner>/<new-name>.git
git remote -v
```

And check that whatever else names the repo — the hosting connection, the repo description, the
README — still says something true.

## The to-dos app suddenly says 401, or "GitHub read failed"

**Suspect the token before you suspect the app**, especially if the app worked for weeks and then
stopped without anyone changing it.

The app writes to the repo through a GitHub token kept as a Worker secret. There are two ways that
token gets there, and one of them expires out from under you:

- **A fine-grained personal access token.** It has an expiry date, up to 366 days. When that date
  passes, every write starts failing and nothing warns you in advance.
- **A token piped from the `gh` CLI** (`gh auth token | wrangler secret put GITHUB_TOKEN`). This is
  a copy, taken once. `gh auth refresh`, `gh auth logout`, a reinstall or a new machine all give
  `gh` a new token — and the Worker keeps presenting the old one.

The tell for the second case is the timing: **the agent in the terminal still works fine while the
app on the phone does not.** The agent asks `gh` for a token every time and gets the current one;
the Worker is holding a snapshot.

The fix is one command, run from the app's folder:

```bash
gh auth token | npx wrangler secret put GITHUB_TOKEN
```

then redeploy. If it works, that was it.

**If it does not, stop and ask a person rather than guessing.** A 401 that survives a fresh token
usually means something structural: the token lost access to the repository, the fine-grained
token's repository list no longer includes it, an organization policy now requires approval, or the
Worker is pointing at the wrong repo. Those are not fixable by retrying, and an agent improvising
here tends to widen a token's scope to make an error go away, which is the wrong direction. Tell
the owner what you tried, and have them ask whoever set the project up.

**Not a token problem at all**, if the symptom differs:

- **403 on every page, not just writes** — that is Cloudflare Access, not GitHub. The identity
  header is missing; see the Access section of `deploy-cloudflare.md`.
- **"file not allowed"** — the path is not in `TODO_FILES`. That is the allow-list doing its job,
  not a bug. Add the path deliberately.
- **A write returns 200 but the file does not change** — the item's `^id` was not found, usually
  because something regenerated the file and churned the ids. See `source/formats/todo.md`.
