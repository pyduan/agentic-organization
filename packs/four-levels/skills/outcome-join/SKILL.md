---
name: outcome-join
description: "Levels 3 and 4: join the outcome data an operator already collects (surveys, tests, field visits, administrative records) to the agent version each person actually used, and keep the version log that makes it possible. Use when someone says 'join these outcomes to the agent versions', 'which version did these users see', 'log a new agent version', 'prepare the data for the impact evaluation', or hands over an outcome export."
---

# Outcome join (levels 3 and 4)

An AI product changes while it is evaluated. The playbook's level 4 design page calls this product
dynamism and asks for version tags, frozen holdouts and pre-specification. None of that works unless
every outcome can be traced to the versions the person used before it was measured. This recipe
keeps the version log and runs the join; the analysis itself follows the evaluation design
(`plan-evaluation-design`, `write-pre-analysis-plan`).

## The version log

`<productsPath>/<product>-versions.md`, a table appended to on every change, never rewritten:

| Version | Live from | What changed | Layer |
|---|---|---|---|
| v3 | 2026-09-01 | new retrieval corpus for the dry season | model |

`Layer` is one of model, product, delivery (a change to the trainings or the field protocol counts:
the playbook asks for every change to be logged). The status file's `version` is the latest row. The
agent's own logs must carry the same version string on every session; if they do not, that is the
first thing to fix, and the join cannot run until it is.

## Data

Outcome and exposure rows are about people. They stay in `dataPath`, which Git ignores, on the
machine of whoever is allowed to hold them; the script refuses to write its output anywhere Git
tracks. What enters the repository is aggregates: counts per version, the mixed count, the gaps.

## The join

```sh
node packs/four-levels/scripts/join-versions.mjs \
  --exposures local/eval-data/<product>/exposures.csv \
  --outcomes  local/eval-data/<product>/outcomes.csv \
  --out       local/eval-data/<product>/joined.csv
```

`exposures.csv` is one row per session or message from the agent's logs (`person_id, timestamp,
version`); `outcomes.csv` is the operator's export with `person_id` and `measured_at`. Other column
names are mapped with `--person`, `--time`, `--version`, `--measured`. The two files must share the
person identifier: if the operator's data uses another one, the mapping between them is a separate
file in `dataPath`, and building it is a step the evaluation design names.

The script prints, and the evidence line quotes: outcomes per single version, people exposed to
more than one version (`mixed`), outcomes with no exposure before them, and exposed people with no
outcome. Mixed rows are kept and flagged; how they are treated is decided in the analysis plan
before any outcome is read.

## Then

Add an evidence line under level 3 or 4 of the status file: the date, the export's name and date,
the aggregates. A level 4 status file must carry `version`, which `levels.mjs` enforces.
