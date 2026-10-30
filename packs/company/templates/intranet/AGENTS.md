# AGENTS.md

Read [`__CENTRAL__/AGENTS.md`](https://github.com/__ORG__/__CENTRAL__/blob/main/AGENTS.md)
first.

## This repo is a view

It renders the markdown in `customers`, `strategy` and `administrative`, and what the central repo
holds about the company (`source/decisions.md`, `source/journal.md`). It is never the place a fact is
changed.

**When something on the site is wrong, go and fix the file.** If you find yourself about to hardcode
a company name, a number or a bullet into a component, stop: that fact belongs in a markdown file,
and putting it here creates a second source of truth over the same thing. This is the failure the
whole method exists to prevent, and it is easiest to commit in exactly this repo.

It takes input, and only input: a tick and a note on a to-do, kept in KV, and the note bubble, which
`worker.js` commits to `__CENTRAL__/source/inbox/notes/` with `NOTES_TOKEN`. Never render a note,
never read a fact out of KV into a page, and never give the bubble a second destination: the agent
files notes into the markdown, and the page shows the markdown.

## The words

Everything a reader sees is in one language, the company's. `src/lib/i18n.mjs` is the only place a
chrome word is written, and its strings are labels, not explanations: if a note needs two sentences,
the second one belongs in the markdown it describes. Everything else comes out of the markdown.

The structural headings the parser matches on are load-bearing strings in `content.mjs`:
`## Open questions` in each INDEX.md, `## To decide` in each DECISIONS.md, `## Journal` in a customer
file. Renaming one in a markdown file empties a list on the dashboard without failing the build. A
company that writes its files in another language renames them in both places in the same commit.

## Before changing a component

Ask whether the change belongs in the design system instead. `source/brand/design.md` and
`source/brand/tokens.css` in the central repo are the source. A new colour, size or radius goes there
first and is copied here. Do not add a hex value to this repo.

## The frontmatter is a contract

`src/lib/content.mjs` reads typed fields. Adding a field means changing three things in the same
commit: the `customer-file` skill (`__CENTRAL__/packs/company/skills/customer-file/SKILL.md`), the
template in `customers`, and `scripts/check-content.mjs`. A field that only exists in one of the
three is a field that breaks quietly.

Run `npm run check` before committing. It catches what the build does not, including the YAML trap
where an unquoted bullet containing `": "` becomes a map and renders as `[object Object]`.

## Charts

One exists, the pipeline on the dashboard. Its colours are categorical and were validated for
colour-vision separation and contrast in both themes, not chosen by eye. Do not nudge them: a change
that looks identical to you can drop an adjacent pair below the separation floor. If a sector is
added, add a validated step to `tokens.css` rather than letting anything generate a hue.

Every bar carries its company name, so identity never rests on colour alone. Keep that true.

## Decks

`scripts/deck/` is the kit's deck engine, copied from the central repo and listed in
`vendor/__CENTRAL__.json`: fix it in the central repo, then `npm run vendor:pull` here. Only
`paths.mjs` and `intranet.mjs` are this repo's own. A deck's look is `source/brand/deck/` in the
central repo, its content is its `deck.mdx` in `strategy` or `customers`, and nothing about a deck is
written in this repo. `npm run decks` runs in the build: never make it fail the build over one deck,
and never serve a refused deck to get it out the door. The reason a deck is refused is shown on the
Resources page so its author sees it.

## What the first review of an internal view asks for

The first review of a view built on real data arrives fast, often dictated. Read all of it, restate
the points as a list, and ask only what no file can answer. Five rules to build in from the start:

- **No example mode once the real data is in.** Example content lets a page show something on day
  one; the day the real files exist it only makes people ask which screen is true. The examples go out
  in the commit that brings the real files in.
- **One tab per kind of reader**, even when two tabs show the same files: the person who decides and
  the person who executes do not look for the same thing.
- **Every label in the readers' words, and every imported value says where it came from** until a
  person confirms it. A status nobody remembers setting gets asked about.
- **A count a cofounder can contradict is a bug.** A state derived from dates covers the cases real
  documents have (no end date, several years, tacit renewal, an amendment). Show the rule next to the
  count, so the next contradiction points at the case that was missed.
- **Hundreds of imported items need bulk handling from the start**: a rule that selects, a preview,
  one commit for the batch, and the items that cannot follow returned with their reason.

## Access

Cloudflare Access with a one-time email code, attached to the Worker itself. `worker.js` verifies
the assertion and serves nothing without it.

**Never weaken the gate.** In particular, never make the Worker serve assets when `TEAM_DOMAIN` or
`POLICY_AUD` is missing, and never add a bypass for local convenience. The whole point of that branch
is that a mistake in the Access configuration locks the site instead of publishing the pipeline.

The allowlist has one home, the address file `scripts/protect-access.mjs` is run with (`access.txt`
at the root of this repo), mirrored from `administrative/people/emails.md`. Do not copy it into
`worker.js`, a component, or a page. Changing who has access means changing the markdown first, then
the address file, then rerunning the script.

`npm run dev` has no Access in front of it, so the footer's identity line stays hidden. That is
correct. Do not stub an address in to make it appear.
