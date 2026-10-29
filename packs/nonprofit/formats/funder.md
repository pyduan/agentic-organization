# A funder's file

One file per funder, donor or prospect in `fundersPath`, named by a short slug
(`example-foundation.md`). Copy the block below, never a neighbour's file: a copied file carries the
neighbour's stale fields.

```markdown
---
name: Example Foundation
kind: funder                 # funder | donor | prospect
stage: active                # prospect | applying | active | renewal | closed | declined
owner: "@sam"                # who holds the relationship
next_action: interim report
next_deadline: 2026-12-01    # YYYY-MM-DD, or empty
updated: 2026-10-29
---

## Who they are

What they fund, how they decide, who we deal with and their role. Public facts carry their URL.

## What we committed to

| Commitment | Indicator or amount | Due | Where it was agreed |
|---|---|---|---|
| Reach 2,000 farmers in year one | farmers with one completed advisory session | 2027-06-30 | grant agreement, schedule B |

## Figures we sent them

Every figure that left this organization for this funder, verbatim, in the order sent. Read this
table before sending them anything new.

| Date | Figure, as sent | In what | Its source in our files |
|---|---|---|---|
| 2026-09-15 | "1,240 farmers completed at least one session" | interim report, p.2 | source/content/programme-figures.md, row of 2026-09-01 |

## Tone

What works with them and what does not, learned from exchanges, each line dated.

## Journal

- 2026-10-29 · call with the programme officer: the interim report moves to December · notes/2026-10-29-example.md

## Open calls

- Example Foundation climate call · deadline 2027-01-15 · https://example.org/call · reading
```

## Rules

- **The figures table is written when the figure leaves**, by the person who sent it or by the
  agent once that person confirms it went. A figure that is in a sent document and not in this
  table is the gap this file exists to close.
- **A figure keeps the words it was sent with.** "1,240 farmers completed a session" and "1,240
  farmers reached" measure different things; the next report says which one it continues.
- **Kinds.** An individual donor's personal details (address, giving history, wealth) do not belong
  in a repository many people read. Keep them in the donor database the organization already runs,
  and here only what the team needs to know to act, with the person's consent where the law asks for it.
- `node packs/nonprofit/scripts/nonprofit.mjs check` refuses a figure row with a missing column, a
  stage outside the list, and a deadline that is not a date.
