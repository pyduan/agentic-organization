---
name: meeting-log
description: "Turn one meeting, call, workshop or mail thread with a customer, partner or prospect into facts in the right customers file: a journal entry, what is durable promoted, the state updated, open questions and decisions recorded. Use when the owner says 'log this meeting', 'here is the transcript of my call with X', 'note what we said with X', or pastes meeting notes. For a backlog of many sources, use knowledge-consolidation. Company pack only."
---

# Meeting log

A meeting that is not logged is a meeting somebody will have again.

## Method

1. **Read all of the raw material before writing anything**: the transcript, the generated notes,
   the mail thread, your own notes.
2. **Find the file.** `customers/companies/<slug>.md` (or the segment, partner or project file). No
   file means `prospect-research` first.
3. **Write the journal entry** under `## Journal`, in the company file or in the project file when
   the meeting was about one project: `### YYYY-MM-DD · kind · title`, kind one of `call`,
   `meeting`, `workshop`, `mail`, `intro`.
4. **Promote what is durable.** A fact still true in six months belongs in `## What we learned` or
   the frontmatter, not only in the journal. A journal entry nobody promotes is an archive.
5. **Update the state**: `status`, `stage`, `updated`, `milestones`, `next_steps`, and the next step
   in `## Where we stand`.
6. **Open questions as questions**, under `## Open questions`.
7. **Decisions** that bind more than this account go to the right `DECISIONS.md`
   (`company-decisions`).

Then `npm run check` in `intranet/`.

## Reading generated notes

Meeting-notes tools are a starting point and they get names wrong. Treat every proper noun in a
generated summary as unverified: companies, people, products. Check against the mail thread or ask.
Where a name cannot be confirmed, write it as heard and mark it, rather than picking the most
plausible spelling.

They also flatten intent. "It was decided to prefer local agents" may have been one person thinking
aloud. When the transcript does not make the status clear, write what was said and who said it, and
leave the decision unrecorded.

## What a good entry looks like

Invented, from another kind of company. The shape is what to copy.

```markdown
### 2026-01-15 · meeting · Drawing office, fabrication drawings
Present: two people from the client's drawing office, two of ours.
We ran the dimension-rewriting exercise on a real drawing. The agent wrote a script that worked;
Jordan found it better but too hard to govern and change, which produced the rule that business
rules are written in markdown.
Jordan set the boundary himself: repetitive tasks where he defines the rules, not technical
preparation. Order of magnitude for the first case: around 10% of drawing time.
Next: workshop tomorrow on two or three drawing cases. Jordan picks the sites.
```

What makes it usable: named people, what was actually said, the number with its context, and a next
step with an owner.
