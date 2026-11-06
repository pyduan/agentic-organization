---
name: morning-import
description: Every working morning, what arrived since yesterday in the person's own mailbox and files goes into the repositories, read-only on the sources, so everyone's view stays the same.
---

**Who runs it:** each person, on their own machine, under their own accounts. Installed for everyone
only when the organization's leadership decided so in writing (`source/organization-policy.json` ▸
`policy`, `routines/README.md` ▸ *Offered, never installed on its own*); otherwise offered, and
installed on a yes.

**How often:** every working day, early (08:00 is a good default), before the self-briefing.

**Identity:** the person's own mail and drive connectors, for the scope their row in `CONNECTORS.md`
approves. Nothing else.

**Where:** reads their mailbox and drive since the last run (`.claude/machine.local.json` ▸
`morningImport.since`); stages in the gitignored `local/`; writes to the repositories the backfill
recipe names.

**Guide:** `.claude/skills/backfill/SKILL.md`, the same method on one day's material: *Sources*,
*What to extract*, *Where it goes*, *Working safely*. Run it in auto mode.

**Limits, held by the hooks when nobody attends** (`CLAUDE_CODE_SESSION_ATTENDED=0` in the task):
the sources stay read-only (no label, no move, no reply); no message except one to the person's own
address; no push from a restricted repository (`restrictedRepos`), which waits committed locally for
the person's next session; no personal data anywhere. What no rule settles goes to their list to
decide, never into a shared repository.

**Its report:** one dated file in `local/morning-import/runs/`: what was read (counted), what went
where, what was skipped and why. A run that read nothing says so; a run that skipped half its sources
does not say "done".
