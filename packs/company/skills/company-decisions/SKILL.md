---
name: company-decisions
description: "Record a decision in the right repo of a company set up with the company pack, typed strategy, technology or business, with what was set aside; keep the pending choices under '## To decide' and raise them at session start. Use when the owner says 'we decided', 'write this down as a decision', 'what is waiting on me', 'what do we still have to settle', or a meeting or sweep produced a choice. Company pack only; a single-repo organization uses source/decisions.md as the kit describes."
---

# Company decisions

A decision that is not written gets relitigated. The kit's rules hold here unchanged
(`source/decisions.md` ▸ *What "settled" obliges* and *Only a person settles*); this skill adds where
each decision goes across five repos, the type, and the section the intranet reads.

## Where it goes

| The decision binds | Write it in |
|---|---|
| The whole company: how we work, what we sell, who we are | central `source/decisions.md` |
| One customer or one engagement | `customers/DECISIONS.md`, or the project file's `## Decisions` when it is small |
| Pricing, structure, equity, legal | `strategy/DECISIONS.md` |
| Accounts, tools, people, admin | `administrative/DECISIONS.md` |
| The site itself | `intranet/DECISIONS.md` |

When unsure, the higher file is the safer place: a decision written too high is findable, one written
too low is lost. A decision lives in one file; the repo it touches links to it. `npm run check` in
`intranet/` refuses the same decision written in two files, because it renders twice in the journal
and nobody can tell which is current.

## The shape

In the four company repos:

```markdown
## Title saying what was decided (YYYY-MM-DD) · type

What was decided, in one or two lines, in the present tense.

Why, including what was considered and set aside. The option set aside is the part people come back
to read, because the reason for setting it aside is what they are about to rediscover.

What follows from it concretely.
```

The date is the decision's, not the commit's. The central `source/decisions.md` keeps the kit's own
format, and the intranet reads both.

`type` is one of three. It sits in the heading because the heading is what someone reads while
scanning the file; a taxonomy nobody sees while writing goes stale. The intranet's journal groups by
it, so an untyped decision shows as untyped instead of being filed somewhere wrong.

| Type | Covers |
|---|---|
| `strategy` | What we sell, to whom, what we refuse. Anything a cofounder would want a say in. |
| `technology` | How anything is built, stored, deployed or checked. Reversible by us alone. |
| `business` | Money, structure, people, admin, naming. Anything with a legal or financial edge. |

## What waits on a person

Pending choices live under `## To decide` at the top of the same file, one bullet each, with what it
blocks, who decides, and `(raised YYYY-MM-DD)`. The dashboard reads them under that exact heading,
so it is never renamed. A choice somebody has to make goes here; something nobody knows yet is an
open question, under `## Open questions` in the repo's `INDEX.md`.

**Written down is not raised.** `node packs/company/scripts/open-decisions.mjs` lists these bullets
with how long each has waited, names the ones with no date (a choice nobody has to face by a day is
the one that waits longest), and puts them in front of the session. Bring them to the person who
decides; writing one down again is not raising it.

**A decision taken under a constraint or on a hypothesis carries the day to look again**: a line
`Revisit on YYYY-MM-DD`, with what would change it. Once the day has passed, the same script raises
it. Without the line, nothing says a choice made for want of an access, a budget or a fact is waiting
to be replayed when that changes, and later work builds on it.

**A choice the agent made on a cofounder's behalf goes in as `(proposed)`**: a default picked during
setup, an assumed figure, a design call. It becomes a decision once a cofounder confirms it, under
its date and theirs, or is corrected by a new entry. Several can go to a cofounder at once. The
mechanics (filing, identifiers, mappings) are not such a choice: the agent settles and records them.

## Decided, or noticed?

An observation goes in a journal: the customer's file if it concerns them alone,
`strategy/product/journal.md` if it changes the offer. Most of what comes out of a customer session
is an observation, and writing observations as decisions makes the log untrustworthy. The full
placement table is in `knowledge-consolidation`.

What counts as a decision: a choice between options where somebody could reasonably have chosen the
other; a boundary, something we will not do; a number that constrains later work (a price, a stake,
a team size). A task, a next step or a preference nobody would contest goes in the file it concerns.

## Reopening one

Add a new section with the new date and leave the old one: it explains the files written under it.
Cross-reference both ways.
