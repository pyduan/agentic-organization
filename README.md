# AI webmaster

Your website, your decks, your whole online presence, built and maintained by AI from one repo you own.

This is the workflow I use to run everything from a nonprofit's full marketing site to an artist's gallery and shop to my own one-page projects. Enough people have asked "how do you do that?" that I packaged it. Clone this, spend an hour on setup with a technical friend (or with me), and from then on you update your site by talking.

Paul Duan · [@pyduan](https://github.com/pyduan) · [paulduan.com](https://www.paulduan.com)

## The idea

Most people maintain a website by fighting a CMS, or by paying someone to fight it for them. This kit takes a different route:

- **One repo is the source of truth.** Your content, your voice guide, your design system, and your format playbooks all live here as plain files. The website and every deck are derivatives, rebuilt from those sources.
- **AI is the webmaster.** You open the folder in [Claude Code](https://claude.com/claude-code) and talk in plain language. It reads your guides on its own (the repo tells it where everything is), makes the change, shows you the result, and publishes.
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
SETUP.md             the one-hour setup checklist (for the technical helper)
source/              your source of truth
  brief.md           who you are, what the site is for, current priorities
  inbox/             drop zone: put anything here and tell the AI about it
  content/           your canonical texts, facts, and data (prices, catalogs...)
  facts/             sourced third-party facts and key figures (stats, benchmarks)
  brand/             voice guide, design guide, design tokens, original assets
  formats/           one playbook per output: website pages, decks
site/                the website itself (Astro, deployed by Cloudflare Pages)
site/public/decks/   your presentations, each a single shareable HTML file
docs/                how the system works + the Cloudflare deploy guide
.claude/             skills (setup, publish, new deck, reflect) + session hooks
```

The guides ship as genericized templates distilled from real projects. The first session personalizes them: the AI interviews you, then builds from whatever you start with — documents dropped in the inbox, an existing live site it scrapes, or an existing repo it clones and mines for content (rebasing onto this kit's own structure, never reusing the old code) — or from nothing at all, if you're starting fresh.

## Getting started

1. Click **Use this template** on GitHub to create your own copy (private is fine).
2. Follow [SETUP.md](SETUP.md) with a technical friend. It covers installing Claude Code, the first setup session, and connecting Cloudflare Pages to your domain. About an hour.
3. After that it's yours: open the folder, run `claude`, talk.

## Where this comes from

Every rule in these guides was learned by shipping: a multi-contributor organization site with a full design system and deck engine, an artist's gallery and shop that gets updated weekly through an inbox folder, a brand built from scratch where the source documents came before any website, and a couple of deliberately tiny personal sites. The kit keeps what survived contact with real, mostly non-technical users and drops the rest.

## Status

Beta. I'm testing this with friends before opening it up. If you're using it and something in the flow confused you or your AI, that's a bug in the kit: tell me.

MIT license. If you build something with it, I'd love to see it.
