# Quality: the incident register

`incidents.json` is the running record of **the AI's own mistakes on this project** — what it had
in front of it, what it got wrong, why, who caught it, and what stops it happening again.

It exists for two different readers, which is why it is data and not prose:

- **You.** A mistake that produced a rule is a rule you can check is still there. A mistake that
  produced nothing is a hole you can decide to close.
- **The framework's maintainer.** Every entry carries a `generic` line: the transferable lesson,
  written with no facts of yours in it. `node scripts/error-report.mjs --anonymized` produces a
  report from those lines alone, ready to send, so the next person who installs this kit inherits
  what went wrong here without learning anything about you.

The `reflect` skill writes entries at the end of a session; the `feedback` skill generates and sends
the report. Nothing here is ever published: it lives in the repo, and the repo is private.

## One entry

```json
{
  "id": "2026-08-23-1",
  "date": "2026-08-23",
  "category": "searched-too-late",
  "severity": "major",
  "inputs": "Full access to the mailbox; a folder named exactly for the document in question.",
  "error": "Asked the owner two questions whose answers were in that folder, and published a wrong deadline in the meantime.",
  "why": "The corpus was chosen by topic rather than by question, and 'not found in what I read' was treated as 'does not exist'.",
  "detected_by": "owner",
  "guard": { "kind": "check", "where": "scripts/search-log.mjs" },
  "generic": "When a document is missing, the default hypothesis is 'I searched badly', never 'it does not exist'. Search the whole corpus by question, not by topic, before asking the owner anything.",
  "sensitive": ["inputs", "error"]
}
```

| Field | What goes in it |
|---|---|
| `category` | one of `searched-too-late` · `status-of-information` · `numbers` · `expiry` · `destructive` · `handover` · `parallel-sessions` (see `docs/failure-modes.md`) |
| `severity` | `minor` · `major` (a wrong conclusion travelled, or the owner lost real time) · `critical` (data destroyed, or a decision was taken on it) |
| `inputs` | what the AI actually had available. This is usually the whole story: most errors are sound reasoning over a corpus nobody opened. |
| `error` | what it did or said. Plainly, no softening. |
| `why` | the mechanism. "Extrapolating is cheaper than looking, and the result looks like a calculation" is a why; "I was not careful enough" is not. |
| `detected_by` | `owner` · `self` · `another-session` · `check`. The most useful column in the file: the share caught by the owner is the number that has to come down. |
| `guard` | `check` with the command or file that now catches it, `rule` with the guide it was written into, or `none` — and `none` is worth leaving honest rather than dressing up a rule as a safeguard. |
| `generic` | the lesson, transferable to any project, with nothing of yours in it. |
| `sensitive` | the fields to drop when anonymizing. Default to listing `inputs` and `error` whenever they carry a name, an amount, or a document title. |

Keep entries short and keep them coming. A register of thirty honest lines is worth more than five
essays, and the categories only earn their keep once there is enough in here to count.
