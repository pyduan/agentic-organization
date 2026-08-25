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
- **Links point straight at their destination.** A URL copied out of Google Docs, Gmail, or a notes
  tool arrives wrapped as `https://www.google.com/url?q=…`: decode it to the real target and drop
  the tracking params. A reader should see the real domain, not something that looks like tracking.
- **A drafted email is plain text, not markdown.** Whoever sends it will copy the file you wrote and
  paste it into their mail client, so `**bold**` arrives as asterisks and `[texte](url)` hides the
  address the reader needed to click. Observed for real, more than once. So: no `**`, no `#`, no
  backticks; bare URLs, and no `<…>` around them either. Offering a styled HTML version as well is
  fine, but it must be the upgrade, never the thing that has to be noticed for the mail to look
  right. This applies to email only — everything else in the repo is read rendered and stays markdown.
- **In an email, bullets are `– ` (en dash), not `- ` (hyphen).** A hyphen at the start of a line is
  markdown, so any rendered view turns the block into a `<ul>` — and a `<ul>` pasted into a mail
  client arrives as a **nested table**, cells and margins included. An en dash still reads as a dash
  and no markdown engine makes a list of it, so the rendered view and the raw file paste identically.
  For the same reason, the HTML half of a letter emits `<p>– …</p>` and never `<ul>`.

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

## Notation

TODO: how the project's name is written, exactly, including capitalization and any punctuation that is part of the mark. Add other named things (product names, series titles) as they appear. These notations are non-negotiable; the AI applies them everywhere without exception.

## Examples

Keep two or three short before/after pairs from real feedback, so the tone is shown as well as described.

- TODO after the first real correction.
