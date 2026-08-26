# Format: a published visual (social card, infographic panel)

Any image we publish that is **made of type and tokens** rather than photographed: an Instagram
card, an infographic for a LinkedIn post, a figure inside a deck. Photographs follow
`website.md` and the beneficiary-image rules in `facts/facts.md` instead.

## The rule that matters

**The HTML is the asset. The PNG is an export.** Never retouch an exported PNG, and never build a
visual in a tool whose file the repo cannot hold (Canva, Figma, a slide deck on someone's laptop).
A visual built outside the repo cannot be corrected when a figure changes, cannot be re-rendered by
someone else, and disappears with the person who made it. This has already happened here: an
infographic prepared for the five-year LinkedIn post was corrected three times in `decisions.md`
and exists in no file anyone else can open.

Two people can work on the same visual because the source is text: it diffs, it merges, it reviews.

## Where it lives

```
comms/visuels/<AAAA-MM-JJ>-<slug>/
  source.html        the visual (or a-<variante>.html when several are on the table)
  source.png         the export, committed next to it
  photo.jpg          any photograph the layout pulls in
  README.md          what it is for, which post uses it, what was decided
```

The date-slug matches the post that uses it, in `comms/reseaux/brouillons/` and later in
`comms/journal.md`. A visual for something other than a post (a deck figure, a funder one-pager)
lives next to that thing instead, same shape.

## Making one

1. Copy `source/formats/visuel-template.html` to `comms/visuels/<date>-<slug>/source.html`. The
   relative paths in it assume exactly that depth.
2. Edit the marked block. Set `--w` / `--h` in `:root` to the format you need: 1080 × 1350 for an
   Instagram feed post, 1080 × 1080 square, 1080 × 1920 for a story, 1128 × 191 for a LinkedIn
   cover, 1200 × 630 for a link preview.
3. Render: `./scripts/render-visuel.sh comms/visuels/<date>-<slug>/source.html`. It reads the
   dimensions from the file, drives headless Chrome, and writes the PNG next to the HTML.
4. Look at the PNG before showing it to anyone. Then commit both files.

The script tags the export as **sRGB**. Chrome writes an untagged PNG, and on a wide-gamut screen
(every recent Mac) an untagged image is read as Display P3: the brand red drifts towards pink. The
tag changes no pixel, it says which space the pixels are in. This was caught on a first export
whose red looked pink on screen while the file held exactly `#a0030a`.

For a carousel, put the views in a `carrousel/` subfolder sharing one `panneau.css`, numbered
`1-…html` to `5-…html`, and render them in a loop. One stylesheet means the views cannot drift
apart.

The fonts are committed in `source/brand/assets/fonts/` (Cormorant Garamond and Inter, both SIL
Open Font License), so a render works on a fresh clone with no `npm install`.

## Design rules

- **Tokens only.** Colours, fonts and spacing come from `source/brand/tokens.css`, like everywhere
  else. If a value does not exist there, add the token first.
- **One idea per visual.** A card carries a number, a sentence, or a name. Not three.
- **Type is the design.** Cormorant Garamond for the statement, Inter for the small print. No
  decorative shapes, no gradients over cream, no stock illustration.
- **Keep 96 px of margin** on a 1080-wide canvas, and nothing meaningful inside the last 100 px at
  the bottom: feed previews and story interfaces crop there.
- **The logo is optional and usually unnecessary.** The account name is already on screen. Use the
  mark when the image will travel outside the account (a repost, a slide, a press kit).
- **Never a memorial plaque.** A name over two dates reads as a gravestone. Anything about the person the association is named for
  is written in the present and points forward. See the memory anchor in `brand/voice.md`.
- **Typographic apostrophes** (`’`, not `'`) and non-breaking spaces in `40 €` / `66 %`. A straight
  apostrophe set in Cormorant at 86 px is visible from across the room.
- **Every figure comes from `facts/facts.md`.** A visual is exactly as bound by that rule as a
  sentence is, and it is worse when wrong: an image gets screenshotted and outlives the correction.

## Checking before publishing

Read the PNG itself, not the HTML: check the figure against `facts.md`, check the French (including
the non-breaking spaces in `40 €` and `66 %`), and look at it small. If it does not survive being
32 px wide in a feed thumbnail, it has too many words.
