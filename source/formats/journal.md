# The journal: what happened, one line at a time

The repo already remembers decisions (`source/decisions.md`), tasks (`next-steps.md` files), and
facts (`source/content/`, `source/facts/`). None of them holds a plain event: the grant answer
arrived, the printer delivered, the site went down for an hour, a partner said yes. Those live in
`source/journal.md`, the organization's dated register of what happened — and it earns its place
at the annual review, when "what did this year actually look like" has an answer nobody has to
reconstruct from memory and old emails.

Born on a live project where the board wanted one place that says *that it happened*, without
having to decide where the detail belongs.

## Why a to-do update is not enough

The to-do app writes dated updates under a task, and that is the right home for progress on that
task. But an update lives and dies with its line: it only makes sense next to the task, and it
leaves the screen when the box is ticked. An event without a task — news, an arrival, an outage —
had nowhere to exist. The journal is that place: entries are independent, carry their provenance,
survive every closure, and sort globally by date.

## Format

One markdown table in `source/journal.md`, under a marker, newest first:

```markdown
<!-- data:journal -->
| Date | What happened | Where it came from |
|---|---|---|
| 2026-08-27 | The printer delivered the 500 brochures | @sam, by phone |
| 2026-08-25 | Grant application sent to the Foundation | projects/grant/log.md |
```

- **ISO dates**, newest on top, so the freshest line is the first thing read.
- **The line, not the detail.** The journal says *that* it happened; the detail goes to the file
  that owns it, and the provenance column may point there. A decision → `source/decisions.md`. An
  event inside a tracked project → that project's `projects/<slug>/log.md`. A number that changed →
  the content or facts file that holds it. The journal line remains either way, because the reread
  is chronological and the detail files are not.
- **Provenance always.** Who said so, or which file holds the rest. A line with no origin is a
  rumor with a date.

## Where lines come from

The owner says "note that the brochures arrived"; a note from the to-do app's bubble turns out to
be news rather than a task or a fact (the inbox protocol routes it here); a session ends having
learned that something happened in the world. The bar: would the owner want this line in front of
them at the annual review? Then it gets one. Routine work does not — the git history already tells
that story.

## The tagged-register pattern, for any dated table

The journal is one instance of a shape worth reusing: a markdown table under a
`<!-- data:<name> -->` marker, with declared columns, that both a human and a machine read. Two
rules make it hold:

1. **A build that reads a register fails loudly when the format is violated** — a renamed column,
   a broken date — naming the file, the column expected and the column found. Silence here ships a
   dashboard that is quietly wrong.
2. **A server that reads the same register keeps serving** on the last good shape. The build
   protects correctness; the runtime protects availability; one shared formatter, two behaviours,
   so they can never disagree about what the format is.

The same pattern fits any dated log an organization accumulates: shipments, memberships,
publications. Declare the columns, mark the table, read it with a reader that knows rule 1 and 2.

## Rendering

The natural view is a "latest news" card — the first handful of lines, on the dashboard or an
internal page. Nothing more: the journal is a register, not a feed, and the file itself stays the
source of truth that a person and an agent both edit.
