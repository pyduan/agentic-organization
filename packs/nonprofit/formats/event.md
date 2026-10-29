# An event's file

One file per event in `eventsPath`, named `YYYY-MM-DD-slug.md` by the event's first day, or
`undated-slug.md` while no date is announced. Full year first, so sorting by name sorts by date.
Nothing is deleted when an event is over: it moves to `stage: done`, so a reader can tell "never
tracked" from "over".

```markdown
---
name: Example Summit on Digital Public Goods
start: 2026-11-18            # first day; empty only for an undated- file
end: 2026-11-19
city: Lisbon
url: https://example.org/summit
fit: 2                       # 1 strong, 2 worth it, 3 weak
stage: evaluating            # watching | evaluating | pitched | confirmed | declined | done | dropped
presence: none               # speaking | attending | none
people: []                   # who goes, as handles
owner: "@sam"                # who owns the next action
next_action: ask the organisers about the panel line-up
next_action_due: 2026-11-04
cfp_deadline:                # YYYY-MM-DD when there is a call for speakers
---

## Why it fits

The audience, the theme, the angle. Say plainly when the fit is weak.

## Where we stand

- 2026-10-20 · invitation received from the organisers, forwarded by @sam

## Contacts

## Next steps
```

## Rules

- **Three doors in**: a watch finds it (`stage: watching`), someone is invited, or the team decides to
  go. An invitation accepted becomes a file the same week.
- **The stage is the state of the relationship, read in the mail thread.** A planning card or a
  colleague's intention to ask is not `pitched` and not `confirmed`. When the only source is a plan,
  the stage is `watching` or `evaluating`, and the frontmatter says so.
- `nonprofit.mjs check` refuses a dated name whose `start` disagrees with it, an `undated-` file with
  a `start`, and a stage outside the list.
