# AI operator

Your website, your decks, your whole public presence, run by an AI operator from one repo you own.

This is the workflow I use to run everything from a nonprofit's full marketing site to an artist's gallery and shop to my own one-page projects. Enough people have asked "how do you do that?" that I packaged it. Clone this, spend an hour on setup with a technical friend (or with me), and from then on you update your site by talking.

Paul Duan · [@pyduan](https://github.com/pyduan) · [paulduan.com](https://www.paulduan.com)

## The idea

Most people maintain a website by fighting a CMS, or by paying someone to fight it for them. This kit takes a different route:

- **One repo is the source of truth.** Your content, your voice guide, your design system, and your format playbooks all live here as plain files. The website and every deck are derivatives, rebuilt from those sources.
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
scripts/             one-command install scripts (mac + windows)
docs/                how the system works + the Cloudflare deploy guide
.claude/             skills (setup, new-project, publish, new-deck, research, reflect) + hooks
```

The guides ship as genericized templates distilled from real projects. The first session personalizes them: the AI interviews you, then builds from whatever you start with — documents dropped in the inbox, an existing live site it scrapes, or an existing repo it clones and mines for content (rebasing onto this kit's own structure, never reusing the old code) — or from nothing at all, if you're starting fresh.

## Getting started

About an hour, three ways to do it — pick whichever fits, they all end the same place. Full detail in [SETUP.md](SETUP.md):

- **Let Claude install itself.** Open [Claude Code](https://claude.com/claude-code) (the desktop app is the easiest on-ramp if you're not a terminal person) and paste one prompt; it checks your machine, installs whatever's missing, and creates your own copy of this repo.
- **Run a script.** One command, Mac or Windows, does the same thing deterministically — good for a technical helper setting this up for someone else.
- **Do it by hand.** Click **Use this template** on GitHub, install the few tools yourself, clone it.

Either way you end up with your own copy, cloned locally, and a first session that interviews you and builds v1. After that it's yours: open the folder, run `claude` (or the desktop app), talk.

## Try saying

A few things to say once you're in, to get a feel for it:

- **"Set up my site."** — the first-session interview; starts everything.
- **"Set up my site from my existing site at [URL]."** — skips straight to scraping it.
- **"Here's my old site's repo: [URL]. Set up from that."** — mines the raw files instead of the rendered pages (often richer).
- **"I want to start a new project for [someone/something else]."** — a different client or brand gets its own repo, never mixed into this one.
- **"Find me real numbers on [X]."** — a sourced research pass, banked for later.
- **"Make a deck for [occasion], here are my notes."** — a new presentation from a brief.
- **"This doesn't sound like me — [what's off]."** — corrects the voice guide, permanently, for every future page and deck.

## Where this comes from

Every rule in these guides was learned by shipping: a multi-contributor organization site with a full design system and deck engine, an artist's gallery and shop that gets updated weekly through an inbox folder, a brand built from scratch where the source documents came before any website, and a couple of deliberately tiny personal sites. The kit keeps what survived contact with real, mostly non-technical users and drops the rest.

## Status

Beta, and open to more than friends now. If you're using it and something in the flow confused you or your AI, that's a bug in the kit: tell me.

MIT license. If you build something with it, I'd love to see it — and if this saved you the trouble of building it yourself, a star helps the next person find it.
