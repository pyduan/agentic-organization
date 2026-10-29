---
name: four-levels
description: "Where an AI product stands on the four evaluation levels (model, product, user, impact) and what it is ready for next, kept in one status file per product with its evidence. Routes each evaluation task to the published skill that does it. Use when someone asks 'where is X on the four levels', 'is X ready for an RCT', 'what should X evaluate next', 'update X's evaluation status', 'start tracking X's evaluations', or names a level. For the report across a cluster, use level-report."
---

# Four levels

The framework and its method belong to their authors: the AI Evaluation Playbook
(eval.playbook.org.ai) and the skills published around it. This skill keeps the record of where each
product stands, applies the playbook's readiness rule, and hands each task to the skill that does
it. When this file and the playbook disagree, the playbook wins and this file is corrected.

## Before anything

- `node packs/four-levels/scripts/import-upstream.mjs --status`. If a source is missing, run the
  import (`--only <id>`); if it fails, say so and work from the live playbook pages only.
- Read `settings.json` (or `settings.example.json`) for where status files live.
- For any substantive answer, read the live playbook page for the level in question (the index is
  `upstream/playbook-index/llms.txt`; every page is served as Markdown by appending `.md`), and
  cite its URL with the date read. The imported guide skill
  (`upstream/playbook-guide/skills/ai-eval-playbook-guide.skill.md`) is a map of those pages; its own
  rule is that the live page wins over its summaries, and some of them have drifted.

## Where does X stand

1. Open the product's status file in `productsPath` (format: `formats/status.md`). None yet: create
   it with every level `unknown`, and fill from what the repository already holds before asking.
2. Run `node packs/four-levels/scripts/levels.mjs`. Report the statuses, the evidence behind each,
   the findings, and the date of the file. A status with no evidence line is a claim, and say so.
3. For "what next", run `choose-ai-eval-level` (besci-skills) on the product, giving it the status
   file and the funnel map if there is one. Write its verdict into the file as a dated line under the
   level it concerns, with the skill and version it came from.

## Moving a level

A status changes only with evidence: a dated line `date · what was found, with its figure · where it
is`, under the level's section. Then rerun `levels.mjs`; it refuses `mve-met` without evidence and a
level 4 that starts before the gate (below). Never edit the status to make the check pass.

**The readiness gate.** Levels 1 to 3 may run in parallel. Level 4 starts only when levels 1, 2 and
3 have met their minimum and the playbook's three conditions hold: consistent evidence from levels 1
to 3, scale-up under consideration by major partners, bandwidth to work with independent
researchers. When someone asks for an impact evaluation before that, say which condition is
missing and what would meet it, citing the level 4 overview page. A funder asking for it early is the
case the playbook's resources for funders address: point to them.

**A new agent version** sends level 1 back to `in-progress` until the golden dataset has been rerun
on it, and gets a line in the product's version log (`outcome-join`).

## Which skill does the work

| The task | Run | Then write |
|---|---|---|
| Which level next, are we ready for an RCT | `choose-ai-eval-level` (besci-skills) | the verdict under the level, dated |
| Level 1: build or extend the test set | `eval-dataset` (this pack), which calls `design-golden-dataset` | `evals/<product>/golden/`, evidence under level 1 |
| Level 1: align an LLM judge with human raters | `calibrate-workshop` (taf-skills), when imported | the agreement figure under level 1 |
| Level 2: the funnel and its metrics | `engagement-funnel` (this pack), which calls `build-user-funnel` and `diagnose-funnel-weak-link` | the funnel file, evidence under level 2 |
| Level 2 or 3: an A/B test | `design-evidential-experiment` (besci-skills) | the experiment's file, linked under the level |
| Level 3: outcome and guardrail metrics | `plan-evaluation-design` (besci-skills), and `ask-agency-measurement` (taf-skills) for agency as the guardrail | the measurement plan, linked under level 3 |
| Level 3 or 4: outcomes by agent version | `outcome-join` (this pack) | aggregates only, under the level |
| Level 4: analysis plan and power | `write-pre-analysis-plan`, `estimate-sample-size` (besci-skills) | the plan, linked under level 4 |
| A report across products or a cluster | `level-report` (this pack) | `reportsPath/<date>-<cluster>.md` |

Run an upstream skill by reading its `SKILL.md` under `upstream/` and following it, with this
repository's files as its inputs. Credit it in what you write: title, version, authors, and the
licence line in its folder's `PROVENANCE.json`.

## What this skill does not do

It does not decide whether a product is good, whether to fund it, or whether to scale it. It records
what evidence exists and what the playbook says that evidence supports. Person-level data never
enters the repository (`outcome-join` ▸ *Data*).
