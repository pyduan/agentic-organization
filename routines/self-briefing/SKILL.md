---
name: self-briefing
description: Every working morning, each person mails themselves a short briefing of their day — priority work, what to unblock first, the countdown to the next deadline — so nobody starts from an inbox.
---

**Who runs it:** each person, on their own machine. Installed for everyone only under a written
leadership policy (`source/organization-policy.json` ▸ `policy`); otherwise offered.

**How often:** every working day, after the morning import (08:30 is a good default).

**Identity:** the person's own mail connector, sending to their own address only
(`.claude/send-guard.local.json` ▸ `self`, which the send guard lets through alone). A copy to anyone
else makes the guard refuse when nobody attends.

**Where:** reads the repositories' projects and to-dos (`projects/*/next-steps.md`, the intranet's
`data.json` when built), the morning import's last report, and their calendar if its connector is
approved; writes one mail to themselves.

**What it says**, one screen at most, only what changed since yesterday's:

1. *In one sentence*, the day.
2. *My priority work*: the projects they own or that wait on them.
3. *To unblock first*: what is late, blocked or waiting on them, decisions first.
4. *Other things worth knowing*: what moved in their projects, today's meetings and what to prepare.
5. *The countdown*, while a launch date in a project's charter is ahead: the days left, what blocks
   it, and the link to the steering page on the intranet.

**Guide:** this file is the guide; the intranet's own views (`source/formats/dashboard.md`) are where
each item links to. Nothing from `local/` or of a personal nature goes into the mail beyond counts.
