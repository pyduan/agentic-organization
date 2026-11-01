# The status file: one product, four levels, and the evidence for each

One Markdown file per AI product, in `productsPath`. It says where the product stands on each of
the four levels of the AI Evaluation Playbook and, for every claim, the evidence and where it came
from. An organization with one product has one file; an organization with two has two, or a folder
with one file per product. The file may also carry other sections (a relationship journal, notes from
a programme): `levels.mjs` reads the frontmatter and the four level sections and ignores the rest.

## Frontmatter

Flat keys only, so a person can edit it and a script can read it without a YAML library.

```yaml
---
name: Example Advisory              # the organization
product: Farmer advice chatbot      # the AI product this file is about
cluster: agriculture                # optional, a file name in clustersPath without .md
owner: "@sam"                       # who keeps this file current
updated: 2026-10-29                 # the day the levels were last checked against their evidence
version: v3                         # the agent version in production today
l1: mve-met                         # model: does the AI system perform as intended?
l2: in-progress                     # product: does the product engage and retain users?
l3: not-started                     # user: does it change thoughts, feelings, knowledge, behaviour?
l4: not-started                     # impact: do users with access improve development outcomes?
l4_ready:                           # only when l4 moves: the three readiness conditions, met (see below)
---
```

A level's status is one of:

| Status | Means |
|---|---|
| `unknown` | nobody has looked yet. The honest default for a seeded file |
| `not-started` | looked, and no evaluation at this level exists |
| `in-progress` | an evaluation at this level is running or being designed |
| `mve-met` | the playbook's minimum viable evaluation for this level is met, with evidence below |
| `not-applicable` | this level does not apply, and the section says why |

There is no "passed". The playbook treats evaluation as cyclical, so a level that met its minimum
can fall back when the product changes: a new agent version sends `l1` back to `in-progress` until
the golden dataset has been rerun on it.

## Body

One section per level, in this order and with these headings, each holding dated evidence lines:

```markdown
## Level 1 · model

- 2026-09-12 · golden dataset of 42 items, accuracy rubric 81%, safety rubric 97%, thresholds agreed with the product owner on 2026-08-30 · evals/example/golden/README.md
- 2026-10-02 · LLM judge aligned with two human raters on 150 pairs, agreement 0.84 · evals/example/judge-alignment.md

## Level 2 · product

- 2026-10-20 · funnel defined, activation and retention instrumented, weekly export from the analytics tool · products/example-funnel.md

## Level 3 · user

## Level 4 · impact
```

An evidence line is `date · what was found, with its figure · where it is`. The place is a file in
this repository or a public URL; a figure nobody can trace back is not evidence. A level marked
`mve-met` must carry at least one evidence line, and `levels.mjs` refuses it otherwise.

## The readiness gate

The playbook's sequencing rules, as the check applies them:

- **Levels 1, 2 and 3 may run in parallel**, and the check allows it. It warns, without failing, when
  level 2 runs while level 1 has not met its minimum (the playbook: agree thresholds, pass them,
  then ship), and when level 3 runs while level 2 has not (progress to level 3 if engagement holds;
  diagnose a weak funnel with a process evaluation first).
- **Level 4 waits.** `l4` may be `in-progress` or `mve-met` only when `l1`, `l2` and `l3` are all
  `mve-met`, and `l4_ready` names the playbook's three conditions as met: evidence from levels 1
  to 3 is consistent, scale-up is being considered by major partners, and the team has the bandwidth
  to work with independent researchers. Anything else fails the check. This is the rule that stops an
  impact evaluation being commissioned before the product is ready for one.

The gate encodes the playbook's pages as read on 2026-10-29 (the overview of each level, the FAQ
and *Minimum Viable Evaluations*). When the playbook changes its sequencing, change the gate to
match and say so in the pack's history.

## Versions

`version` is the agent version in production. Every change to the AI system, the product or the
delivery gets a version and a line in the product's version log, because the outcome join of
levels 3 and 4 (`outcome-join`) attributes each person's outcome to the versions they used. A
product with no version log cannot run a level 4 evaluation the playbook would accept.
