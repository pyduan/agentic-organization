# Message playbook (email and chat)

Anything you draft for a person to **send**: an email outside the organization, an email to the
team, a message in the chat tool (Slack, Teams, Discord). It is the most frequent thing an agent is
asked to write and the easiest to get subtly wrong, because the register changes completely between
outside and inside.

Read `source/brand/voice.md` first for the words, then this file for the shape, then the per-person
block below for whoever is sending it.

## Three rules, whatever the message

- **You draft, they send.** Never send an email, never post in a channel, on your own initiative.
  Sending is irreversible and it is outward-facing, which is exactly the combination
  `docs/failure-modes.md` exists for. If the owner explicitly approves a specific send, that
  approval covers that message and nothing after it. For chat, get the **exact channel** confirmed
  as well as the text.
- **One draft, not a menu.** Hand back one message that is ready to send. If there is a real fork
  (two possible asks, two possible recipients), say so in one line above the draft and recommend
  one.
- **The sender owns the words.** Anything that commits them to something they have not said (a date,
  a price, a deliverable, an opinion about a third party) gets flagged to them in your response
  rather than buried in the draft.

## Plain text, and why

An email draft is plain text with `– ` bullets, no markdown, links written bare. That rule and the
reason behind it (a `**` arriving as asterisks, a markdown list pasting into a mail client as a
nested table) live in `source/brand/voice.md` ▸ *Rules*. Read it there rather than trusting a
summary of it here.

Chat is the exception, and the reason generalises: **plainness is the email's rule, and it comes
from the paste.** Everywhere else, use what the destination platform actually offers, deliberately.
Bold for the owner of a line, backticks for a path or a command, bare URLs, threads, and its emoji
where they carry a function. A standing template that prescribes an emoji marker is using the
platform, not decorating, and a later session must not strip it to comply with the plain register.
What the register rules out is decoration improvised into a one-off message, a different act from a
template someone designed.

**Write the draft at its final line width, and never rewrap it afterwards.** A plain-text mail
wants roughly 78 columns, hard-wrapped, so it survives a narrow mail window. Getting there by
running a rewrapper over prose that is already wrapped does not work: the script sees single lines,
not paragraphs, so it re-breaks each one and leaves orphan words, splits a hyphenated word across
lines, and folds a two-line sign-off into one. Done twice in one session on two different drafts,
both of which had to be rewritten by hand. Compose at the target width from the first keystroke.

## Every ask passes two tests

Before an ask survives into any message:

- **Is it knowable now, by anyone?** If it depends on something that has not happened yet, it is not
  an ask, it is a wait: it belongs on a date in `next-steps.md`, not in a message.
- **Is it already answered by something we own?** Search the repo, the project folder, the notes,
  the thread. A question our own files answer spends the recipient's time and dilutes the real asks
  beside it. A list where two of five lines are impossible or already covered costs you the
  credibility of the other three.

## Internal messages: asks first

A colleague already has the context, and when they do not, they can ask their own agent for it in
ten seconds. So an internal message does not build up to its point and it does not perform
helpfulness.

The order, in an internal email and in a chat message alike:

1. **The asks, first, as bullets.** One line each, an explicit owner and an explicit date, above any
   context. If there is nothing to do, the first line says exactly that ("Nothing to do here, for
   the record") rather than inventing an ask to justify the message.
2. **One paragraph of recap.** Three or four sentences that assume the reader knows the file: what
   changed, what it means, what the constraint is. Skip the chronology.
3. **The detail, if it is needed to act**: a link, a figure, the one clause that matters. Bulleted.
   Everything else goes in the thread, or nowhere.
4. **The line saying an agent drafted it** (next section).

The register, on top of `voice.md`:

- **Matter of fact.** What is, what is needed, by when. No enthusiasm, no reassurance, no softening
  a real deadline into a preference.
- **No counted summaries.** Never "two things for you and one for Sam", "here are the 4 topics". The
  list is right there, and the count goes false the moment the list moves.
- **No chatbot residue and no service formulas.** No "hope this helps", "let me know if you have any
  questions", "happy to discuss". The message ends when the last useful line ends.
- **No labels that repeat their own bullet.** "Context: the review slipped a week" says "context"
  for nothing. Label a line only when the label carries something the sentence does not.
- **No structure for the look of it.** No headings on a six-line message, no emoji added for
  warmth, no numbered list where the items are not a sequence, and none of the AI tells from
  `voice.md` ▸ *AI tics* (the antithesis and the triad show up here first). A template's own markers
  are not this: see the platform note above.
- **One line of greeting at most, or none.** In chat, the @-mention is the greeting.

## Say that an agent drafted it (internal only)

Every internal message drafted with an agent carries one plain line at the end:

> Drafted with help from TODO's agentic workflows.

TODO: the exact wording and language the owner wants, set once at setup. No variation after that, no
apology, no emoji. It is transparency inside an organization that runs on these workflows: a reader
knows what they are reading, and knows they can ask their own agent for the rest.

It stops at the door. **An external message never carries it**, because outside the organization the
sender owns the words and a disclosure there reads as a caveat on the commitment rather than as
honesty about a tool.

## External messages

Asks-first reads as curt to a client, a funder or an institution, so the shape is different:

- **The point in the first three lines.** One line of human opening, then why you are writing.
- **Recap under five points.**
- **One clear ask, named and dated**, at the end of the body rather than the top.
- **Links grounded and direct.** Never a remembered or guessed URL: pull each one from wherever that
  asset's current address is recorded (`projects/<slug>/`, the content files), and strip redirect
  wrappers per `voice.md`.
- **The recipient's language**, written natively rather than translated.
- **No hurry applied to them.** Speed is a fact about what you can do, never a pressure on what they
  must do. Institutions in particular read it as pushy.
- **Their own greeting and sign-off**, from the per-person block below.

## Worked example (invented)

An internal email:

```
Subject: Poster proof to check, need your answer Wednesday

Sam,

– Check the proof and tell me what is wrong with the type, before Wednesday noon.
– Confirm we can name the venue on the public version.

The printer needs the file Thursday, so Wednesday noon is the real limit. The layout is
the one we agreed in July plus the sponsor strip at the bottom.

– The proof: https://example.org/proof-v2.pdf
– What changed since v1: the bottom third only.

Alex

Drafted with help from TODO's agentic workflows.
```

The same thing in chat:

```
@sam
• Check the proof and tell me what is wrong with the type, before Wednesday noon.
• Confirm we can name the venue on the public version.

Printer needs the file Thursday. Layout is July's plus the sponsor strip, detail in thread.

_Drafted with help from TODO's agentic workflows._
```

## Per person

**If the person has no block, ask before drafting. Do not infer the register.** The `tu`/`vous`
choice, the language and the sign-off are visible on the first line, so a wrong guess is a
correction the sender makes by hand every time. And the tempting heuristic is the wrong one:
**how someone writes to you does not tell you how you write to them.** A correspondent who
vouvoies the owner in every mail may well be someone the owner tutoies. Inferring `vous` from her
own messages produced exactly that error here. Ask, then write the block so nobody asks twice.

One block per person who sends messages drafted here. Keep each one short: it is a diff against
`voice.md` and this file, never a copy. Split a block into its own `source/brand/voice-<name>.md`
only when it outgrows a dozen lines.

### TODO: <name>

- **Language, per audience:** <which language to whom>
- **External greeting and sign-off:** <the exact words they use>
- **Internal greeting and sign-off:** <usually a first name, or nothing in chat>
- **Their own moves:** <what they always do: name who will follow up, one line of context before the
  ask, a plain smiley>
- **Never:** <phrasings they refuse, and any commitment an agent must not make for them>
- **Writing to them:** <what they want when they are the reader: a recommendation rather than a
  menu, the rendered thing linked. Leave as "not recorded yet" until they say so.>

## Where lessons go

A rule about message craft in general lands in this file. A phrasing one person loves or refuses
goes in their block above. A rule about words, anywhere, belongs in `voice.md`. Fold it in during the
session it came up in, per `.claude/skills/reflect/SKILL.md`, and say what you recorded.
