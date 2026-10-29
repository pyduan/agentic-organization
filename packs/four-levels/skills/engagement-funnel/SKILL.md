---
name: engagement-funnel
description: "Level 2: map a product's user funnel from first contact to outcome, read its metrics from the operator's own analytics export, and find the stage where people drop. Use when someone says 'build X's funnel', 'where do users drop', 'is X engaging users', 'update the funnel with this export', or asks about activation and retention."
---

# Engagement funnel (level 2)

The method is the playbook's level 2 pages and its infrastructure page (the funnel built backwards
from the outcome), with the `build-user-funnel` and `diagnose-funnel-weak-link` skills of
besci-skills. This recipe keeps the funnel as a file and its readings as dated evidence.

## Where it lives

`<productsPath>/<product>-funnel.md`, beside the status file, or inside the product's folder. It
holds:

- the stages, from the output of `build-user-funnel`: for each one, what the programme does, what
  the person must do, the metric that confirms it, its target, and who owns it;
- the guardrail metrics paired with engagement (over-reliance, repeated confusion), because the
  playbook names engagement on its own as a trap;
- a readings table, one row per export read: `date | stage | value | denominator | source`, the
  source being the export's name and date. Rows are added, never rewritten.

## Steps

1. Build the funnel with `build-user-funnel` if the product has none. Agree the stages with whoever
   runs the product; the playbook's level 2 uses digital traces only, so surveys and interviews wait
   for level 3.
2. Ask for the export the operator already produces (an analytics tool, a messaging platform's
   dashboard, a warehouse query). Read it; never ask for person-level rows when an aggregate per
   stage answers the question. If person-level rows are all there is, they go to `dataPath`.
3. Add the readings. Compute each transition rate from the two counts, and keep the denominator in
   the row: a rate with no denominator cannot be checked.
4. Where the drop is largest, run `diagnose-funnel-weak-link` and file its hypotheses under the
   funnel. A hypothesis worth testing goes to `design-evidential-experiment`.
5. Add the evidence line under level 2 of the status file. The minimum viable evaluation for level 2
   (events instrumented, activation and retention tracked, at least one A/B test) is read on the
   playbook's MVE page the day the status moves.

When engagement stays weak, the playbook advises a process evaluation before moving to level 3,
including the offline parts of the programme (trainings, field support). Say so rather than moving on.
