---
type: company
name: Legal or trading name, as they write it
slug: same-as-the-filename
status: lead                  # the keys of model.statuses, in config.mjs
owner: firstname              # a key of model.owners, or a list
industry: What they make or sell, one line
sector: industry              # the keys of model.families. Sets the bar's colour.
employees: unknown            # integer, or unknown
revenue: unknown              # "EUR 66.6M (2024, company website)", or unknown
hq: City, region, country
website: https://
intro: direct                 # direct, or the name of whoever introduced us
since: 2026-01                # first contact, YYYY-MM
updated: 2026-01-01           # last time a human checked this file
image:                        # /images/companies/<slug>.jpg, 16:9, or empty
tags: []
key_facts:
  - Three to five lines. Each one a fact, with a subject and a verb.
  - "This is what shows on the card, so the only part most people read. A bullet containing \": \" goes in quotes, or YAML reads it as a map."
contacts:
  - name:
    role:
    email:
    note:
milestones:                            # dated events. They feed the capacity timeline.
  - date: 2026-01-01
    kind: meeting                      # intro | call | meeting | workshop | decision | delivery | seminar | deadline
    text: What happened, one line
---

## Summary

What this company does and why it is on our list. Four to eight lines, for a cofounder who has never
heard of it.

## Where we stand

The state of the relationship today. What is agreed, what is not, the next step and who carries it.

## What we learned

What is true of this company and would take another meeting to rediscover. Their constraints, their
vocabulary, who really decides, what they have already tried.

## People

| Name | Role | Address | In the relationship | Last contact |
|---|---|---|---|---|

## Journal

### YYYY-MM-DD · kind · title

Who was there, what was said, what came out of it. Kinds: `call`, `meeting`, `workshop`, `mail`,
`intro`.

## Open questions

What we do not know, and who could answer.
