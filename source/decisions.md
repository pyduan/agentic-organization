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
