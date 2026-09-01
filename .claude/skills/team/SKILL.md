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
- **Third-party content is kept, never relayed.** Meetings discuss people who are not in the room,
  including other senior people. It stays local, and a reading voiced by someone else is written **as
  a reading, with its author and its date**, never as a fact about the person: "X confirms it, citing
  a specific remark" is not "she is thin-skinned". What files under a person is what concerns them,
  with its provenance.
- What *can* be shared (a finalized set of goals, a role description, who-owns-what) gets a
  cleaned version written to the shared layer (`source/objectives.md`, `ORGANIGRAM.md`, or a
  file the owner chooses), only when the owner explicitly asks, and never containing 1:1
  material.

**If more than one person manages or gives feedback here, part of this layer wants to be shared.**
Then the split is not "people data versus the rest", it is **what was said in confidence versus what
was decided**: the per-person files (role, objectives, feedback given, directives, open subjects) can
be committed so they synchronise, while the **raw 1:1 notes stay local**, because someone speaks to
one manager in a one-to-one and not to the whole group. What comes out of a note and needs to be known
rises into the shared files **with its provenance**; the note itself does not move. Decide this
deliberately with the owner, per folder, and write the decision down where the `.gitignore` lives —
and remember that a Git history is permanent, so what is shared is shared retroactively.

**And the moment several people write here, provenance becomes load-bearing.** Every line says who
said what, when, and in what setting. An appreciation without provenance becomes an internal rumour
the day someone quotes it, and nobody can check it or take it back. A reading voiced by a third party
is written as a reading, with its author and date, never as a fact about the person. A feedback
relayed by an intermediary is marked as relayed: relayed feedback is sometimes wrong, and gets denied.

One consequence to tell the owner once: local-only means no git backup. The distilled files are
re-derivable from their notes, but their own additions live only on this machine; include
`team/` in the machine's backup if they care.

**And local is not the same as private, which decides what may be written at all.** A gitignored
folder is still backed up, synced between machines, and re-read by every later session. Two things
therefore never get written down, even here: **anything about a person's health** (a condition they
disclosed, an occupational-health file, a hypothesis about how someone's mind works, an inference
from their behaviour) and **compensation figures**. What a manager legitimately needs is the work
fact: that an accommodation exists and what it requires, that a pay conversation is open and who
owns it. The medical fact belongs to the doctor and the pay figure to whoever runs payroll. This
comes from a real transcript in which one participant stopped the others to say exactly that, and
they were right: written down, a hypothesis about a colleague becomes a citable assertion about
them.

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
├── cadence.md            agreed 1:1 rhythm vs real rhythm, per person (optional, see below)
└── <first-name>/
    ├── profile.md        role, responsibilities, current focus, working style, growth areas
    ├── goals.md          their goals or OKRs, with status and a dated history
    ├── feedback.md       feedback given: by whom, when, in what setting, said to them?
    ├── needs.md          what they asked for or need: dated, who owes it, state
    ├── directives.md     what they were told: dated, said to them?, does it hold?
    ├── tracks.md         job description / goals / performance tracks, with their state
    └── 1on1s/
        ├── index.md      open threads, decisions, commitments (who / what / by when)
        └── YYYY-MM-DD.md one distilled note per 1:1, naming its source
```

**The three registers, and why `index.md` is not enough.** `index.md` is organised by conversation;
these are organised by obligation, which is what the owner is actually asked about at review time.
Add them when the team is more than one or two people, or as soon as a subject starts spanning
several 1:1s.

- **`feedback.md`** — the feedback given to them, with **who** gave it, **when**, in **what setting**,
  how it landed, and the column that does the real work: **was it actually said to them?** Half the
  appreciations in a management file are formed in the person's absence, and not marking that is the
  same as writing that they were told. It also carries what is **owed** — a feedback promised and not
  delivered is an open item on the manager's side, not the report's. This file earns its place the
  moment more than one person gives feedback to the same team: feedback one manager gives is worth
  nothing if the next one to speak to that person does not know it was given, and the failure is
  concrete (the same criticism arriving twice from two people, or a promised one never arriving
  because each assumed the other had done it).
- **`needs.md`** — what the person asked for or needs to do their job, with **who owes it** and
  **since when**. A need closes on evidence (the meeting happened, the decision was made, the access
  works), never because it came up again. The ageing column is the point: a request for regular
  feedback, made by name and still unserved after two 1:1s, then looks like what it is.
- **`directives.md`** — what they were told to do or not do, with two columns doing the work:
  **said to them?** and **does it hold?**, the second answered with evidence rather than intention.
  A directive decided in a meeting the person was not in starts at *no*, and delivering it is the
  action. Left implicit, several undelivered instructions arrive at once and land as an indictment.
- **`tracks.md`** — the subjects that have a state rather than a date: a job description to write,
  a goals set to agree, a performance conversation, a growth plan. One block per track with dated
  history, current state and next step. See *Job descriptions and performance* below.

`cadence.md` is worth adding for one reason: every other file fills up when a 1:1 happens, and this
is the only one that fills up when it doesn't. A rhythm agreed in a note and not put in the calendar
as a recurring event is a rhythm that will quietly stop.

## Syncing 1:1 notes

Wherever the notes come from, the pipeline is the same: distill, file, update, prioritize.

- **Pasted or dropped notes** (the inbox works too): process directly.
- **Auto-notes in a connected tool** (e.g. Google Drive with Gemini notes, if this session has
  the connector): scan for meeting-notes docs with the owner's 1:1 naming pattern (often "1:1"
  in the title), confirm the person-to-doc mapping once, and remember which docs were already
  processed (`team/.sync-state.json`) so a weekly "sync my team" only handles the new ones.

**Find the meetings by who was in them, not by what they are called.** This is where a sync goes
wrong most often. If the notes come from an auto-notes tool, each one carries an attendee or invitee
line in its header, and that line is the only reliable classifier: two people is a one-to-one whatever
the title, a small recurring group is a leadership meeting whatever the title, a long list is a ritual.
A title pattern ("look for '1:1'") cannot see a meeting that does not follow the pattern, and it will
then report an absence that is not one. The real case that produced this rule: six syncs between a
manager and one report, titled things like "Weekly catch-up", "Demo prep" and "<project> prep" — the
dossier had recorded "no one-to-one ever recorded" about that person, for six months. Where the tool
allows a full-text search, searching for the person's email address returns those notes and usually
shows the header line in the result snippet, so attendees can be counted without opening each document.
Two limits worth stating rather than papering over: notes for a meeting joined outside its calendar
event often have no attendee line at all (list those separately, with their sizes, and read them on
demand), and a two-person meeting with an outside guest may list only the internal attendees.

**And 1:1s are not the only place decisions about someone are taken.** If the owner sits in a
leadership or partners' meeting, that meeting regularly decides something about a person who is not
in the room: a perimeter, a job description, a performance plan, the end of a trial period. None of
it appears in that person's 1:1, so a picture built from 1:1s alone misses the half where the
decision was made. Ask once which recurring meeting has that character, then read its notes on the
same run and keep **only** the part about people and organisation, in `team/leadership/YYYY-MM-DD.md`,
with a link to the source. Everything else in those notes belongs to the files that already own it.

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

## Job descriptions and performance

Four sequencing rules, each of which has cost someone something:

- **Write the perimeter before you invoke it.** Nobody can be held to a scope that was never
  written. A perimeter discussed in four meetings across five months and still unwritten, followed
  by a list of things the person must stop doing, is the shape of that mistake.
- **A performance plan has to say what changed since the last positive assessment.** If the same
  person was confirmed or praised three months ago, a plan that does not name what moved is weak on
  the merits and reads as a reversal to the only person who knows both dates.
- **A team rule stays a team rule.** A rule agreed among a few people and then applied to one person
  first reads as a personal sanction. Announce it, then apply it to everyone, including whoever
  wrote it.
- **Keep what went well.** These files accumulate problems by construction, since a problem produces
  a line and a success produces nothing. Left alone, the dossier becomes an indictment, and the
  owner reads it just before writing someone's goals.

**The words here are terms of art, and the definition is local.** "PIP", "warning", "probation",
"performance plan" name different instruments in different jurisdictions, and in several of them a
performance shortfall is explicitly not misconduct, so a goals plan and a disciplinary step belong
to two different regimes: written into one document, they damage each other. So before drafting
anything with one of these names, look the term up against a source for the owner's own
jurisdiction rather than recalling it, tell the owner which instrument they are actually asking for
and what changes because of it, and bank the distinction in `source/facts/` if it will come up
again. A confident near miss on one of these words is the whole failure mode.

Anything that crosses into legal or HR-process territory (contracts, conduct, discipline,
compensation disputes, health) is beyond this skill: management prepares, but the instrument itself
gets proper counsel. Say so and route it, rather than improvising process. What stays here is the
date the subject opened and a pointer to where the document lives.
