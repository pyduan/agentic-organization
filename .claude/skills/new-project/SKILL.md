---
name: new-project
description: "Decide whether a new request needs its own separate repo, is a variant of the current project (a sub-site, a sub-app, a new page), or is a self-contained area that lives as a subfolder here, then initialize its structure and act on it. Use when the owner says they want to start something new, set up another site, build a web app, open a new area or workstream, or work for a different client/brand — before creating anything."
---

# New project or a variant?

The same owner often comes back more than once: a second client, a rebrand, a new market. This
kit is **one repo per project** — don't let a second, unrelated project's content creep into this
one's `source/`, and don't spin up a whole new repo for something that was really just a new page.

## Ask first, don't guess

When the owner asks you to build several use cases or "a few projects", don't start building.
Establish the shape first, because the layout you pick is expensive to undo. Ask directly:

- Is this **one project or several**? A single project with several pages or apps is very different
  from several projects that happen to arrive together.
- **How much do they share, and which inherits from which?** Common brand, voice, facts, or
  documentation, with one project clearly feeding another, argues for keeping them together; fully
  distinct identities with different owners argue for keeping them apart. This is the deciding
  question for the structure (see below).
- Is this for the **same** owner/brand as this repo, or someone/something else?
- Would its content (bio, prices, voice, palette) ever need to appear **alongside** what's already
  in `source/content/` and `source/brand/`, or is it a fully separate identity?
- Does it need its **own domain**?

Then recommend a structure from the spectrum below *before* creating anything.

## One project or several? The folders / repos / orgs spectrum

When there really are several projects, where they live is a spectrum from most-shared to
most-separate, decided by how much shared documentation there is and which project inherits from
which (the human-facing version is in `docs/how-it-works.md` ▸ "Several projects"):

1. **Different folders in one repo** — one source of truth, one brand, one deploy. Simplest, but
   welds the projects together (same access and history). Right only when they are really one
   project wearing several hats.
2. **Different repos in one GitHub organization** (`org/website`, `org/appX`) — each project its own
   repo cloned from this kit, sitting together under one org so a shared brand and access can flow
   between them. The usual answer for related-but-distinct projects.
3. **Different GitHub organizations** — fully independent, each owning its own accounts, brand, and
   people. Right when the projects share nothing to inherit.

Two rules whenever you set this up:

- **Use a GitHub organization, not a personal account, for anything real.** A personal account has
  one owner and no room for a team or for sibling repos; an org (free) does. Create the org and let
  the project live there from the start.
- **Name the primary repo `<org>/website`, not `<person>/<project>`.** `bopa/website` stays
  extensible: sub-projects join as `bopa/appX`, `bopa/appY`, and the org owns the shared brand.
  `ericvibert/bopa` is a dead end — the person is not the org, and `appX` has nowhere to go. In each
  org, clone this kit into its `website` repo and work from there.

Worked example (projects PEPR, BoPA, CHB): if they are independent, three orgs (`pepr`, `bopa`,
`chb`), each with its own `website` cloned from this kit; if BoPA and PEPR are really programs under
CHB, one org `chb` holding `chb/website`, `chb/bopa`, `chb/pepr` so the parent's brand and facts
cascade down. Propose the shape that matches the inheritance the owner just described; don't default
blindly to one repo or to separate accounts.

## It's a variant — stay in this repo

Same owner, same brand, same `source/brand/voice.md` and `tokens.css` would apply. Examples: a new
language market, a redesign, a new page or collection, a seasonal microsite that still sounds and
looks like this project, a new deck for a different audience. **Don't create a new repo.** Use
what already exists:

- A new page or collection → `source/formats/website.md`, build it in `site/`.
- A **web app for the same project** (a calculator, a simulator, an intake form, a small tool) →
  `apps/<slug>/` per `source/formats/webapp.md` — same repo, same brand; it publishes under the
  site or as its own Cloudflare Worker on this repo, but it is **not** a new repo.
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
own Cloudflare Worker; nesting it as a subfolder of the lab's repo is the mistake.)

## It's a new project — a new repo

Different owner, different brand, or content that must never mix with what's already in
`source/`. Don't clone this repo's `source/` into it — that would carry over someone else's bio,
prices, and voice. Instead:

1. Create it in a **GitHub organization, not a personal account**, and name the primary repo
   `<org>/website` (see the folders/repos/orgs spectrum above for why: it stays extensible when
   sub-projects appear). Point the owner (or run yourself, if you're already set up to) at
   `SETUP.md`'s Option A/B/C to create a **fresh** copy of the template
   (`gh repo create <org>/website --template pyduan/agentic-organization --private --clone`) — a
   brand-new, independent repo, not a fork of this one.
2. Run the **setup** skill there, from scratch, with that project's own interview.
3. **Rebase, not clone**, if the owner wants to reuse something specific from this project (a
   design language, a voice trait, a photo): carry over that one asset or rule deliberately during
   the new project's own setup interview, the same way an existing-repo ingestion works (see the
   setup skill's "Existing repo" ingestion path) — never bulk-copy `source/` wholesale.
4. If the two projects are related enough that the owner wants a shared brand kit between them
   (e.g. two sites for the same organization), don't decide it silently: walk the folders/repos/orgs
   spectrum above with them. Strong shared documentation and one project inheriting from another
   points to repos in one org (or folders in one repo); genuinely separate identities point to
   separate orgs.

## It's a self-contained area — a subfolder here, or its own repo

Sometimes the new thing isn't a page, app, or deck but a whole area of work in this same project: a
body of notes, a dataset, an ongoing workstream. Where it lives is a spectrum decided by
sensitivity, and a new repo is only the far end of it:

- **Not sensitive** → a **subfolder in this repo** (material under `source/`, a tool under `apps/`).
  It shares the brand and the cascade like any other variant, and is the default: prefer it.
- **Private to you, but worth versioning** → a **git-ignored** subfolder, or a separate
  **local-only** repo on your machine (CLAUDE.md's sensitive-content rule). It never enters the
  shared public repo, but it's still versioned and backed up.
- **Sensitive or gated to specific people** (legal documents, HR and payroll data, finances,
  private client records) → its **own access-restricted repo**, with a short, **fact-free signpost**
  here (a note in the relevant guide) that names the owner, states what's public versus restricted,
  and explains that the real work happens in the private repo when the session can clone and pull it
  (GitHub permissions are the real gate). If it can't, the requester isn't authorized: say so and
  route them to the owner rather than reconstructing the restricted fact. A restricted repo is never
  auto-published: commit locally, push only when its owner asks.

Register whichever it is in [`ORGANIGRAM.md`](../../../ORGANIGRAM.md) so the area, and any access
boundary, is written down once.

**Whichever it is, initialize its structure first, never leave a bare folder.** A self-contained
area gets its own small setup so every future session knows where things go:

- **A new repo** → run the full `setup` skill there (its own interview, its own guides).
- **A subfolder here** → decide its layout up front before dropping anything in: the subfolders it
  needs, a short `README.md` at its root saying what lives there and how it's organized, and any
  guide or signpost the area warrants. Match the kit's conventions (content under `source/`, a tool
  under `apps/`, sensitive material git-ignored or in its own repo), seed that skeleton, then work in
  it. If the area changes how the project is organized, note it in `source/brief.md` too.

  **Ask, don't guess the layout.** A subfolder has no `setup` interview, so run a small one yourself:
  batch a few plain questions and let the answers shape the skeleton. What kind of material or work
  does it hold, and what would a good name for it be? How should it be organized, by what dimension
  (by client, by date, by document type)? Is any of it sensitive or for only some people (which may
  send it to a git-ignored folder or its own repo instead)? Does it publish, or stay internal? Does
  it need its own rules, a format guide or a voice note, or does it inherit the project's as-is?
  Propose a structure back from the answers and confirm it before creating anything, the same way
  `setup` proposes rather than interrogates.

## When still unsure

Default to **not** creating a new repo. Ask one more clarifying question rather than either
polluting this project's source of truth or fragmenting one project across two repos unnecessarily.
