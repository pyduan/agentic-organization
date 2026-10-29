---
name: grant-reporting
description: "Write a report owed to a funder under a grant (interim, annual, final, an indicator check-in), from what was committed, what was already reported and the organization's sourced figures, with every figure checked before it leaves. Use when someone says 'our report to X is due', 'answer X's indicator request', 'fill X's reporting form', 'we fell short on an indicator, how do we say it', or shares a reporting template."
---

# Grant reporting

A report is the place where a figure drifts most easily: a year after the indicator was agreed,
someone rebuilds it from memory, with another definition, for a funder who kept the old one. This
recipe builds the report from the files and leaves a trace of what was sent.

## Steps

1. **Read the funder's file** (`funders` skill): *What we committed to* and *Figures we sent them*,
   in full. Then the grant agreement or the reporting template, filed in the funder's folder with its
   source. A requirement in the template that the file does not list goes into *What we committed to*
   first.
2. **List what the report must answer**, one line per question or indicator, each with where the
   answer will come from (`source/content/`, `source/facts/`, a project's log). Show the list before
   drafting; a question nobody can answer from the files is raised now, not on the due date.
3. **Draft.** For each indicator: the value, its definition (the one in `TALKING-POINTS.md`), the
   period, and the comparison with the last value sent to this funder from the figures table. A
   change of definition is stated in the report, not absorbed.
4. **A shortfall is said plainly**: the target, the result, the reason, what changes. Never round up,
   never swap in a friendlier metric without saying so. A funder learns more from a clear miss than
   from a figure that reads well and cannot be checked.
5. **Check every figure** against its source and against the figures table. Run the kit's
   `node scripts/check-ai-tics.mjs` on the draft. Name what a person must confirm: a figure, a
   commitment for next year, anything that engages the organization.
6. **A person sends.** When they confirm it went, add each figure to the funder's figures table, as
   sent, with the document and the source; add a journal line; set the funder's `next_deadline` to
   the next report. Then `nonprofit.mjs check`.

## People in a report

Beneficiaries' stories and quotes need their consent, and an anonymised story still needs care
about details that identify someone in a small place. A story that comes from the story bank brings
its fact and its source with it.
