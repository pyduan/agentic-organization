# Setup

**Handing this to someone rather than reading it yourself? [QUICKSTART.md](QUICKSTART.md) is the
one-pager**: the accounts to create, the paste, what plugs in, a first real use case, the three
publishing doors. This file is the detail behind it.

One-time setup, about an hour. Everything after this hour happens by talking to Claude. There are
three ways to get installed — pick whichever fits; they all end the same place: your own private
repo, cloned locally, ready to talk to.

If anything fails along the way, [docs/troubleshooting.md](docs/troubleshooting.md) collects the
problems everyone actually hits (git vs GitHub vs gh, the Mac command-line-tools popup, "command
not found" after an install, Cloudflare's empty branch dropdown, cloud vs desktop
Claude Code) with their fixes.

## Option A (easiest): let Claude install itself

Open Claude Code — the **desktop app** is the easiest on-ramp if you're not comfortable in a
terminal ([claude.com/claude-code](https://claude.com/claude-code), Mac and Windows); the CLI works
just as well if you already have a terminal you like. Then paste this:

> I want to set up my own site using the agentic-organization template
> (github.com/pyduan/agentic-organization). Check what's already on my machine (git,
> Node, the GitHub CLI, and whether I'm logged into GitHub). Ask me Mac or
> Windows if you can't tell from my system. Install whatever's missing, one
> step at a time: explain each step in plain language, verify it actually
> worked before moving to the next, and ask before anything that needs my
> password. If a step fails, look up the fix in the template's
> docs/troubleshooting.md on GitHub and walk me through it. Log me into
> GitHub with the GitHub CLI and set up an SSH key for me (`gh auth login
> --git-protocol ssh`, which creates and uploads it), on Mac or Windows alike,
> so you talk to GitHub on my behalf from now on. Then ask me for my
> project's name and where I'd like it on my computer, and create my own
> private copy of the template repo there.

Claude checks, installs, authenticates, asks the two questions it needs, and finishes with your own
cloned repo. From there, keep talking: say **"set up my site"** to start the real interview (see
[Run the first session](#run-the-first-session) below).


## One working folder, and the agent inside it

Before anything else, decide where your repos live: **one folder at the root of your machine**
(`~/Projects` by default), with every repo cloned side by side inside it, never nested. Open Claude
Code on that folder, not on a single repo: it is the agent's own kingdom, the one place where it can
read a project, the brand and a client next to each other. Then hand it the links and the accesses
to your sources (your mail, your Drive, a WhatsApp conversation in the browser), one at a time.

Do not ask it to tidy your Drive. It works, but it is the wrong problem: the Drive, the mailbox,
WhatsApp are made for humans and will stay messy, because people copy into them, edit by hand and
share. The agent **ingests** them. The real source of truth is the one it maintains apart, clean:
structured text files (Markdown, CSV) in the repo. The `source/inbox/` folder is just the door for
what has no connector yet: drop a file there, say what it is, and it gets filed and the folder
emptied.

## Option B: run a script

For a technical helper who'd rather have one deterministic command, or setting this up for someone
else remotely:

**Mac**, in Terminal:
```sh
curl -fsSL https://raw.githubusercontent.com/pyduan/agentic-organization/main/scripts/bootstrap-mac.sh | bash
```

**Windows**, in PowerShell (right-click the Start button → *Terminal*):
```powershell
irm https://raw.githubusercontent.com/pyduan/agentic-organization/main/scripts/bootstrap-windows.ps1 | iex
```

Each script checks for git, Node, the GitHub CLI, and Claude Code; installs whatever's missing; logs
you into GitHub over an SSH key it creates and uploads for you; asks for a project name and a folder;
creates + clones your own copy of the template; asks where the site will be published (a fresh
Cloudflare account by default, or somewhere you already are) and logs you into Cloudflare if that is
the answer, so the AI can publish on its own from the first session. The answers land in
`source/inbox/setup-answers.md` for that session to pick up. Both scripts are safe to run again if
something gets interrupted partway through.

## Option C: do it by hand

- **GitHub account**: the owner's own — create one first if they don't have one. It has to be
  theirs, since the whole point is owning your own source of truth.
- **git** (macOS: `xcode-select --install`; Windows: [git-scm.com](https://git-scm.com))
- **Node.js** LTS ([nodejs.org](https://nodejs.org), or `brew install node` / `winget install OpenJS.NodeJS.LTS`)
- **GitHub CLI**: `brew install gh` / `winget install GitHub.cli`, then `gh auth login` and choose
  **SSH**: `gh` creates the key and uploads it to your account in the same step, on Mac and Windows
  alike (OpenSSH ships with Windows 10+). This is the default on purpose: from then on your agent is
  your go-between with GitHub and nothing ever asks you to log in again. The browser login (HTTPS)
  still works and is the fallback if a network blocks SSH.
- **Claude Code**: [claude.com/claude-code](https://claude.com/claude-code) — the desktop app needs
  no separate terminal setup; the CLI (`npm install -g @anthropic-ai/claude-code`, or the installer
  on the same page) is just as good if you're already comfortable in one. The owner needs a Claude
  subscription either way; this is the one running cost besides the domain name.

Then create your own copy and clone it — pick anywhere memorable, `~/Projects/<name>` is a good
default:

```sh
mkdir -p ~/Projects && cd ~/Projects
gh repo create <name> --template pyduan/agentic-organization --private --clone
cd <name>
```

## Run the first session

```sh
cd ~/Projects/<name>   # or wherever you put it
claude
```

Say: **"set up my site"**. Claude runs a guided interview (what the site is for, what pages, what tone) and then ingests content one of a few ways:

- **You have an existing site**: give Claude the URL. It scrapes every page, saves the copy and images into `source/`, notes the design cues, and rebuilds on this system.
- **You have an existing repo** (even a messy one, even a different framework): point Claude at it. It clones it somewhere separate, reads the raw files instead of the rendered pages (often richer: drafts, structured data, higher-res images), and builds this kit's own `source/`/`site/` fresh from what it finds. None of the old code carries over.
- **You're starting from documents**: drop everything into `source/inbox/` (texts, bios, photos, brand PDFs, old decks, anything) and tell Claude. It files it all and builds from that.
- **You're starting from nothing**: Claude interviews you a bit deeper and drafts a first version for you to react to.

Whichever it is, the session does the same thing with it before building anything: agrees the folder
and file structure with you, works out which facts matter, then sweeps what you have and records the
facts (with sources), the decisions (with reasons) and the history (in order). Expect to be shown
three lists at the end of it: what is now recorded, what could not be established, and what Claude
proposes to build on top. That is the part that makes the second conversation cheaper than the first.

**Your history comes in once, then the day-to-day takes over.** Everything that predates the kit
(years of mail, notes, files) is swept in that first pass, scoped and reviewed, and recorded in the
repo; after that, each session ingests what its task needs through the connectors you plugged in and
the inbox. That split is why keeping your mailbox permanently connected is optional: a personal
comfort for asks like "search my event invitations", never something the system depends on.

Claude then personalizes the guides in `source/brand/`, builds a first version of the site, and shows it to you locally. Iterate by talking until the owner likes it. This is the fun part; budget most of the hour here.

## Put it live

Follow [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md), or just ask Claude to walk you through
it while you click. If you also said yes to the **private dashboard**, it publishes separately, as
its own Worker behind a login: `npm run deploy:dashboard`, then one click in the Cloudflare dashboard
to turn on Zero Trust and say who may open it. That page never goes on a public URL.

For the public site, in short: connect the GitHub repo to Cloudflare Workers (free, via Workers Builds), keep the root directory at `/` (the repo already ships the `wrangler.jsonc` that points Workers at the built site), add the custom domain, adjust DNS. From then on every push publishes automatically.

## Hand over

Teach the owner the entire technical surface they need:

1. Open Terminal (or the Claude Code desktop app).
2. `cd ~/Projects/<name>` (or open the folder, in the desktop app).
3. `claude` (skip this if you're already in the desktop app).
4. Talk. Drop files in `source/inbox/` when there's something new.

Claude saves, publishes, and updates its own guides at the end of each session on its own. The owner never needs to know more than the four lines above.

## Starting a second project

Coming back to set up something new (a different client, a different personal project)? Don't
reuse this folder — see the **new-project** skill (`.claude/skills/new-project/SKILL.md`): tell
Claude what you're starting and it'll tell you whether that means a brand-new repo (Option A/B/C
above, again) or a variant that belongs inside this same one.

## If something breaks later

Everything is versioned. "The site looked better last week, put it back" is a valid instruction: Claude can inspect the history and restore any earlier state. There is no way for the owner to lose work permanently through normal use.
