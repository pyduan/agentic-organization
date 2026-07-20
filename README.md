# Agentic organization starter kit

Run your organization as code: your website, your apps, your decks, your facts and your voice in one repo you own, operated by AI. You talk; it reads your guides, does the work, publishes, and learns.

This is the workflow I use to run everything from a nonprofit's full marketing site to an artist's gallery and shop to my own one-page projects. Enough people have asked "how do you do that?" that I packaged it. Clone this, spend an hour on setup with a technical friend (or with me), and from then on you update your site by talking.

The bet behind it: AI should pay off on both horizons at once. It saves you time today (a post, a deck, a site update in minutes), and because every use leaves a rule, a fact, or a guide in the repo, the thousandth request is served better than the first. Disposable AI is fast today and worthless tomorrow; a grand IT scheme is the opposite. An agentic organization gets both, because the same gesture serves both.

Paul Duan · [@pyduan](https://github.com/pyduan) · [paulduan.com](https://www.paulduan.com)

## Why this exists

Three problems kept showing up, in organizations and solo projects alike:

- **Middlemen that don't help.** Non-technical people end up fighting a SaaS site builder (a subscription, an editor that fights back, content locked inside, someone else's banner on your own page) or depending on a developer for every comma.
- **Shadow AI.** Everyone prompts in their own corner. The same work gets redone everywhere, and the AI never learns at the scale of the project or the team: every session starts from scratch.
- **Version chaos.** `v3_FINAL_def(reviewed).xlsx` scattered across the Drive, desktops, inboxes, and people's heads. Nobody knows which one is true.

The answer isn't a better prompt or one more tool: it's **governance embedded in the structure of a repo**. Write what the AI must know into plain files that inherit from one another — your identity and facts, your voice, your per-format rules, your personal voice on top — and the AI reads them fresh every session. Change a fact at the source and every future page, deck, and post is right by construction. That's the whole trick: you don't prompt-engineer, you maintain guides, and only once.

## The idea

- **One repo is the source of truth.** Your content, your voice guide, your design system, and your format playbooks all live here as plain files. The website and every deck are derivatives, rebuilt from those sources. You don't integrate a mockup, you keep a design system; you don't email talking points around in Word files, you keep a facts library that's always current for everyone.
- **AI is the operator.** You open the folder in [Claude Code](https://claude.com/claude-code) and talk in plain language. It reads your guides on its own (the repo tells it where everything is), makes the change, shows you the result, and publishes.
- **Git remembers everything.** Every version of every page is kept forever, so nothing you do can break the site permanently.
- **Publishing is free and automatic.** Cloudflare Pages watches the repo and puts every change live on your domain in about a minute.

## What a session feels like

> "I dropped two new paintings in the inbox folder. Add them to the gallery, the big one is 1200 euros."

> "Make a ten-slide deck for Tuesday's pitch from the notes I gave you, in French."

> "Our tone reads too corporate. Warmer, fewer buzzwords."

That last one updates your voice guide, so every future page and deck inherits it. At the end of each session the AI saves, publishes, and folds anything new it learned about your taste into your guides. You never touch git, code, or a deploy button.

## What's in the box

```
CLAUDE.md            the AI's operating manual: rules + a map of every guide
SETUP.md             the one-hour setup checklist, three ways to install
source/              your source of truth
  brief.md           who you are, what the site is for, current priorities
  inbox/             drop zone: put anything here and tell the AI about it
  content/           your canonical texts, facts, and data (prices, catalogs...)
  facts/             sourced third-party facts and key figures (stats, benchmarks)
  brand/             voice guide, design guide, design tokens, original assets
  formats/           one playbook per output: website pages, decks
site/                the website itself (Astro, deployed by Cloudflare Pages)
site/public/decks/   your presentations, each a single shareable HTML file
apps/                your web apps (a calculator, a form flow, a tool), one folder each
scripts/             one-command install scripts (mac + windows)
docs/                how it works, the Cloudflare deploy guide, the troubleshooting FAQ
.claude/             skills (setup, new-project, publish, new-deck, research, reflect) + hooks
```

The guides ship as genericized templates distilled from real projects. The first session personalizes them: the AI interviews you, then builds from whatever you start with — documents dropped in the inbox, an existing live site it scrapes, or an existing repo it clones and mines for content (rebasing onto this kit's own structure, never reusing the old code) — or from nothing at all, if you're starting fresh.

## Getting started

About an hour, three ways to do it — pick whichever fits, they all end the same place. Full detail in [SETUP.md](SETUP.md):

- **Let Claude install itself.** Open [Claude Code](https://claude.com/claude-code) (the desktop app is the easiest on-ramp if you're not a terminal person) and paste the prompt below; it checks your machine, installs whatever's missing, and creates your own copy of this repo.
- **Run a script.** One command, Mac or Windows, does the same thing deterministically — good for a technical helper setting this up for someone else.
- **Do it by hand.** Click **Use this template** on GitHub, install the few tools yourself, clone it.

The prompt to paste, if you go the first route:

> I want to set up my own site using the agentic-organization template
> (github.com/pyduan/agentic-organization). Check what's already on my machine (git,
> Node, the GitHub CLI, and whether I'm logged into GitHub). Ask me Mac or
> Windows if you can't tell from my system. Install whatever's missing,
> explaining each step in plain language and asking before anything that
> needs my password. Log me into GitHub (the browser-based login, not an
> SSH key). Then ask me for my project's name and where I'd like it on my
> computer, and create my own private copy of the template repo there.

Either way you end up with your own copy, cloned locally, and a first session that interviews you and builds v1. After that it's yours: open the folder, run `claude` (or the desktop app), talk.

If a step fails, [docs/troubleshooting.md](docs/troubleshooting.md) has the fixes for the problems everyone actually hits: git vs GitHub vs gh, the Mac command-line-tools popup, "command not found" right after an install, Cloudflare's empty production-branch dropdown, and running Claude Code in the cloud instead of installing anything locally.

## Try saying

A few things to say once you're in, to get a feel for it:

- **"Set up my site."** — the first-session interview; starts everything.
- **"Set up my site from my existing site at [URL]."** — skips straight to scraping it.
- **"Here's my old site's repo: [URL]. Set up from that."** — mines the raw files instead of the rendered pages (often richer).
- **"Build me a [calculator / simulator / intake form] for this project."** — a web app in `apps/`, same brand, same repo, published under the site or on its own URL.
- **"I want to start a new project for [someone/something else]."** — a different client or brand gets its own repo, never mixed into this one. (Same project's tool or sub-site stays here; the AI makes that call before creating anything.)
- **"Find me real numbers on [X]."** — a sourced research pass, banked for later.
- **"Make a deck for [occasion], here are my notes."** — a new presentation from a brief.
- **"This doesn't sound like me — [what's off]."** — corrects the voice guide, permanently, for every future page and deck.

## When you grow

The kit is tuned for one owner working solo on `main`. When a second regular contributor joins, the switch is one conversation: contributors move to branches and pull requests, one person merges, and everything else stays the same — the same guides, the same cascade, now with a review before publishing. The mental model (and the escalation paths for content and features) is in [docs/how-it-works.md](docs/how-it-works.md).

## Where this comes from

Every rule in these guides was learned by shipping: a multi-contributor organization site with a full design system and deck engine, an artist's gallery and shop that gets updated weekly through an inbox folder, a brand built from scratch where the source documents came before any website, and a couple of deliberately tiny personal sites. The kit keeps what survived contact with real, mostly non-technical users and drops the rest.

## Status

Beta, and open to more than friends now. If you're using it and something in the flow confused you or your AI, that's a bug in the kit: tell me.

MIT license. If you build something with it, I'd love to see it — and if this saved you the trouble of building it yourself, a star helps the next person find it.
