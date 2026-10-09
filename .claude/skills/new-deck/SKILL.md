---
name: new-deck
description: "Create or rework a presentation deck: composed from components in decks/<slug>/deck.mdx, built and measured by scripts/deck/build.mjs. Also when the owner hands over old decks (.pptx, PDF) to learn a style or facts from. Use when the owner asks for a deck, slides, a presentation, a pitch, or a deck 'like our old ones'."
---

# New deck

Read first: `source/formats/deck.md` (the method), `source/brand/deck/deck.md` (this brand's deck
rules, if it exists), `source/brand/voice.md`, and `source/brief.md` for context.

1. **Frame it**: audience, occasion, language, the one thing they should remember. Ask only what the
   brief and the conversation do not say. Then `node scripts/deck/build.mjs new <slug>`, and fill the
   frontmatter (`audience`, `takeaway` included).
2. **Facts before slides.** Every fact and figure comes from `source/content/` or `source/facts/`,
   with its source. If the owner handed over old decks, read each with
   `node scripts/deck/read-pptx.mjs <file.pptx> --out=source/content/archives/<name>`, fold what they
   say into the content files, and **list the contradictions between them for the owner to settle**
   before using either version. Anything missing: ask, never invent.
3. **The plan, approved.** One line per slide (title, then what it proves) in the comment at the top
   of `deck.mdx`. Get a nod before composing.
4. **Compose** from the registry: `node scripts/deck/build.mjs components` lists every component and
   its props, the brand's included; `scripts/deck/examples/deck.mdx` shows each one in use. A shape
   that is missing becomes a component in `source/brand/deck/components.mjs`, never HTML in a deck.
5. **Build, check, look.** `node scripts/deck/build.mjs build <slug>` must end with 0 defects. Fix
   by cutting or splitting content, never by shrinking type. Then open `decks/<slug>/.check/sheet.png`
   and look at every slide, and at the full-size `slide-NN.png` of any that looks off. Say what you
   looked at; a check that did not run (no Chrome) is said too, never reported as passed.
6. **Review with the owner** in the browser (F fullscreen, O overview, N notes). Each correction goes
   into the deck **and** into the rule it teaches: `source/brand/deck/deck.md` for the brand, its
   `theme.css` or `components.mjs` for a shape, the content files for a fact.
7. **Commit** `decks/<slug>/` (`deck.mdx`, `assets/`, `index.html`), with `git commit --only -- decks/<slug>`
   (`git add` the new folder first). That does not publish it. A copy to
   send is `build <slug> --share` (one file, no speaker notes), a PDF is `build <slug> --pdf`.
   Publishing on the website is `node scripts/deck/build.mjs publish <slug>`, only when the owner asks
   for that deck, then the publish skill.
8. Record the deck and its purpose in `source/brief.md` under Derivatives ▸ Decks.

**The first deck of a brand** also sets up `source/brand/deck/`: read the brand's best old deck with
`read-pptx`, write `theme.css` from the numbers in its `style.md` (the `--dk-*` values first, then the
components that need restyling), copy the recurring images from its `media/` into `assets/`, and start
`deck.md` with what the owner says about the look. Build `scripts/deck/examples/deck.mdx` against the
new theme: every component on one deck, measured, is how a theme is checked.

If the deck is confidential beyond the repo's collaborators, build it outside the repo, present it
locally, and say so to the owner.
