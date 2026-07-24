---
name: team
description: "Help the owner manage their team: distill 1:1 notes into a living per-person file (role, goals, open threads), keep a prioritized management TODO, prep 1:1s, challenge goals/OKRs, give grounded management advice. Use when the owner mentions their 1:1s, a report, their team's goals, or asks for management help. All people data stays in the gitignored, local-only team/ folder."
---

# Team

Management help for the owner, grounded in what was actually said in their 1:1s. The same
compounding bet as the rest of the kit, applied to managing people: every 1:1 leaves a trace in
a file, so advice gets sharper the longer the system runs, instead of every conversation starting
from "so, tell me about them".

## The privacy rule (before anything else)

Notes about people (1:1 content, assessments, growth concerns) are the most sensitive thing this
repo will ever touch. So the `team/` folder is **local-only by construction**:

- **Before writing anything, verify `.gitignore`** contains the `team/*` rules (with the
  `!team/README.md` exception). If it doesn't (an install predating this module), add them and
  commit the `.gitignore` change **before** creating any team file.
- Nothing under `team/` is ever committed, pushed, published, or pasted into another file, page,
  deck, or tool. Before any commit, check `git status`: nothing from `team/` may be staged.
- Never relay what one person said in a 1:1 to anyone else, in any output.
- What *can* be shared (a finalized set of goals, a role description, who-owns-what) gets a
  cleaned version written to the shared layer (`source/objectives.md`, `ORGANIGRAM.md`, or a
  file the owner chooses), only when the owner explicitly asks, and never containing 1:1
  material.

One consequence to tell the owner once: local-only means no git backup. The distilled files are
re-derivable from their notes, but their own additions live only on this machine; include
`team/` in the machine's backup if they care.

## First use

Create the folder and its README (the only committed file):

```markdown
# team/ — the owner's team files (local only)

Everything here except this README is gitignored by design: 1:1 digests, per-person files, the
management TODO. It never leaves this machine and is never shared. Maintained by the `team`
skill.
```

Then ask who is on the team (names and roles), and where their 1:1 notes live.

## The files

```
team/
├── TODO.md               the consolidated management TODO, regenerated each sync
│                         (the owner's "My own items" section always survives)
└── <first-name>/
    ├── profile.md        role, responsibilities, current focus, working style, growth areas
    ├── goals.md          their goals or OKRs, with status and a dated history
    └── 1on1s/
        ├── index.md      open threads, decisions, commitments (who / what / by when)
        └── YYYY-MM-DD.md one distilled note per 1:1, naming its source
```

## Syncing 1:1 notes

Wherever the notes come from, the pipeline is the same: distill, file, update, prioritize.

- **Pasted or dropped notes** (the inbox works too): process directly.
- **Auto-notes in a connected tool** (e.g. Google Drive with Gemini notes, if this session has
  the connector): scan for meeting-notes docs with the owner's 1:1 naming pattern (often "1:1"
  in the title), confirm the person-to-doc mapping once, and remember which docs were already
  processed (`team/.sync-state.json`) so a weekly "sync my team" only handles the new ones.

A good distillation keeps: decisions and their why; commitments in both directions, with dates;
blockers and who can unblock them; feedback given and received; goal progress or drift; signals
about energy and friction (as observations tied to the note, never diagnoses); open questions
for the next 1:1. Small talk goes nowhere. Never invent; ambiguity becomes a question in
`index.md`, not filler.

Durable changes (a new responsibility, a goal that moved) update `profile.md` or `goals.md` in
place with a dated line. The per-date files are the immutable trail.

## The management TODO

Regenerated at each sync; every item names the person, the source 1:1, and a suggested next
action. Three levels: **act this week** (commitments made or owed, blockers, people signals that
don't keep), **follow up** (pending decisions, feedback to deliver, next-1:1 items), **watch**
(recurring themes, slow-burning risks). If `source/objectives.md` exists, work advancing it
ranks higher. The owner's own section survives untouched.

## Coaching on demand

- **"Prep my 1:1 with X"**: from `index.md` and the recent notes: what's open, what was
  promised, one thing worth raising, three questions. Saved to `team/<name>/1on1s/prep-<date>.md`
  if wanted.
- **"Challenge X's goals"**: against `source/objectives.md` (alignment), and for outcome over
  output, measurability, ambition, focus, ownership. Output is a short review the owner brings
  to the conversation; the aim is the person owning better goals, not receiving corrected ones.
- **"How do I handle [situation]?"**: ground in the actual files first, state what the notes
  support and what is a hunch, then a read of the situation, two or three options with
  trade-offs and a recommendation, and something usable verbatim in the next conversation.
  Challenge the owner's framing when the notes contradict it.

Anything that crosses into legal or HR-process territory (contracts, conduct, compensation
disputes, health) is beyond this skill: say so and point the owner to proper counsel rather than
improvising process.
