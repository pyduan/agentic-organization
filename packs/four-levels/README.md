# four-levels: the four-level AI evaluation, run as a routine

The four-level framework asks four questions of an AI product for a social outcome: does the AI
system perform as intended (model), does the product engage and retain users (product), does it
change what users think, feel, know and do (user), and do users with access improve development
outcomes (impact). Its authors publish the method as a living playbook, eval.playbook.org.ai, and
publish skills that run parts of it.

**This pack is an operating layer over their work.** It does not restate the method and it does not
copy their skills. It imports them at a pinned commit and adds what an organization needs to run the
framework every month across many products: a record, a gate, and a report.

## What it adds

| | Without the pack | With it |
|---|---|---|
| Where a product stands | in a slide, a spreadsheet, someone's memory | one status file per product, each level with dated evidence lines (`formats/status.md`) |
| The readiness rule | remembered, or not | `scripts/levels.mjs` refuses a level 4 started before levels 1 to 3 met their minimum, and a status with no evidence |
| Which skill to run when | known to whoever wrote them | a routing table in `skills/four-levels/` |
| Outcomes and agent versions | joined by hand, if at all | `scripts/join-versions.mjs` attributes each outcome to the versions the person used, refuses to write person-level rows where Git tracks them |
| The portfolio view | rebuilt for each convening | `skills/level-report/`, one dated report per cluster, its table generated |

The skills:

- `four-levels`: where a product stands, what it is ready for, and which skill does the next task.
- `eval-dataset`: level 1, the golden dataset and its runs per agent version.
- `engagement-funnel`: level 2, the funnel as a file and the operator's exports as dated readings.
- `outcome-join`: levels 3 and 4, the version log and the join of outcome data to versions.
- `level-report`: the report by level per cluster or portfolio.

## What it calls, and their licences

`sources.json` lists every upstream source with its commit, its licence as read on 2026-10-29, and
whether the imported copy may be committed:

- **The AI Evaluation Playbook's guide skill** (`IDinsight/ai-eval-playbook`, branch
  `introduction`), and the playbook's `llms.txt`. No licence is stated, so the import keeps them on
  the importing machine and out of Git. The skills of this pack read the live playbook pages for
  every substantive answer, as the guide skill itself asks.
- **The Behavioral Science Skills Library** (`agency-fund/besci-skills`, The Agency Fund and
  Irrational Labs): `choose-ai-eval-level`, `design-golden-dataset`, `build-user-funnel`,
  `diagnose-funnel-weak-link`, `design-evidential-experiment`, `plan-evaluation-design`,
  `write-pre-analysis-plan`, `estimate-sample-size`. Content CC BY 4.0, code MIT: the import may be
  committed, with the attribution its `LICENSE-CONTENT.md` asks for.
- **Two skills from `agency-fund/taf-skills`**: `ask-agency-measurement` (agency as the level 3
  guardrail) and `calibrate-workshop` (aligning an LLM judge with human raters). No licence is
  stated: local import only, unless the installing organization owns them.

## Install

1. Copy `packs/four-levels/` into the repository.
2. `cp settings.example.json settings.json` and set the paths if yours differ. `dataPath` must be
   gitignored: add it to the root `.gitignore` before anything goes in it.
3. `node packs/four-levels/scripts/import-upstream.mjs`, then `--status`.
4. Ask: *"Start tracking <product> on the four levels"*, or *"Where does the <cluster> cluster stand
   on the four levels?"*

## Updating the upstream sources

Their authors update them. To follow, change the `ref` in `sources.json` to the commit you want,
read the upstream diff, run the import, and commit `sources.json` with a line saying what changed.
A change you would make to one of their skills is proposed to them, against their repository.

## What it does not do

It does not judge a product, recommend funding, or design an evaluation on its own: the design comes
from the upstream skills and the people running them. It keeps person-level data out of Git and
sends nothing to anyone.

## Credits

The four-level framework is by Han Sheng Chia (Center for Global Development), Samantha Carter
(J-PAL), Farhan Abrol, Temina Madon, Robert On, James Walsh and Zezhen Wu (The Agency Fund),
first published on 2025-04-15 (theagencyfund.substack.com/p/an-ai-evaluation-framework-for-the).
The AI Evaluation Playbook is stewarded by The Agency Fund, IDinsight and the Center for Global
Development, with a technical working group convened by CGD. The skills it calls are credited to
their authors in each imported folder's `PROVENANCE.json`. Feedback on this pack goes against its id
in `pack.json`; feedback on the method goes to the playbook (ai-eval-playbook@idinsight.org, or a
pull request on `IDinsight/ai-eval-playbook`).
