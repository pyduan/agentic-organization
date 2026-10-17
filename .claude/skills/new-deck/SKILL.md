---
name: new-deck
description: "Create or rework a presentation deck: composed from components in decks/<slug>/deck.mdx, built and measured by scripts/deck/build.mjs. Also when the owner hands over old decks (.pptx, PDF) to learn a style or facts from. Use when the owner asks for a deck, slides, a presentation, a pitch, or a deck 'like our old ones'."
---

# New deck

Read first: `source/formats/deck.md` (the method), `source/brand/deck/deck.md` (this brand's deck
rules, if it exists), `source/brand/voice.md`, and `source/brief.md` for context.

Then follow `source/formats/deck.md` ▸ *Building one*, step by step, from framing the deck to
recording it in the brief. A copy to send is `build <slug> --share`, a PDF
`build <slug> --pdf`. Publishing on the website is `node scripts/deck/build.mjs publish <slug>`,
only when the owner asks for that deck, then the publish skill.

**The first deck of a brand** also sets up `source/brand/deck/`: read the brand's best old deck with
`read-pptx`, write `theme.css` from the numbers in its `style.md` (the `--dk-*` values first, then the
components that need restyling), copy the recurring images from its `media/` into `assets/`, and start
`deck.md` with what the owner says about the look. Build `scripts/deck/examples/deck.mdx` against the
new theme: every component on one deck, measured, is how a theme is checked.
