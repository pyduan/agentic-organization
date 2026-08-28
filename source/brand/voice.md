# Voice guide

How we write, everywhere: website, decks, emails, captions. The AI reads this before writing any word a visitor will read. The setup skill personalizes the TODO sections; after that, this file grows one rule at a time as the owner gives feedback.

## Who is speaking

TODO: one paragraph. Who the voice belongs to (a person, a studio, an organization), and the relationship with the reader (peer, guide, host, expert).

## Tone

TODO: three to five words with a sentence each explaining what the word means here. Example entries to replace:

- **Warm**: we sound like a person, never like a brochure.
- **Precise**: concrete nouns and numbers where we have them, no filler.
- **Calm**: no exclamation points doing the work adjectives should do.

**Show it instead of claiming it.** Whenever a point can be shown, show it: a concrete example, a
real number, an image, a small demo. Adjectives are the fallback.

## Rules

These start as sensible defaults; edit them to fit.

- Short sentences win. If a sentence needs two commas, try two sentences.
- Active voice, first person where natural.
- Concrete beats abstract: "we answer within a day" says more than "responsive service".
- Cut buzzwords on sight (leverage, seamless, innovative, solutions...). Keep a running list here of words the owner has banned: TODO.
- Titles in sentence case, no period.
- Numbers, dates, and prices follow the conventions of the site language, consistently.
- **An absolute number goes out with its total or its share, never alone**, and restrictive turns of
  phrase are reserved for scarcity you can demonstrate. "Only 90 GB left" was exact, and the reader
  concluded their disk was full and work impossible. A bare figure carries no judgement until a word
  like *only*, *just* or *barely* lends it one — and then the word is doing the arguing, not the
  measurement. If the real reason for a recommendation is elsewhere, say that reason instead of
  borrowing weight from an alarm.
- **Links point straight at their destination.** A URL copied out of Google Docs, Gmail, or a notes
  tool arrives wrapped as `https://www.google.com/url?q=…`: decode it to the real target and drop
  the tracking params. A reader should see the real domain, not something that looks like tracking.
- **A drafted email has to stand on its own as pasted plain text.** Whoever sends it will copy the
  file you wrote and paste it into their mail client, where nothing renders. That is the test: strip
  every bit of formatting and the message must lose nothing. So no markdown syntax, because it either
  shows up raw or renders into something the client mangles: no `**` (it arrives as asterisks), no
  `#`, no backticks, no `[texte](url)` (it hides the address the reader needed to click), bare URLs
  with no `<…>` around them. Observed for real, more than once. And **no meaning carried by
  formatting**: if a bolded word is doing the work, rewrite the sentence so the words do it. The few
  characters that break in transit go plain too — straight `"` and `'` rather than curly quotes,
  three periods rather than `…`, ordinary spaces rather than non-breaking ones; accents and other
  diacritics stay, they travel fine and they are not formatting. Offering a styled HTML version as
  well is fine, but it must be the upgrade, never the thing that has to be noticed for the mail to
  look right. This applies to a **draft a human pastes**: everything else in the repo is read
  rendered and stays markdown, and a campaign email built and sent from a mail tool is a designed
  piece, not this case.
- **In an email, bullets are `– ` (en dash), not `- ` (hyphen).** A hyphen at the start of a line is
  markdown, so any rendered view turns the block into a `<ul>` — and a `<ul>` pasted into a mail
  client arrives as a **nested table**, cells and margins included. An en dash still reads as a dash
  and no markdown engine makes a list of it, so the rendered view and the raw file paste identically.
  For the same reason, the HTML half of a letter emits `<p>– …</p>` and never `<ul>`.
- **The shape of a message is a different file.** These two rules are about the characters; what an
  email or a chat message should actually contain, and how completely that changes between a
  colleague and a client, is `source/formats/message.md`. Read it before drafting either.

## AI tics: the tells to strip

Copy that reads as machine-written costs the one thing a reader gives you for free the first time,
which is trust. It is also the default output of the tool writing this, so it takes deliberate
effort rather than good intentions. Strip these on sight, in every language.

**The antithesis.** The most recognisable construction there is: "it's not just a tool, it's a
partner", "this isn't about speed. It's about trust", "not X, but Y". Once you see it you cannot
unsee it, and it appears roughly once a paragraph if nobody stops it. Say the thing you mean. If
the contrast is genuinely the point, earn it once in a piece, not in every third sentence.

**Triads.** "Faster, simpler, and more reliable." "We design, we build, we ship." Three items with
nothing separating them but rhythm. Real lists are two items, or five, or an awkward four. When a
sentence arrives as a tricolon, cut it to the one item that carries meaning.

**Inflated significance.** No "marks a pivotal moment", "reflects a broader shift", "evolving
landscape", "a testament to", "underscores the importance of". State what happened and stop.

**Participles glued on for depth.** No clause ending in "highlighting…", "underscoring…",
"ensuring…", "reflecting…", "fostering…", "showcasing…". If the thought matters it gets its own
sentence; if it does not, it goes.

**Signposting and rhetorical transitions.** No "let's dive in", "here's what you need to know",
"but here's the thing", "so what does this mean for you?". Do the thing instead of announcing it.
A rhetorical question is almost always a paragraph that has not decided what it wants to say.

**Empty openers and closers.** "In today's fast-paced world", "At its core", "Ultimately", "In
conclusion". The first sentence should carry information; if it can be deleted without loss, it
was never a sentence.

**Copula avoidance.** "The platform is open-source", not "serves as an open-source solution". No
"stands as", "serves as", "boasts", "leverages" where *is*, *has* or *uses* does the work.

**Hedge stacks.** "may potentially help to", "can often serve to". One hedge or none. A stack of
them means the claim is not established, and the honest move is to say so or drop it.

**False precision.** "A significant portion", "numerous studies show", "up to 40% faster" with no
source. Either the number is sourced and named, or it does not appear. See the sourcing rules.

**Chatbot residue.** Nothing from a conversation with an assistant survives into copy: "here is
a…", "I hope this helps", "let me explain", "want me to expand?", "as of my last update", "great
question". And no speculative filler written to paper over a gap in the sources.

**The trailing coda.** A sentence that has finished, then a comma and two words for punch: "and it
works, every time", "built to scale, effortlessly", "we ship, always". Delete the coda. The sentence
was done.

**The one-word question.** "The result? A system that…", "The catch? None." A question mark standing
in for a colon, answered by a fragment. Write one sentence instead.

**Snowclones.** "X, meet Y", "X is the new Y", "think of it as X for Y", "not a bug, a feature". A
template with the nouns swapped reads as a template, because it is one.

**Announced candour.** "Let's be clear", "make no mistake", "to be honest", "here's the thing".
Honesty that announces itself is a performance of honesty. Say the thing.

**Counted summaries.** "Three things for you and one for Sam", "here are the 4 topics". The list is
right below, the count adds nothing, and it goes false the moment the list moves.

**Words to avoid.** delve, crucial, pivotal, showcase, testament, underscore (verb), vibrant,
tapestry, foster, seamless, robust, unlock, empower, journey, landscape (as an abstract noun),
realm, navigate (figuratively), elevate, supercharge, streamline, transform (as praise), and
genuinely / truly / actually used as intensifiers. **This list is meant to be edited.** These words get worn out by
overuse and the set changes every few months, so add one the day it starts showing up in drafts,
and drop one that has become ordinary again. A frozen list stops working.

### The structural tells, which matter more than the words

A draft can pass every rule above and still read as machine-written, because the giveaway is more
often the shape than the vocabulary.

**Even weighting.** Machine prose is flat: every paragraph the same length, every section the same
depth, every bullet the same weight. Human writing is lumpy. One point gets three paragraphs
because it deserved them, the next gets a sentence, and something important arrives in an aside.
If a piece can be folded into a neat grid, it has not been thought about, only produced.

**The bolded-lead bullet list as a default shape.** `**Thing**: explanation`, twelve times. It is a
good format for a reference table and a bad one for an argument, because it hides the fact that no
connective tissue was written between the items. Prose has to carry the *because* and the *but*
that a list lets you skip. Use the list when the items really are parallel and independent; write
sentences when they are not.

**Symmetry.** Two clauses of equal length balanced against each other, over and over. Vary or cut.

**The closing zinger.** A neat aphorism that ties the piece with a bow, usually restating the title.
Stop at the last real point instead.

**Length is a tell.** Machine prose is long because nothing costs it anything: the same point made
twice at two altitudes, a paragraph that restates its own first sentence, a closing summary of a text
the reader has just finished. Say it once. The second pass on a draft is a cut, and the draft that
lost a third of its words is usually the better one.

### Do not over-correct

This is a real failure in the other direction, and it produces prose that is stilted rather than
human. Clean grammar is not a tell. One *however* is not a tell. A colon, a curly quote, a single
short emphatic sentence, a correctly used semicolon: none of these are tells. Writing badly on
purpose does not read as authentic, it reads as badly written.

And protect what actually marks a person: an oddly specific detail, a number that is not round, a
feeling left unresolved, a genuine aside, an admission that something did not work. Those are worth
more than the absence of any banned word.

### The test

Read it aloud. Then ask whether someone who actually did the work would have written that sentence,
or whether it is what someone would write who had only read about it. The second kind is what gets
stripped.

## Match the detail to the surface

**Every claim has to be defensible. Not every surface carries the defence.** This is the rule that
keeps public copy short without making it vague, and it is worth stating because the failure is
counter-intuitive: it comes from trying too hard to be honest.

| Surface | What it carries |
|---|---|
| A slogan, a profile bio, a social post, a caption | the claim, plain. Nothing else |
| A page, a letter, a deck | the claim, and a link to where it is proved |
| A methodology page, a funding application, the accounts, a dataroom | the claim, its figure, its date, its source, and its limits |

Observed on a real project: an assistant wrote *"100 % of donations fund treatment: overheads, €357
in 2025, are covered by the founding family"* into a LinkedIn bio. Claim right, proof right, surface
wrong. On a profile the €357 adds nothing to the reader's trust — it turns the sentence into a
disclaimer, and a sentence that defends itself unprompted signals that the writer expects to be
attacked. The lean version plus a link to the page that holds the ledger is both shorter and stronger.

**Two habits that follow.**

- **A settled claim is not relitigated every time it appears.** Once the owner has examined a claim
  and found it founded, flagging it again on each new surface reads as though the organization
  doubted its own books. Record the decision, then use the claim.
- **A shorthand or English-friendly name is fine in public copy.** The registered legal name belongs
  on anything legal or financial — statutes, receipts, applications, bank, contracts. A profile bio is
  neither of those.

Same instinct as writing without defensive phrasing: say the thing, don't pre-answer the objection.

## Languages

TODO: list the site's languages. The first is the default.

If the site has more than one language, every language is written natively. Before publishing copy in a non-default language, do a dedicated pass reading it on its own, as a native speaker would, and fix anglicisms, calques, and literal constructions. A page that reads like a translation fails this guide even if every word is technically correct.

**All of the above governs what a person reads. What a *model* reads is a different artifact, and it
is written in English** — prompts, skill files, scheduled-task instructions, the rules in `CLAUDE.md`,
comments in scripts. Not out of preference: technical terms have canonical English forms, and
translating them (connector, hook, fallback, register) adds ambiguity and buys nothing. The mistake
to avoid is matching the language of the file you happen to be editing: a task written in French for
a French project is still read by a model, and a rule added to it goes in English. The output that
task produces for its owner follows the owner's language, as ever.

## Notation

TODO: how the project's name is written, exactly, including capitalization and any punctuation that is part of the mark. Add other named things (product names, series titles) as they appear. These notations are non-negotiable; the AI applies them everywhere without exception.

**A path is always written with the repo that holds it.** `routines/` is not an address once an
organization spans more than one repo: `scripts/`, `source/`, `recipes/`, `CLAUDE.md` and
`ORGANIGRAM.md` exist in several of them, so a bare path makes the reader guess, and they guess
wrong. Write `pyduan/agentic-organization ▸ routines/` — the repo as its `owner/name` slug, then the
path inside it. The same holds when speaking: "the routines folder in the kit", never "the routines
folder". A location outside every repo says so outright — `~/.claude/scheduled-tasks/`, not in any
repo — because "which repo is that in" is exactly the question the reader is about to ask.

## Examples

Keep two or three short before/after pairs from real feedback, so the tone is shown as well as described.

- TODO after the first real correction.
