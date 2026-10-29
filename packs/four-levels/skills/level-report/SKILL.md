---
name: level-report
description: "A report by level across a cluster, a cohort or a whole portfolio: where each product stands on the four levels, the evidence behind each status, what moved since the last report, and what each product is ready for next. Use when someone says 'report on the four levels for the X cluster', 'where does the portfolio stand on evaluation', 'prepare the cluster convening', 'what moved this quarter'."
---

# Level report

One dated file per run in `reportsPath`, `<YYYY-MM-DD>-<cluster or portfolio>.md`, in the format of
`formats/by-level.md`. A report is a reading of the status files on a date. It never holds a fact the
status files do not, and a report that finds a status file wrong fixes the status file first.

## Steps

1. `node packs/four-levels/scripts/levels.mjs` (with `--cluster <id>` for one cluster). Fix every
   failure before writing: a report built on a refused file repeats the error to everyone who reads it.
2. Open the previous report for the same scope, if any, and the status files' Git history since its
   date (`git log --since <date> -p -- <productsPath>`). That is where "what moved" comes from.
3. Write the report:
   - the table, pasted from `levels.mjs --markdown`, never retyped;
   - what moved since the last report, one line per product that moved, with the evidence line that
     moved it;
   - per product, what it is ready for next, from the latest `choose-ai-eval-level` verdict in its
     file, or "no verdict yet";
   - what the cluster shares: a common blocker, a dataset or a metric two products could use
     together, an experiment one could reuse from another. Say which files it rests on;
   - the products whose status file is older than the report's period, named, since a stale status
     reads as current in a table.
4. Run the voice checks the repository has (`node scripts/check-ai-tics.mjs <file>`), and show it.

Figures come from the files; counts from the script. A sentence like "most products have met level
1" is replaced by the count the script printed, or by a sentence that stays true without one.

## Who reads it

The products in it are other organizations' work. Before a report leaves the team, the people it
names see what it says about them, and the organization's own policy on sharing grantee or partner
information applies. Drafting is this skill's job; sending is a person's.
