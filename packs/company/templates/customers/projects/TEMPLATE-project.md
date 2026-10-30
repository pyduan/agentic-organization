---
type: project
name: What the engagement is called
slug: company-slug-and-scope
company: company-slug         # must match a file in companies/
status: scoping               # active | scoping | prospect | lead | past
stage: discovery              # discovery | scoping | pilot | delivery | run | closed
owner: firstname
started: 2026-09              # YYYY-MM
updated: 2026-09-16
repo:                         # the customer's repo, if one exists
value: unknown                # contracted value, or unknown
image:                        # /images/projects/<slug>.jpg, 16:9
tags: []
key_facts:
  - What it does, in one line, in terms the customer would recognise.
  - The number it moves, with its date and its source.
  - Where it stands.
milestones:                            # dated events. They feed the capacity timeline.
  - date: 2026-09-16                   # YYYY-MM-DD, or YYYY-MM when only the month is known
    kind: workshop                     # intro | call | meeting | workshop | decision | delivery | seminar | deadline
    text: What happened, one line
next_steps:                            # what really comes next. Tickable on the dashboard.
  - text: One action, starting with a verb
    owner: firstname                   # which cofounder carries it
    waiting_on: Someone outside the company    # optional, leave out when it is ours alone
---

## Summary

What this engagement does and for whom inside the company.

## Where we stand

Stage, what was delivered, what comes next, who carries it.

## Decisions

### Sentence title saying what was decided (YYYY-MM-DD)

What was decided, then why, including what was set aside. Project decisions only: anything that binds
the whole company goes in the central `source/decisions.md`.

## What we learned

What this work taught us, including about the method. Anything generic also belongs in the central
repo's skills.

## People

| Name | Role | Address | In the project | Last contact |
|---|---|---|---|---|

## Journal

### YYYY-MM-DD · kind · title

## Open questions
