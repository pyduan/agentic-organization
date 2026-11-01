# nonprofit: the base every nonprofit starts with

What a nonprofit does around its programmes, every week, whatever its cause: it raises money and
reports on it, it meets funders and partners, it says what it does, it goes to events, and often it
runs a programme for others. Each of these has the same failure when it lives in inboxes and slide
decks: the next person cannot tell what was said, to whom, on what evidence. This pack keeps each one
in files, with the rule that makes it safe.

## What is in it

| Skill | It keeps | The rule it holds |
|---|---|---|
| `funders` | one file per funder, donor or prospect; `TALKING-POINTS.md`; the pipeline | every figure sent to a funder is logged verbatim with its date, and read back before the next |
| `grant-reporting` | the report owed under a grant | built from the commitments and the figures already sent; a shortfall said plainly; the figures logged when it goes |
| `meeting-notes` | journal lines in the files of the people met, decisions, actions | the transcript is the source; an uncertain term is flagged, never smoothed |
| `communications` | posts, the newsletter, talk prep, the story bank | every line carries the fact behind it and its source |
| `calendar` | one file per event; the editorial calendar | the stage is the state of the relationship, read in the thread |
| `programme` | the handbook, the cohorts, one file per participant with its journal | the handbook is the rule the agent applies; every session leaves a journal line |

Formats in `formats/`: `funder.md`, `talking-points.md`, `participant.md`, `event.md`,
`story-bank.md`, `editorial-calendar.md`. One script, `scripts/nonprofit.mjs`:

- `check` refuses a sent figure with a missing column, a stage outside its list, an event whose name
  and date disagree, a story with no fact behind it;
- `pipeline` prints every open funder by next deadline;
- `calendar` prints events, calls for speakers, actions due and planned pieces, by date.

## What it uses from the kit, rather than repeating

- The sourced fact bank is the kit's `research` skill and `source/facts/`. This pack's files cite it.
- Messages to one person or a few (a mail to a funder, a team message) are
  `source/formats/message.md`: the shape, and the rule that the agent drafts and a person sends.
- The organization's dated register of what happened is `source/journal.md`
  (`source/formats/journal.md`); decisions are `source/decisions.md`; to-dos follow
  `source/formats/todo.md`.
- A piece of work with a start and an end (a grant application, a campaign) can be tracked with the
  kit's `projects` skill; its funder file points to it.
- A French association with members and tax receipts adds the `association-fr` pack.

## Install

1. Copy `packs/nonprofit/` into the repository.
2. `cp settings.example.json settings.json` and set the folders to the names your organization uses
   (a funder may call its participants `grantees/`, an accelerator `portfolio/`).
3. Create each folder with a `README.md` that names the skill which fills it, so a person opening the
   folder knows what to ask for.
4. Ask: *"Add <funder> to our funders"*, *"Write up this call"*, *"What is due in the pipeline?"*

## What it does not do

It does not send, post or submit anything; a person does, and the agent logs it once they confirm.
It keeps no individual donor database and no bank detail: those stay in the tools built for them,
and the files say where.

## Feedback

Report against the id in `pack.json`, never the folder name.
