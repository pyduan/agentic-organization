# Deck playbook

A deck is composed from components, built by a script, and measured in a browser before anyone sees
it. The agent writes the content and picks a shape for each slide; the look comes from the brand's
deck theme; the check finds what a person reviewing slides misses. Read `voice.md` and `design.md`
first, then this, then the brand's own deck rules in `source/brand/deck/deck.md` if the file exists.

## Where things live

| What | Where | Whose |
|---|---|---|
| A deck: its content, its plan, its images | `decks/<slug>/deck.mdx` and `decks/<slug>/assets/` | yours |
| The built deck, one self-contained page | `decks/<slug>/index.html` | built, committed |
| What the brand's decks look like | `source/brand/deck/theme.css` | yours |
| Shapes only this brand uses | `source/brand/deck/components.mjs` | yours |
| Logos, seal, backgrounds, icons | `source/brand/deck/assets/`, written `brand:<file>` in a deck | yours |
| The brand's own deck rules, learned from corrections | `source/brand/deck/deck.md` | yours |
| The engine, the components, the base theme, the checks | `scripts/deck/` | the kit |
| This method | `source/formats/deck.md` | the kit |

**A rule that is about your brand goes in `source/brand/deck/deck.md`, never in this file.** This
file is replaced by every kit update: the kit improves the method and the engine, the owner keeps
the look and the lessons.

## How a deck is written

```mdx
---
title: "Steering committee"
date: 2026-10-09
lang: en
audience: "Who is in the room, and what they already know"
takeaway: "The one thing they should remember"
status: draft
footer: "Organization, steering committee, 9 October 2026"
---

{/* The plan, approved before any slide is composed. A comment is kept, never published. */}

<Cover title="…" subtitle="…" date="2026-10-09" />

<Slide chapter="What we did" title="Four schools renovated in one year" source="Site register, 2026">
  <Split ratio="3 2">
    <Bullets groups={[{ head: "Why", items: ["…", "…"] }, { head: "In practice", items: ["…"] }]} />
    <Image src="assets/school.jpg" />
  </Split>
  <Callout tone="next">The last two schools follow in 2027.</Callout>
</Slide>
```

- **A slide is a component, and its content goes in its props.** `node scripts/deck/build.mjs
  components` lists every one with its props, the brand's included. `scripts/deck/examples/deck.mdx`
  shows each in a realistic slide, and `scripts/deck/examples/agentic-organization/deck.mdx` the
  blocks of a deck about an organization run by agents (`Cycle`, `Regen`, `Redraw`, `Hub`, `Levels`,
  `Iceberg`, `LearnTree` and the smaller ones), in the arc of a first conversation with a client.
- **The build refuses what would let a deck carry its own layout**: raw HTML, a style, an import, an
  expression, an unknown component or prop. It also refuses a theme that reads a CSS token nothing
  defines (`var(--x)` with no fallback), which the browser would drop without a word. A shape that is missing becomes a component in
  `source/brand/deck/components.mjs` (or a proposal to the kit), never a one-off inside a deck. A
  one-off is invisible to the theme, to the checks and to the next deck.
- **`lang` sets the deck's language**, English when it is missing: the dates, the viewer's labels,
  the quotation marks and the typography follow it.
- **Text takes three marks**: `*accent*`, `**bold**`, `` `code` ``. Typography (curly apostrophes,
  and in French the non-breaking spaces) is applied at build, to every text.
- **`chapter` carries over** to the following slides until another one is set; a `Divider` sets it, an
  `Agenda` with `active` names the part that opens. The viewer groups the overview by chapter, and a
  theme can print it on the slide.
- **`source` on a slide** is printed in its footer. The build warns on a figure (a percentage, an
  amount, a large count) on a slide without one.
- **`notes`** are the speaker's: shown with N, never printed, stripped from a shared copy.

## Building one

This is the procedure; the `new-deck` skill runs it.

1. **Frame it.** Audience, occasion, language, and the one thing they should remember: the
   frontmatter carries them, and the build warns when `audience` or `takeaway` is missing, because
   they decide what goes on every slide. Ask only what the brief and the conversation do not say.
   `node scripts/deck/build.mjs new <slug>` starts the folder with its frontmatter and the plan's
   skeleton; `--from=agentic-organization` starts it from that starter instead, whose organization,
   people and figures are all invented and all to be replaced.
2. **Gather the facts before the slides.** Facts come from `source/content/` and `source/facts/`,
   each with its source. Old decks are evidence, read with `read-pptx` (below), and what they say is
   folded into the content files first: a deck built straight from a pile of old decks inherits
   every contradiction between them, so **list the contradictions for the owner to settle** before
   using either version. Anything missing: ask, never invent.
3. **Write the plan and get it approved.** One line per slide: its title, then what it proves, in the
   comment at the top of `deck.mdx`. Restructuring a plan is cheap; restructuring finished slides is
   not. Get a nod before composing.
4. **Compose.** For each slide, the component whose shape matches the content: a sequence is `Steps`,
   a few grouped facts are `Cards`, three to four headline figures are `Stats`, an argument with a
   picture is a `Split` of `Bullets` and an `Image`. Bullets are for an argued point, not a default.
   When the brand keeps a master deck (`decks/master/`), start from its slides.
5. **Build and check:** `node scripts/deck/build.mjs build <slug>`. Every defect is fixed before
   anyone sees the deck, by cutting or splitting content, never by shrinking type, and every warning
   is read. Then **open `decks/<slug>/.check/sheet.png` and look at every slide**, and at the
   full-size `slide-NN.png` of any slide that looks off: the check finds what is wrong, looking finds
   what is ugly. Say what you looked at; a check that did not run (no Chrome) is said too, never
   reported as passed.
6. **Walk the owner through it**, in the browser, fullscreen. Every correction is applied to the deck
   **and** written as a rule: into `source/brand/deck/deck.md` when it is about the brand, into its
   theme or components when it is about a shape, into the content files when it is about a fact.
7. **Commit** `decks/<slug>/` (`deck.mdx`, `assets/`, `index.html`; the check's output stays out),
   with `git commit --only -- decks/<slug>` (`git add` the new folder first). That saves and
   versions the deck; it does not publish it (see *Presenting and sharing*).
8. **Record the deck** and its purpose in `source/brief.md` under Derivatives ▸ Decks.

## What the check measures

The build opens the deck in the Chrome already on the machine, every slide at full size, and fails
on a defect:

| Defect | Means | Fix |
|---|---|---|
| `overflow` | a text or an image runs outside the slide | cut content, or split the slide in two |
| `margin` | it runs into the margin, often under the footer | same; never shrink the type to make it fit |
| `spill` | a text runs out of its own block, over its neighbour | the block carries too much: cut or split |
| `overlap` | a block lies over the one above it | a theme rule moved it: fix the CSS |
| `cramped` | two blocks less than 12px apart, so they read as one | same: the theme took the gap away |
| `clipped` | a box hides part of its own text | shorten the text |
| `small` | a text under the theme's floor (`--dk-min-font`) | the slide carries too much |
| `grid` | boxes on one row have different heights | a theme bug: fix the component's CSS |
| `image` | an image did not load | the path, relative to the deck folder or `brand:` |
| `contrast` | a text under 4.5:1 (3:1 when large) against what is painted behind it | a darker shade for text, the bright one for graphics |
| `error` | the page threw an error | the build output says where |

And warns, for a person to judge: `bunched` (content stuck in the top or left of a slide with the
rest empty: pair it with an image, a figure or a second column; a narrow block centred on its
slide, a lone quote, is not bunched), `sparse` (the content fills under a third of the slide),
`dense` (more words than the theme's `--dk-max-words`), `blurry` (an image shown well past its
resolution). A thin slide gets more real content, a figure already sitting in
the text, or a companion image, before it gets a bigger font.

A brand whose decks are dense by design raises `--dk-max-words` in its theme once, rather than
arguing with the warning on every slide.

### Printing is not displaying

A deck that looks right on screen can print badly: an office laser printer has rendered a cream
slide black, from a gradient no screen check looked at. Under `@media print`, replace gradients,
transparency and shadows with their opaque equivalents, computed rather than guessed. Before calling
a PDF ready to print, search it for `/Shading` and `/PatternType`: either one is a fill a printer may
not render.

## Old decks as references

```bash
node scripts/deck/read-pptx.mjs source/inbox/old-deck.pptx --out=source/content/archives/old-deck
```

A `.pptx` is a zip of XML that stores every position, size and colour exactly, so it is read, not
looked at. The reader writes:

- `outline.md`: every slide's text in order, with its size, weight and colour, its tables, its
  images and its notes. **Facts go from here into `source/content/`**, each with the deck's date as
  its source. When two decks disagree, the outline is evidence and the owner decides which version
  holds; the decision is written once, in the content file.
- `style.md`: the canvas, the fonts, the type scale in pixels, the text and fill colours, the header
  band, the images that recur. **The brand's `theme.css` is written from these numbers**, never from
  a screenshot: eyeballed CSS got the header height and the type scale wrong twice on the deck this
  was learned from.
- `media/`: the recurring images (logos, seal, backgrounds), ready to copy into
  `source/brand/deck/assets/`.
- A slide whose content is one flattened image is flagged: its figures are not text, so they are
  retyped into the content files (and, rebuilt in a component, become editable again).

Prefer the original `.pptx` to its PDF: a PDF gives text and pixels, not the measurements. `--render`
also writes one PNG per slide when LibreOffice is installed; nothing else needs it.

## Content rules

- **The deck supports a person speaking.** Slides carry the anchor, the speaker the detail. How dense
  a slide may be is the brand's call, in its theme and its `deck.md`; what fits is the check's.
- **Show, don't tell.** An example, an image or a real number beats an abstract claim.
- **Numbers get a source**, on the slide (`source`) and in the content files. An estimate says so.
- **Recurring anatomy.** The same kind of slide takes the same component everywhere in the deck.
- **Never two dark slides in a row** (the build warns). A dark slide opens a part.
- **A title names what the slide shows.** It does not sell the slide, conclude for the reader or
  claim more than the slide proves: the argument goes into the content. Read the slide without its
  title; if the point has gone, it belongs in the lead. Check a title against the slide's job in the
  deck too: a pitch and a final proposal title the same content differently.
- **A reader who opens the deck on any slide can say who did what.** A title that points at a
  mechanism the reader has not met yet is a riddle: name the actor and the result, and leave the how
  to the slide.
- **A title is a label**: no closing full stop, six to nine words as a habit, a second sentence only
  when it turns the first. Numbering titles tells a sequence that one `Steps` shows better. One
  contrast title per deck at most.
- **No paragraph over 40 words.** Reach for a table (an inventory, a comparison), a figure, an example
  or two short lines.
- **Figures side by side have to compare**: one unit, or one question. Three true figures from three
  domains do not add up to an argument; the reader stops on the numbers. One figure can carry a slide.
- **Say it once.** The same information on two slides is merged into the one with the evidence.
- **The deck does not narrate itself.** Nothing on a slide explains what the deck contains, why a
  slide is there or what was left out: that reasoning goes in the plan, in the comment at the top.
  Nor does a caption explain what the reader can see.
- **A kicker opens a section.** The slide that opens a part may carry the line above its title; the
  slides inside it go without.
- **The deck closes on a real next step**: the concrete one for a deck shown outside, never an
  invented one; questions for an internal deck; never a thank-you slide.
- **Something built for the deck says so**: a mock-up, a staged message, an invented example.

The build reads every slide's copy against these rules and the brand's voice, and warns with the
slide: a title with a closing full stop, over 12 words or numbered; a paragraph over 40 words; a
second kicker in one part; `Stats` counted in different units; a closing thank-you; two sentences
on two slides that say the same thing; the tells of `voice.md` ▸ *AI tics* that a pattern can find
(the antithesis, the one-word question, signposting, inflated significance) and its words to avoid,
read from the brand's own list. A `Quote` is someone else's words and is not read. The rest (the
triad, even weighting, a title at the wrong altitude) needs a reader: read the titles alone, as a
list, then the deck aloud.

## Presenting and sharing

- **Present** from `decks/<slug>/index.html` in a browser: F fullscreen, arrows to move, O the
  overview, N the notes. `#7` opens slide 7, `#<id>` the slide with that `id`.
- **What moves** moves only in the viewer: a block that tells a story (a correction redrawing a plan,
  inputs rebuilding the views) plays when its slide opens and holds its end, R or ↻ plays it again,
  and a loop (a pulse going round) runs while the slide is shown. The markup is always the finished
  state: the check measures it, the PDF prints it, and a reader who asked for less motion sees only
  it. An animation is a component's, never a deck's.
- **PDF:** `build <slug> --pdf` writes `decks/<slug>/dist/<slug>.pdf`, one slide per page at the size
  it was designed. Printing from the browser gives the same.
- **A copy to send:** `build <slug> --share` writes `decks/<slug>/dist/<slug>.html`, one file with its
  images inside and **without the speaker notes**.
- **Three tiers**, the default is the middle one:
  1. too sensitive for the repo: build it outside the repo, present it locally, say so;
  2. **in `decks/<slug>/`**: versioned, visible to whoever has the repo, never served;
  3. public: only when the owner asks for that deck, `node scripts/deck/build.mjs publish <slug>`
     copies a notes-free version into `site/public/decks/<slug>/`, live on the next push. Moving a
     deck up a tier is the owner's decision, never a step of "finishing" it. (A test deck went live
     within a minute of an ordinary push when tier 3 was the default.)

## Lessons kept with the rule they produced

- **Composing beats drawing.** Every deck drawn as its own HTML file forked the engine: three decks in
  one project had three engines of 600 to 1,600 lines, a fix to one reached none of the others, and
  its token copies drifted. Components keep one engine and one theme for every deck.
- **The check runs on every slide.** A deck went live with its headline figures dark on dark; a
  sweep then found thirty more faint texts on slides nobody suspected. A viewer that shows one slide
  at a time hides the other slides from any measurement, so the check lays them all out.
- **A check that says 0 is not a look.** The first version measured every edge of the slide and still
  passed a dense slide whose blocks had been squeezed until their text ran over each other: nothing
  crossed an edge. Blocks no longer shrink under their content, the check now measures each block
  against its neighbours, and looking at the sheet stays a step of its own.
- **A rule in a sentence is followed until the agent forgets it.** The ones that matter here (no raw
  HTML in a deck, a source on every figure, nothing past the margin) are in the build and the check.
