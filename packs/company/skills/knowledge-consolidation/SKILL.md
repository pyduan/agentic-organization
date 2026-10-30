---
name: knowledge-consolidation
description: "Turn a backlog of raw material (a week of mail, several transcripts, a chat export, a shared folder) into a consistent state across the company's repos, each fact placed at exactly one level: customer journal, what we learned, project decisions, product journal, company journal, DECISIONS.md. Use at company setup to take in everything that predates the repos, and whenever the owner says 'go through all this', 'catch up on my mail with X', 'here is everything from last month', 'consolidate'. One meeting is meeting-log. Company pack only."
---

# Knowledge consolidation

The sweep. Raw material goes in, files come out, and every fact lands at exactly one level. The
kit's `fact-finding` skill decides the structure and runs a bounded sweep for any organization; this
is the same discipline applied to the company's five repos, with their placement table. The first
sweep, at setup, takes in everything that predates the repos; after that, each task takes in only
what it needs.

## The levels, and the test for each

Putting a fact at two levels is the failure this exists to prevent: the copies disagree, and the
reader cannot tell which is current.

| Level | Holds | The test |
|---|---|---|
| Customer file, `## Journal` | What happened, dated | Would a cofounder working this account need it? |
| Customer file, `## What we learned` | What is durably true about this customer | Would rediscovering it cost another meeting? |
| Project file, `## Decisions` | A choice binding this engagement | Could someone reasonably have chosen otherwise? |
| `strategy/product/journal.md` | An insight about the offer, the method or the market | Does it change how we sell or deliver **elsewhere**? |
| central `source/journal.md` | Something that happened to the company with no customer and no product angle: an outage, an administration's answer, an arrival | Will someone at the yearly review ask when it happened? |
| a `DECISIONS.md`, or central `source/decisions.md` | A choice binding a repo, or the whole company | Would someone relitigate it without the reasoning? |
| `strategy/product/*.md` | Vision, positioning, SWOT | Is it a standing claim rather than an event? |

Two questions place almost everything. **Does it change anything outside the account it came
from?** No, it stays in the customer file; yes, it goes to the product journal. **And then: what
decision does it change, and for whom?** Name it out loud. What we sell, to whom, for how much, how
we staff: those are product-journal entries. A step in a deployment checklist is a project note,
however good the quote attached to it. The second question exists because the first is too easy to
pass: a vivid, attributable, specific observation feels like it travels, and specificity is not
size.

**Did we decide, or did we notice?** Noticed goes in a journal, decided in a `DECISIONS.md`
(`company-decisions`). An insight with no decision attached is common and fine: the decision is
still open, and saying so is more useful than inventing one.

## The sweep, in order

1. **Collect without filtering**, and read everything before writing anything: filtering while
   reading throws away what you did not know was relevant. A folder from a file server comes in by
   its path on the disk, copied or unzipped there first; a zip dropped into the conversation is not
   unpacked. On a Mac, a short Swift script reads a PDF's text layer with PDFKit and image-only pages
   with Vision, and `textutil` turns `.doc` and `.docx` into text. A figure or a date read by OCR is
   checked against the page image before anything relies on it.
2. **Extract candidate facts**, each with a date and who said it. A fact with no attribution is one
   nobody can check in six months.
3. **Verify every proper noun.** Generated notes get companies, people and products wrong. Where a
   name cannot be confirmed, write it as heard and mark it.
4. **Place each fact at one level**, with the table above.
5. **Promote what is durable** to `## What we learned`, the frontmatter, or the product journal. If
   nothing was promoted, nothing was learned.
6. **Record decisions separately** from the insights that produced them, and cross-reference.
7. **Write open questions as questions**, in the file they concern.
8. **Run the checks**: `npm run check` in `intranet/`. It catches the vocabulary, the required
   fields, and the same milestone recorded at two levels.

What comes out: dated journal entries, frontmatter updated (`status`, `stage`, `updated`,
`milestones`, `next_steps`, `key_facts`), product-journal entries for what travels, typed decisions in
the right file, open questions, and a short list of what could not be verified.

## The failures worth naming

- **Everything in the journal.** The easiest sweep and the least useful: it produces a diary.
- **Deriving a summary instead of writing one.** Taking the newest, most frequent or highest-scoring
  entries and calling them the important ones. The sort has no judgement in it. Anything labelled
  key, main or top is a claim about rank, and rank is written by a person.
- **Promoting the quotable thing.** The most memorable line in a transcript is rarely the most
  important one. Before promoting, name the decision it changes; if you cannot, it is an anecdote.
- **Comparing companies on their slogans.** Two firms compete when they sell to the same buyer, on
  the same problem, in the same contract shape. Copy that rhymes with ours is a naming problem.
- **Inventing a decision from an observation.** When the source does not make the status clear,
  write what was said and who said it, and leave the decision unrecorded.
- **Filling a gap to make a file look finished.** `unknown` is a value. A plausible number is worse
  than an admitted gap, because the gap is findable and the number is not.
- **The same event twice**, on the company and on its project. The check fails on it.
- **A customer's operating rules swept into our repos.** They belong in the customer's own
  organization. `customers` holds our relationship with them, never their business rules.
