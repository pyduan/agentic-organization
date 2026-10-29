# A participant's file

One file per organization (or person, for a fellowship) a programme serves, in `participantsPath`:
a grantee, a cohort member, a portfolio organization. It is where everyone on the team reads what
happened with them, and it may carry other sections a pack adds (the four-level evaluation status,
for instance) without either one editing the other's part.

```markdown
---
name: Example Advisory
kind: grantee                # grantee | cohort | alumni | applicant
cohort: 2026                 # optional
owner: "@sam"                # who on the team holds the relationship
country: Kenya
url: https://example.org
updated: 2026-10-29
---

## Who they are

What they do, for whom, through which channel. Public facts carry their URL and the date read.

## What we support

The grant, the embedded support, the sessions. Amounts and terms live where the organization keeps
them (a restricted repository, the grants system); here only what the team needs to act.

## Journal

- 2026-10-29 · office hours on their funnel: onboarding loses half of new users at the language choice; they will test a voice prompt · notes/2026-10-29-example-advisory.md
```

Journal lines are newest first, one line each: date, what happened, where the rest is. The detail
lives in the notes file or the document the line points to.
