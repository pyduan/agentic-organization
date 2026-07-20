# Setup

One-time setup, about an hour. Everything after this hour happens by talking to Claude. There are
three ways to get installed — pick whichever fits; they all end the same place: your own private
repo, cloned locally, ready to talk to.

## Option A (easiest): let Claude install itself

Open Claude Code — the **desktop app** is the easiest on-ramp if you're not comfortable in a
terminal ([claude.com/claude-code](https://claude.com/claude-code), Mac and Windows); the CLI works
just as well if you already have a terminal you like. Then paste this:

> I want to set up my own site using the ai-operator template
> (github.com/pyduan/ai-operator). Check what's already on my machine (git,
> Node, the GitHub CLI, and whether I'm logged into GitHub). Ask me Mac or
> Windows if you can't tell from my system. Install whatever's missing,
> explaining each step in plain language and asking before anything that
> needs my password. Log me into GitHub (the browser-based login, not an
> SSH key). Then ask me for my project's name and where I'd like it on my
> computer, and create my own private copy of the template repo there.

Claude checks, installs, authenticates, asks the two questions it needs, and finishes with your own
cloned repo. From there, keep talking: say **"set up my site"** to start the real interview (see
[Run the first session](#run-the-first-session) below).

## Option B: run a script

For a technical helper who'd rather have one deterministic command, or setting this up for someone
else remotely:

**Mac**, in Terminal:
```sh
curl -fsSL https://raw.githubusercontent.com/pyduan/ai-operator/main/scripts/bootstrap-mac.sh | bash
```

**Windows**, in PowerShell (right-click the Start button → *Terminal*):
```powershell
irm https://raw.githubusercontent.com/pyduan/ai-operator/main/scripts/bootstrap-windows.ps1 | iex
```

Each script checks for git, Node, the GitHub CLI, and Claude Code; installs whatever's missing;
logs you into GitHub; asks for a project name and a folder; and creates + clones your own copy of
the template. Both are safe to run again if something gets interrupted partway through.

## Option C: do it by hand

- **GitHub account**: the owner's own — create one first if they don't have one. It has to be
  theirs, since the whole point is owning your own source of truth.
- **git** (macOS: `xcode-select --install`; Windows: [git-scm.com](https://git-scm.com))
- **Node.js** LTS ([nodejs.org](https://nodejs.org), or `brew install node` / `winget install OpenJS.NodeJS.LTS`)
- **GitHub CLI**: `brew install gh` / `winget install GitHub.cli`, then `gh auth login` — choose
  **HTTPS**, log in via browser. This is deliberately the easiest path: no SSH key to generate,
  upload, or lose. (If pushes fail later because your network blocks HTTPS git traffic — rare,
  mostly locked-down corporate machines — that's the one case you'd need an SSH key instead; see
  GitHub's own guide for that, or ask a technical friend.)
- **Claude Code**: [claude.com/claude-code](https://claude.com/claude-code) — the desktop app needs
  no separate terminal setup; the CLI (`npm install -g @anthropic-ai/claude-code`, or the installer
  on the same page) is just as good if you're already comfortable in one. The owner needs a Claude
  subscription either way; this is the one running cost besides the domain name.

Then create your own copy and clone it — pick anywhere memorable, `~/Projects/<name>` is a good
default:

```sh
mkdir -p ~/Projects && cd ~/Projects
gh repo create <name> --template pyduan/ai-operator --private --clone
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

Claude then personalizes the guides in `source/brand/`, builds a first version of the site, and shows it to you locally. Iterate by talking until the owner likes it. This is the fun part; budget most of the hour here.

## Put it live

Follow [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md), or just ask Claude to walk you through it while you click. In short: connect the GitHub repo to Cloudflare Pages (free), set the root directory to `site`, add the custom domain, adjust DNS. From then on every push publishes automatically.

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
