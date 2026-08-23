---
name: fact-finding
description: "Before building anything: decide the folder and file structure for this organization, decide which facts matter, then run a bounded sweep that records the facts, the decisions and the history with their sources. Use at the start of a project (the setup skill calls it), when a new area or client arrives, when a pile of documents lands, or whenever the owner asks 'what do we actually know about X'."
---

# Fact-finding

**The first move on anything new is not building. It is deciding where things will live, deciding
which facts matter, and then going and finding them.**

This is the kit's master recipe, and it is deliberately the opposite of what an eager agent does.
The most common failure across every project running this framework is not bad reasoning: it is
**sound reasoning over a corpus nobody opened** — asking the owner a question whose answer sits in a
folder named after it, commenting on a document without noticing it was superseded, building a tool
before inventorying what exists. Once a derivative has been built from an interview, nobody ever
goes back and opens the corpus, because the site looks finished.

So: structure, then what matters, then the sweep, then build. Four phases, in order.

## A · The structure, decided with the owner

The template's layout is a **starting proposal**, not a given. Before anything is written, work out
where this particular organization's material will live.

Ask, propose, confirm — never guess:

- **What will accumulate here?** Clients, artworks, properties, cases, events, dossiers, products.
  Whatever it is, it will arrive steadily, and it needs a home before the first one lands.
- **What is the natural unit of a folder?** One per client, per year, per property, per product line.
  Get this wrong and every later session fights the layout. Ask them how *they* think about it: the
  right unit is the one they'd name out loud, not the one that is tidiest.
- **What must never be in the repo?** Personal data, client files, anything gated. That answer
  decides what is git-ignored, what goes in a separate local-only folder, and what needs its own
  restricted repo (`new-project` covers the spectrum).
- **What will be read most often?** That thing gets the shortest path and the most obvious name.
- **What is already organised somewhere else** (a Drive, a mailbox, a Notion)? That is ingestion
  material, never a second source of truth. It gets pulled in, not linked to.

Then create the skeleton: the folders, and **a short `README.md` in each one saying what lives there
and how it is organised.** A folder without a README is a folder the next session will misuse. Record
the layout decision in `source/decisions.md` — the next person to wonder why it is shaped this way
deserves the reason, not a reconstruction.

## B · Which facts matter (and which do not)

Not "collect everything". Ask what this organization will actually be asked, and what it would be
expensive to get wrong:

- **What will be cited repeatedly?** Figures, dates, names, prices, capacities, the claims that end
  up in a deck, an email, a grant form.
- **What will someone ask about, more than once?** If a question has been asked twice, its answer is
  a fact that belongs in a file, not in a session's memory.
- **What would be expensive to get wrong?** Anything that goes to a third party, anything with a
  deadline, anything that will be quoted back.
- **And what is deliberately out of scope**, written down as such. The negative list stops a later
  session wandering into generic noise as surely as the positive one directs it.

That answer is the shape of `source/content/` (the owner's own facts) and `source/facts/` (figures
sourced from outside). Write the two READMEs' relevance sections from it now, while the reasoning is
fresh.

## C · The sweep

A bounded pass over everything actually available, before any derivative exists. Where the corpus
comes from, in the order they usually have it:

- **A pile of documents** → `source/inbox/`, processed per its README. Read everything before filing
  anything: documents explain each other.
- **An existing live site** → fetch every reachable page. Copy into `source/content/` as markdown,
  one file per page, with provenance and date; images worth keeping into `source/brand/assets/`;
  observed design cues as a proposal for `design.md` (ask whether they want continuity or a break).
- **An existing repo** → clone it to a scratch location *outside* this repo (never inside `source/`,
  never committed here) and read it as a source dump, not a scaffold. Raw files are usually richer
  than the rendered site: drafts, unpublished pieces, structured data the site never showed. Pull
  content into `source/content/`, sourced figures into `source/facts/`, assets into
  `source/brand/assets/`. **Rebase, not clone**: nothing from the old framework or file layout
  carries over. Delete the scratch clone when done.
- **A mailbox, a Drive, a Notion** — only if the owner offers it, and only as ingestion.
- **Their head** → interview, but *after* the above, so the questions are grounded in what you
  found: "your old site says the studio opened in 2019, is that still right?" gets a better answer
  than "tell me about your history".

Record three kinds of thing as you go, and keep them apart:

| What | Where | The rule |
|---|---|---|
| **Facts** | `source/content/`, `source/facts/` | Every one carries its **source** and its **status**: established, to verify, or assumed. |
| **Decisions** | `source/decisions.md` | Dated, with the **why**, and before → after when something changed. |
| **History** | `brief.md` ▸ History, dated one-liners | The order things happened in. It is what makes a later "why is it like this" answerable. |

Six rules that make the difference between a sweep and a skim:

- **Search by question, not by topic.** A corpus chosen because it is "about" the subject misses the
  folder named for the exact document.
- **When something seems missing, assume you searched badly**, never that it does not exist. Try the
  other spelling, the other language, the abbreviation, the folder named after the person.
- **Look for the successor before you trust a document.** Search its name plus *amendment*, *new*,
  *v2*, *replaces*. An old version read as current is the most expensive mistake in this phase.
- **Status travels with the value.** A caveat written *beside* a figure does not survive the first
  copy: the first reader sees the reservation, the second copies only the number, and it gains
  authority without gaining evidence. Put the status in the sentence, or in a field.
- **Provenance is not precision.** A genuine document can mention a figure in passing. Before you
  record it, ask whether the document had that figure *as its subject*; if not, say so on the line,
  and never use it to correct a figure established elsewhere.
- **Never invent, and never quietly interpolate.** A gap is a finding. Record it as an open question
  with what would settle it.

Do not ask the owner what the corpus answers. Search first, then bring them the piece and ask them
to **confirm** it. A search ends with a confirmation request, not with a question they have to
research themselves.

## D · Report, then build

Come back with three lists, in plain words:

1. **What is now recorded** — facts, decisions, history, and where each lives.
2. **What you could not establish** — the open questions, each with what would settle it. This list
  is the valuable half; an empty one usually means you did not look hard enough.
3. **What you propose to build on it** — the pages, the deck, the dashboard. *Now* the derivative
  makes sense, because it has a source.

Only then build. And when you do, every derivative reads from the files you just wrote rather than
from the conversation, which is the whole point: the second session starts where the first ended.

## Running it again

This is not only a setup step. Run it again, scoped, whenever:

- a **new client, project or area** arrives (with `new-project`, which decides folder vs repo first),
- a **pile of documents** lands in the inbox,
- the owner asks **"what do we actually know about X"**,
- or a session notices it is about to answer from memory rather than from a file.

Same four phases, smaller radius. The structure question shrinks to "where does this belong", and
the sweep to "what does the corpus already say about it".
