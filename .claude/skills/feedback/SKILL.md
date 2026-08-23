---
name: feedback
description: "Log the AI's own mistakes and the owner's pushback as structured incidents, and turn them into a report the owner can read or send to the framework's maintainer (in full or anonymized form). Use when the owner says 'that's wrong', 'you did this before', 'make a report of your errors', 'send this to Paul', or when a session notices a mistake of its own worth recording."
---

# Feedback

Two mechanisms, one habit. `reflect` turns a correction into a **rule for this project**. This one
records the **miss itself**, so the mistake can be counted, and so the person who maintains this
framework can fix the default that allowed it.

They are not the same thing and both are needed. A rule in a guide says what to do next time. An
incident says what actually happened, who caught it, and whether anything now prevents it — which is
the only way to tell a framework that is learning from one that is accumulating good intentions.

## Log an incident

Whenever the owner corrects you, pushes back, or you catch yourself, append an entry to
`source/quality/incidents.json` per the schema in `source/quality/README.md`. Do it in the same
session, while the context is still there: the fields that matter (`inputs`, `why`) are unrecoverable
a week later.

Log it when the mistake **cost something**: a wrong conclusion travelled, the owner lost time, data
was touched, a deliverable had to be redone. Not for a typo you fixed in the same breath, and not for
a preference (that is `reflect`'s job, and it goes in a guide).

The four things to get right:

- **`why` is a mechanism, not an apology.** "Extrapolating is cheaper than searching, and the result
  looks like a calculation" is a mechanism. "I should have been more careful" is not, and it teaches
  nobody anything.
- **`detected_by` is the honest field.** `owner` when they saw it first. Resist writing `self` for
  something you only noticed because they frowned at it.
- **`guard`** is `check` only if a command now fails when this recurs. Otherwise it is `rule`, or
  `none` — and `none` is a perfectly good answer to leave in the file.
- **`generic`** is the lesson with nothing of theirs in it: no name, no client, no amount, no
  document title. This is the field the maintainer reads. Write it as an instruction to a future
  agent on a project you know nothing about. If a lesson cannot be written that way, it is
  project-specific and belongs in a guide instead.

Then, if the same mistake is now guarded, say which guide or which command guards it — and if it is
not, say that plainly to the owner rather than implying it is handled.

## Produce the report

```sh
node scripts/error-report.mjs                      # full, for the owner
node scripts/error-report.mjs --anonymized         # what can leave the repo
node scripts/error-report.mjs --anonymized --email # + a ready-to-send mail line
```

Every count in the output is computed from the register. Never edit the generated report to add a
total, a share, or a "most of these" — that is the one thing the generator exists to prevent.

## Send it

The owner decides, always, and the default is the anonymized form. Show them what will leave the
machine before it does: run `--anonymized`, let them read it, then use the `mailto:` line the script
prints and attach the file. The full form goes out only if they explicitly say so, having seen it.

Two things not to do: never send anything without being asked in that session, and never paste the
register itself into an email or an issue — it is the working file, and it holds the material the
anonymized form exists to keep back.

## When the owner asks for the report themselves

They may ask for something broader than the register holds: "every mistake you've made since we
started". Then do the reconstruction honestly:

1. Read back through the sessions available to you and the memory or notes written at the time.
2. Enter what you find into the register, dated, with its real `detected_by`.
3. Generate the report from the register. Do not hand-write a report beside it: a document that is
   not generated from the data starts drifting from it immediately.
4. Tell them what you could not reconstruct. A session you cannot read is a gap, and saying so is
   part of the report.
