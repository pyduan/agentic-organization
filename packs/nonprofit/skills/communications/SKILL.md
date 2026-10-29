---
name: communications
description: "Posts, the newsletter, a talk's lines and the story bank, in the organization's voice, every claim traced to a fact. Use when someone says 'write a post about X', 'draft this month's newsletter', 'prepare my lines for the panel', 'I'm keeping that phrase', 'what have we said about X before', or plans the editorial calendar. Messages to one person or a few are source/formats/message.md."
---

# Communications

Everything here is written in the organization's voice (`source/brand/voice.md`) and, for a person's
own post, in theirs on top. What this recipe adds is that the substance comes from the files: a fact
from `source/content/` or `source/facts/`, a story from the story bank, a date from the calendar.

## A post

1. Find the substance: the story bank entry, the project log, the fact file. A post with no source is
   an opinion piece, and that is fine when it is said.
2. Draft one version per channel the person asked for, in the channel's own conventions. For a post
   in someone's name, read their own voice notes if the repository has them.
3. Check every figure against its source, then `node scripts/check-ai-tics.mjs --stdin` on the draft.
4. Add or update the row in the editorial calendar (`formats/editorial-calendar.md`). A person
   publishes; the row gets the URL once it is live.

## The newsletter

`newsletterPath/<newsletter>/`: a `FORMAT.md` (audience, sections, length, cadence, what earns a
place), and one file per issue, `YYYY-MM.md` or `YYYY-MM-DD.md`. An issue is built from the period's
material: the organization's journal (`source/journal.md`), project logs, the calendar, new facts.
Each item cites where it comes from in a comment, so a reader of the draft can check it. A section
with nothing real to say is dropped from that issue rather than filled.

## Talk prep

Lines for a panel, an interview, a podcast: start from the story bank, add the facts the audience
will care about, and mark what is new. After the talk, what landed goes back to the story bank with
"said in public at …, and it landed", which is the most useful line the bank holds.

## The story bank

When someone says of a phrase "I'm keeping that one", it goes into `storyBankPath` in the same
session, in the format of `formats/story-bank.md`: the line, what it serves for, the fact behind it,
the source, who validated it and when. **Proposed** until a person validates it. A line without its
fact is not added.

## What never goes out from here

A figure meant for a funder (that is the talking points), a beneficiary's story without consent, a
partner's name in a context they have not agreed to. Drafting is this skill's job; publishing is a
person's.
