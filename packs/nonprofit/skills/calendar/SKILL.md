---
name: calendar
description: "The events the organization watches, attends or speaks at (one file each) and the editorial calendar, read together as one dated view. Use when someone says 'add this conference', 'we were invited to X', 'should we go to X', 'what's coming up', 'which calls for speakers close this month', 'plan next month's posts'."
---

# Calendar

Two sources, one view: the events in `eventsPath` (`formats/event.md`) and the editorial calendar
(`formats/editorial-calendar.md`). `node packs/nonprofit/scripts/nonprofit.mjs calendar` prints the
coming weeks from both, with calls for speakers and next actions due.

## An event comes in

- **Invited**: create the file the same week, `stage: evaluating`, the invitation as the first line of
  *Where we stand*, with who received it. Accepted: `confirmed`, `presence` and `people` set.
- **Found by a watch**: `stage: watching`, with why it might fit.
- **The team decides to go**: same file, same rules.

Copy `formats/event.md`, never another event's file. A date not announced yet means an `undated-`
name and an empty `start`.

## Keeping it true

The stage is the state of the relationship as the mail thread shows it. Before reporting an event as
confirmed, or as never pitched, open the thread; a next action that has gone stale for months is a
question to ask, not evidence. Check who is actually on the thread before reading a colleague's lead
as someone's commitment.

## The editorial side

Planning a month: read the calendar view, the story bank and the period's journal, then propose rows
with a pillar, an owner and a source each. Balance the pillars over the month. An event the
organization speaks at usually earns a row before (announcement) and after (what was said).

## After an event

`stage: done`, a line on what happened, the contacts made into the right files (`meeting-notes`), and
what landed in a talk into the story bank.

Run `nonprofit.mjs check` after editing: it refuses a file whose name and `start` disagree.
