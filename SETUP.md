# Setup

One-time setup, about an hour. This page is written for the technical helper (or the mildly technical owner). Everything after this hour happens by talking to Claude.

## 1. Get your own copy of the kit

On the GitHub page of this repo, click **Use this template → Create a new repository**. Name it after the project (for example `mariana-site`). Private is fine; the site itself is published by Cloudflare, the repo can stay closed.

If the owner doesn't have a GitHub account yet, create one first. The account should belong to the owner, since the whole point is that they own the source of truth.

## 2. Install the tools on the owner's machine

- **git** (on macOS: `xcode-select --install`)
- **Node.js** LTS ([nodejs.org](https://nodejs.org) or `brew install node`)
- **GitHub CLI**: `brew install gh`, then `gh auth login` (choose HTTPS, login via browser)
- **Claude Code**: follow [claude.com/claude-code](https://claude.com/claude-code). The owner needs a Claude subscription; this is the one running cost besides the domain name.

Then clone the repo somewhere easy to find:

```sh
gh repo clone <owner>/<repo-name> ~/my-site
```

## 3. Run the first session

```sh
cd ~/my-site
claude
```

Say: **"set up my site"**. Claude runs a guided interview (what the site is for, what pages, what tone) and then ingests content one of a few ways:

- **You have an existing site**: give Claude the URL. It scrapes every page, saves the copy and images into `source/`, notes the design cues, and rebuilds on this system.
- **You have an existing repo** (even a messy one, even a different framework): point Claude at it. It clones it somewhere separate, reads the raw files instead of the rendered pages (often richer: drafts, structured data, higher-res images), and builds this kit's own `source/`/`site/` fresh from what it finds. None of the old code carries over.
- **You're starting from documents**: drop everything into `source/inbox/` (texts, bios, photos, brand PDFs, old decks, anything) and tell Claude. It files it all and builds from that.
- **You're starting from nothing**: Claude interviews you a bit deeper and drafts a first version for you to react to.

Claude then personalizes the guides in `source/brand/`, builds a first version of the site, and shows it to you locally. Iterate by talking until the owner likes it. This is the fun part; budget most of the hour here.

## 4. Put it live

Follow [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md), or just ask Claude to walk you through it while you click. In short: connect the GitHub repo to Cloudflare Pages (free), set the root directory to `site`, add the custom domain, adjust DNS. From then on every push publishes automatically.

## 5. Hand over

Teach the owner the entire technical surface they need:

1. Open Terminal.
2. `cd ~/my-site`
3. `claude`
4. Talk. Drop files in `source/inbox/` when there's something new.

Claude saves, publishes, and updates its own guides at the end of each session on its own. The owner never needs to know more than the four lines above.

## If something breaks later

Everything is versioned. "The site looked better last week, put it back" is a valid instruction: Claude can inspect the history and restore any earlier state. There is no way for the owner to lose work permanently through normal use.
