# Decisions, hypotheses & positioning log

The project's living memory: how the **hypotheses** (the model, the numbers, the plan) and the
**positioning** (the story, the strategy) evolve, and **why** — each change tied to the discussion
that drove it, whether internal (the owner, the team, the board) or external (an investor, a
partner, a big customer meeting). Keep this so nobody re-litigates settled debates, the reasoning
survives the people who were in the room, and a newcomer can see how you got here.

This is different from `brief.md`: the brief is **where things stand now**; this file is **how they
got there**. And it's different from `content/` and `facts/`: those hold the current numbers and
sourced figures; here you keep the *decision and its reason*, not the recomputation.

## What "settled" obliges

The point of the file is not the archive, it is the silence afterwards. An entry here is a
**premise for every later session**, not a topic that stays open because a fresh pair of eyes would
have chosen otherwise.

So, concretely, once something is recorded here:

- **Do not raise it again** as "have you considered", "one option would be", or a list of
  alternatives that were already weighed. The owner should not have to win the same argument twice.
- **Do not weaken a confirmed fact.** If the owner confirmed a figure, a title or a claim, state it
  plainly. Do not re-add a hedge, a "to be confirmed", or a "per the owner" aside on a later pass,
  and do not resurface it as an open question. Thin third-party sourcing is normal for a small
  organization's own facts and is not grounds for doubting the owner about their own life or work.
- **Reversal is allowed, silence is not.** New information, a changed constraint or the owner
  changing their mind all justify re-opening — as a new dated entry that says what changed and why.
  Never edit the old entry away.

The mirror obligation is on the writing side: **a decision taken in conversation and left unwritten
will be re-litigated.** Record it the day it is taken. That is the whole mechanism.

## How to use it

- **After any discussion that moves a hypothesis or the positioning, add an entry at the top**
  (newest first). Little discussions that change nothing don't need an entry; a changed assumption,
  a reframed pitch, a dropped or added bet do.
- Entry format: a dated heading with the source of the discussion, then bullets tagged
  **[Positioning]** or **[Hypothesis]**, each stating the **before → after** and the **why**.
- Point to detail rather than duplicate it: granular numbers live in `content/` (and its changelog
  if it has one); wording lives in the site/decks; here you keep the decision and the reason.
- When a later decision reverses an earlier one, say so in the new entry (don't silently delete the
  old one) — the reversal and its reason are part of the history.

## 2026-08-28 · internal — ORGANIGRAM.md is a chart of people, not a map of repos

**Paul's call.** The file was written as "your organization's repos, and who may do what", and its
load-bearing content became the repo table that three scripts parse. That is not what it was for:
it should be an **organigram of people**, so that teammates can collaborate on Git with the rights
written down. The second organization running this kit already does it that way, and that is the
convention to follow: rights and roster in `ORGANIGRAM.md`, the repo map in the routing table of
`CLAUDE.md`.

Two properties it has to keep, because they are what makes it usable rather than ceremonial:

- **Instantiated by default at first setup**, so nobody has to decide to create it.
- **Correct from day one with a single maintainer**, and rights added progressively as people
  arrive. The reference case is `huguescharnallet`, which started as one maintainer and is three
  people today.

**What this obliges, and is not done yet.** The repo map has to move to `CLAUDE.md`, and the three
independent parsers of the old table follow it: `scripts/check-workspace.mjs`,
`scripts/todo-sources.mjs`, `scripts/dashboard-data.mjs`. Eighteen files mention `ORGANIGRAM` today.
Deliberately not swept in the same change as the check-scoping commit: this template is inherited by
other people's repos, and a hasty rename across eighteen files is how one of them breaks silently.

## 2026-08-26 · internal — building the to-dos app

- **[Hypothesis] One implementation of the client logic, two front ends.** Before → after: each
  front end owned its own copy of the due presets, the prompt builder and the edit queue; now they
  are `lib/todo-client.mjs`, tested, and a front end is markup over it. Why: the parts that are
  easy to get subtly wrong (which ISO week today is, whether a failed batch leaves the queue stuck)
  are identical in both, and a bug fixed in one would have survived in the other. It also stops the
  framework question — Astro island or a hand-written page with no build — from being a fork.
- **[Hypothesis] The app derives its projects from `ORGANIGRAM.md`, it does not keep a list.**
  Before → after: `TODO_SOURCES` was a hand-written second list of repos and paths; it is now
  generated by `scripts/todo-sources.mjs`. Why: the kit's own rule is one map of the workspace, and
  the dashboard already follows it. A second list would have described last month within a
  fortnight. It also absorbs the topologies people actually have rather than prescribing one.
- **[Hypothesis] An upgrade is a three-way merge, not a copy.** Before → after: `update-kit` ran
  `git checkout template/main -- <paths>`, which cannot tell "the kit changed this" from "the owner
  changed this"; `.kit-sync` now records the baseline and `scripts/kit-sync.mjs` refuses to touch a
  file both sides edited. Why: confirmed on a live project whose publish skill carried its own
  deploy notes and would have lost them on the next upgrade.
- **[Positioning] The template carries no real data, ever.** Before → after: examples were taken
  from a live project and pushed to this public repo; they are invented now, and `CLAUDE.md` carries
  the rule. Why: a name, a client or an internal project code in a public template is real
  information about real people, and sessions here always have other repos open.

## Template for a new entry

```
## YYYY-MM-DD · <source of the discussion: internal / <investor> / <partner> …>

- **[Positioning]** <what changed> — before → after. Why: <the reason from the discussion>.
- **[Hypothesis]** <what changed> — before → after. Why: <the reason>. Detail: <pointer to content/…>.
```

---

<!-- Newest entry on top. Seed the first real one during setup or after the first decision. -->

## YYYY-MM-DD · TODO — first entry

- **[Positioning]** TODO: the first framing decision and why.
- **[Hypothesis]** TODO: the first assumption that moved, and why.
