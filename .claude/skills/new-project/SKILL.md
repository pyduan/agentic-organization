---
name: new-project
description: "Decide whether a new request needs its own separate repo or is a variant of the current project (a sub-site, a sub-app, a new page), then act on it. Use when the owner says they want to start something new, set up another site, build a web app, or work for a different client/brand — before creating anything."
---

# New project or a variant?

The same owner often comes back more than once: a second client, a rebrand, a new market. This
kit is **one repo per project** — don't let a second, unrelated project's content creep into this
one's `source/`, and don't spin up a whole new repo for something that was really just a new page.

## Ask first, don't guess

If the owner's request is ambiguous, ask directly:

- Is this for the **same** owner/brand as this repo, or someone/something else?
- Would its content (bio, prices, voice, palette) ever need to appear **alongside** what's already
  in `source/content/` and `source/brand/`, or is it a fully separate identity?
- Does it need its **own domain**?

## It's a variant — stay in this repo

Same owner, same brand, same `source/brand/voice.md` and `tokens.css` would apply. Examples: a new
language market, a redesign, a new page or collection, a seasonal microsite that still sounds and
looks like this project, a new deck for a different audience. **Don't create a new repo.** Use
what already exists:

- A new page or collection → `source/formats/website.md`, build it in `site/`.
- A **web app for the same project** (a calculator, a simulator, an intake form, a small tool) →
  `apps/<slug>/` per `source/formats/webapp.md` — same repo, same brand; it publishes under the
  site or as its own Cloudflare Pages project on this repo, but it is **not** a new repo.
- A **sub-site** (a seasonal microsite, an event page, a landing for a campaign) that still sounds
  and looks like this project → a section or page of `site/`, or `apps/<slug>/` if it's genuinely
  its own little thing; still this repo.
- A new deck → the `new-deck` skill.
- A new language → extend the site's i18n per `source/formats/website.md`; the voice guide already
  has the rules for language quality.
- A sub-brand under the same organization (e.g. a program or product line) → a design/voice
  variation lives as a section of `source/brand/design.md`/`voice.md`, not a fork of the whole kit.

The dividing line, in one question: **would this thing cite this repo's facts and speak in this
repo's voice?** Yes → it lives here (site page, sub-site, or `apps/`). No → new repo. (Real case:
someone's personal webapp next to the lab site they contribute to — different project, own repo,
own Cloudflare Pages project; nesting it as a subfolder of the lab's repo is the mistake.)

## It's a new project — a new repo

Different owner, different brand, or content that must never mix with what's already in
`source/`. Don't clone this repo's `source/` into it — that would carry over someone else's bio,
prices, and voice. Instead:

1. Point the owner (or run yourself, if you're already set up to) at `SETUP.md`'s Option A/B/C to
   create a **fresh** copy of the template (`gh repo create <name> --template pyduan/agentic-organization
   --private --clone`) — a brand-new, independent repo, not a fork of this one.
2. Run the **setup** skill there, from scratch, with that project's own interview.
3. **Rebase, not clone**, if the owner wants to reuse something specific from this project (a
   design language, a voice trait, a photo): carry over that one asset or rule deliberately during
   the new project's own setup interview, the same way an existing-repo ingestion works (see the
   setup skill's "Existing repo" ingestion path) — never bulk-copy `source/` wholesale.
4. If the two projects are related enough that the owner wants a shared brand kit between them
   (e.g. two sites for the same organization), that's a bigger structural decision — flag it and
   propose a monorepo split rather than deciding it silently; don't default into it.

## When still unsure

Default to **not** creating a new repo. Ask one more clarifying question rather than either
polluting this project's source of truth or fragmenting one project across two repos unnecessarily.
