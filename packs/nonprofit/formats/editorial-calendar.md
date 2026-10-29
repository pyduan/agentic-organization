# The editorial calendar

`editorialCalendarPath`: one table, one row per planned piece, newest dates last. The newsletter,
posts on the organization's accounts and on its people's own accounts, a report launch.

```markdown
<!-- data:editorial -->
| Date | Channel | Piece | Pillar | Owner | Status | Source |
|---|---|---|---|---|---|---|
| 2026-11-06 | newsletter | November issue | programme news | @sam | drafting | newsletter/monthly/2026-11.md |
| 2026-11-12 | LinkedIn, organization page | what the pilot's test set told us | evidence | @ana | idea | story-bank: "The test set that said no" |
```

- **Status** is one of `idea`, `drafting`, `review`, `scheduled`, `published`, `dropped`. A published
  row gets the URL in Source.
- **Pillars** are the organization's own short list, written once at the top of the file, and a row
  uses one of them. Balance them over a month rather than per week.
- **Source** is where the substance comes from: a story bank entry, a fact file, a project log. A
  piece with no source is an opinion piece, and the row says so.
- `nonprofit.mjs calendar` merges this table with the events into one dated view.
