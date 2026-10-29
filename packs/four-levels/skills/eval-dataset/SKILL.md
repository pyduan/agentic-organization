---
name: eval-dataset
description: "Level 1: build, extend or rerun a product's golden dataset (the test set its answers are scored against), with experts writing the reference answers and every item traceable to where it came from. Use when someone says 'build a test set for X', 'add these cases to the golden dataset', 'rerun the evals on the new version', 'how good is X's model', or a new agent version needs checking."
---

# Eval dataset (level 1)

The method is the playbook's level 1 pages (rubric, metrics, golden dataset, scoring and error
analysis, automation, red-teaming) and the `design-golden-dataset` skill of besci-skills. Read both
before starting; this recipe only says where things go and what the repository checks.

## Where it lives

```
evals/<product>/
  README.md          what the set covers, the rubric, the thresholds and who agreed them, dated
  golden/items.csv   one row per item: id, input, reference, source, written_by, added
  runs/<date>-<version>.md   one file per run: the version scored, the scores per rubric, the failures read
  judge-alignment.md  if an LLM judge scores the set: the human agreement figure and the pairs it was measured on
```

The items file may hold real user messages only once personal data is stripped and the organization's
policy allows it; otherwise it lives in `dataPath`, gitignored, and `golden/README.md` says so.

## Steps

1. Run `design-golden-dataset` on the product, with its status file as the product account. Keep
   its output as `evals/<product>/README.md`.
2. **Reference answers are written by a domain expert from scratch.** The playbook warns that an
   expert asked to correct an LLM draft skims and accepts it. `written_by` names the person; an item
   whose reference came from a model says `model, unreviewed` and is left out of scoring until a
   person has rewritten it.
3. Every item carries its `source`: a past transaction (anonymised), a human annotation, a public
   dataset with its URL. Cover the user modes the product meets (voice, code-switching, misspellings,
   out-of-scope requests), and say in the README which ones are missing.
4. Agree the thresholds with the product owner before the first run, and date that agreement. A
   threshold set after seeing the scores is not a threshold.
5. Score each new agent version and write `runs/<date>-<version>.md`. Read the failures and name the
   component that produced each (retrieval, prompt, translation, guardrail).
6. Add an evidence line to the status file under level 1: date, the scores against the thresholds,
   the run file. When the minimum viable evaluation is met (the playbook's level 1 MVE page), the
   level may move to `mve-met`.

## Judges

An LLM judge is trusted only after it has been measured against human raters on the same pairs, and
re-measured when the model or the rubric changes. `calibrate-workshop` (taf-skills) runs that
calibration end to end when it is imported. Low-resource languages are where judges fail most: say
which languages the alignment covered.
