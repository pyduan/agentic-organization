---
name: programme
description: "Run a programme the organization offers to others (an accelerator, a fellowship, a cohort, a grantee support programme) from its handbook: the cohort, one file per participant with its journal, session write-ups, the weekly announcement, alumni. Use when someone says 'write this week's announcements', 'write up office hours with X', 'add the new cohort', 'what has X done in the programme', 'update the handbook', or imports the programme's existing handbook."
---

# Programme

The programme's rules live in `programmePath`, the people and organizations it serves in
`participantsPath`, one file each (`formats/participant.md`). An agent that reads the handbook
answers the way the team would, and one that writes every session into the participant's journal
lets anyone on the team pick up where the last person left.

## Layout

```
<programmePath>/
  handbook.md             the rules participants follow and the team applies: timeline, sessions, what is expected
  cohorts/<year>.md       who is in it, with links to their files, and its calendar
  sessions/<date>-<kind>.md   a group session's notes (a workshop, a demo day)
<participantsPath>/<slug>.md   one per organization, its journal newest first
```

## Importing an existing handbook

The handbook usually exists elsewhere (a wiki, a shared drive). Import it once: one Markdown file per
page, the source and date at the top, then show the result. From then on, this folder is the
handbook, and the old copy is read only.

## Recurring work

- **A session with one participant** (office hours, an advisory call): `meeting-notes` on the
  transcript, then a journal line in the participant's file and the actions with owners.
- **The weekly announcement**: from the handbook's timeline, the cohort calendar and what the
  sessions decided. Drafted, then sent by a person on the channel they choose.
- **A new cohort**: `cohorts/<year>.md`, then a file per participant from their application and their
  own public pages, each fact with its source.
- **Alumni**: the file stays, `kind: alumni`; what they do after the programme keeps going in the
  journal.

## Evaluation

When participants build AI products and the organization follows their evidence, the `four-levels`
pack adds an evaluation status to the same participant file. The two sections live side by side.

## What stays out

Application scores, selection debates and anything said in confidence about a participant stay out
of files the whole team or the participant may read: the organization's restricted space, or nowhere.
