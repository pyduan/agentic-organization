---
type: feature
name: Example functional part
slug: example
order: 1
status: spec                  # poc | spec | build | shipped | idea
owner: firstname              # a key of model.owners, or a list
depends_on: []                # the slugs of other features, if this one needs them
summary: One sentence saying what it does, not how. This is what shows on the card.
mockup:                       # /images/features/<slug>.png, or empty for a "to import" frame
updated: 2026-01-01
---

## What it does

Two or three sentences for someone who has never seen the product. What the user gets, not what the
system computes.

## Why it matters

Optional, and often the most useful part. What is particular about this feature: why it is the one
that decides the purchase, or why it is hard, or why it is riskier than it looks.

## Specification

Bullets. Each one checkable: someone must be able to say whether it is done or not.

- An observable behaviour.
- A constraint, with the reason.
- An edge case, and what happens in it.

## What is not decided

The section that justifies this file having its own page rather than an expandable card. It holds the
open questions, and it is the one reread before building.
