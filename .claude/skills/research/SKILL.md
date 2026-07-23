---
name: research
description: "Look something up and bank it as a sourced fact, or run a recurring watch on a topic. Use when the owner asks Claude to find numbers/stats/evidence on something, research a topic, or keep an eye on a subject over time."
---

# Research

Finds facts worth citing (a stat, a benchmark, a study, a competitor's number) and banks them in
`source/facts/` with a real source attached, so the next page, post, or deck can cite them
precisely instead of re-Googling or misremembering. This is **not** where the owner's own facts
go (bio, prices, dates — those are `source/content/`, see its own README): this skill is for
things *other people* found, that are worth citing.

## Check relevance first

Read `source/facts/README.md`'s **"What counts as a useful fact here"** section, and the themes in
**`source/facts/methodology.md`**, before researching anything. Both are personalized per project
(filled in during setup) and exist so this folder doesn't fill up with generic internet noise —
only bank what actually matters for this project. If either is still a TODO (setup hasn't
personalized it yet), ask the owner what kinds of external facts would be useful before running a
broad search.

## One-off: banking a fact already in hand

The owner spotted something in a meeting, an article, a conversation — "I heard 40% of galleries
now sell online, can you find where that's from?" Verify the actual source (don't take a
paraphrase at face value), then file it per the convention below.

## Running a research pass

The owner wants the landscape on a question ("what's the evidence that X helps Y?", "how do
competitors price this?"). Use whichever web tools you have available (search + fetch) to find
real, checkable sources — not a single blog post repeating a stat with no origin. For each
candidate fact:

- Trace it to its **original source** (the actual report/study/page), not a secondary summary.
- Note the **exact figure, its context, and where exactly it appears** (a URL, or a document name
  + page number).
- Prefer a source that itself cites its methodology over one that doesn't.
- If a fact can't be traced to something checkable, don't bank it — say so instead of guessing.

## Convention

One file per topic or source in `source/facts/`, e.g. `2026-sector-report.md`,
`competitor-pricing.md`. Each fact gets:

```
| Figure | Context | Source |
|---|---|---|
| 40% | of small galleries in France now sell online, per a 2026 CGA survey | cga.fr, survey PDF, p.3 |
```

Flag anything needing a check before it goes public with `<!-- verify before use -->`. Never blend
a banked fact with the owner's own numbers from `source/content/` without making clear which is
which — a page or deck that cites both should make the distinction obvious to the reader.

## Recurring watches (if the owner wants one)

Some topics are worth checking periodically rather than once (a competitive landscape, a sector
that publishes reports regularly). The watch is **driven by `source/facts/methodology.md`** — the
brief that says what themes to deep-search, where to look, and how. It's a search over *themes*,
not a list of sites to poll; a named source is only ever an example of where a hit came from. Read
that file (and personalize it if it's still a template) before running or scheduling a watch.

If the owner asks for this ("keep an eye on X, let me know if something new comes up"), offer to
**schedule** a recurring pass (the `schedule` skill / scheduled-tasks, if available in this
environment) rather than relying on them to remember to ask again — e.g. a weekly deep-search every
Friday at noon. The scheduled run reads `methodology.md` fresh each time, so editing that file
changes what the watch covers, no rescheduling needed. A pass that finds nothing new banks nothing;
it's not obligated to produce a file every time it runs.

## Never invent

Same rule as everywhere else in this kit: a number with no real source isn't usable. If nothing
checkable turns up, tell the owner that, rather than filing a plausible-sounding guess.
