# Design guide

How we look, everywhere: the website, the decks, any image we produce. The AI reads this plus `tokens.css` before any visual decision. The setup skill personalizes it; after that it grows one rule at a time.

## Philosophy

TODO: one paragraph naming the feel in plain words (examples from real projects: "warm, analog, intimate, gallery-grade"; "institutional but alive"; "so plain it disappears"). Every visual decision should be defensible against this paragraph.

## Tokens

`tokens.css` is the only place where colors, fonts, and the spacing scale are defined. Nothing in `site/` or in a deck hardcodes a hex value, a font name, or a magic pixel number. Adding a design idea that needs a new value means adding the token first, with a name that says what it's for.

Current palette and type: see `tokens.css` and keep a one-line rationale here per token group once personalized. TODO.

## Type

- TODO: display face, text face, and where each is used. The kit starts on system fonts; if the owner picks webfonts, self-host them (put files in `site/public/fonts/`, declare with `font-display: optional`) so the site never flashes or jumps on load.
- One type scale, defined in tokens, used everywhere. Resist per-page font sizes.

## Layout and components

- Generous whitespace; when in doubt, remove an element instead of shrinking everything.
- Build a small set of components and reuse them. Keep an inventory here as they appear (hero, card, gallery grid...), with a pointer to where each lives. A new page should mostly assemble existing components. TODO as they're built.
- Motion is subtle and purposeful, or absent. Never bouncy by default.

## Charts and tables

Data should be the most legible thing on the page, and dynamic wherever it can be. If a `dataviz`
skill is available in the environment, load it before writing any chart (it carries the form
heuristic, the color formula, and mark specs); this section is the project layer on top.

- **Color comes from the tokens, never from a rainbow.** Define a small categorical series ramp in
  `tokens.css` (three to six values that read apart at a glance) and, for a single series or a
  sequential ramp, tint one brand color from light to dark. Keep the accent color for one emphasized
  point or a "now" marker, never as a series fill.
- **Semantic color is separate** (good / warning / critical) and never doubles as the series palette.
- **Never encode meaning by color alone.** Label the series directly (a label at the end of a line
  beats a legend) or add a shape or pattern; check it in grayscale.
- **Numbers line up**: `font-variant-numeric: tabular-nums` on any column or tile of digits, text
  left, numbers right.
- **Tables stay light**: hairline row borders, an uppercase small-caps header row, no heavy gridded
  box. A long table gets a sticky header; a wide one lives in its own `overflow-x: auto` container so
  the page body never scrolls sideways.
- **Animate on first reveal** when it helps reading: bars grow from zero, lines draw left to right,
  numbers count up, tiles fade up staggered ~60ms. Pace it to reading speed and always guard with
  `@media (prefers-reduced-motion: reduce)` (show the final state, no motion).
- Prefer inline SVG or Canvas over a chart library, so a deck or app stays self-contained.
- Flag illustrative or estimated figures as such, and keep the source line next to the chart (facts
  come from `source/facts/` or `source/content/`, never invented).

## Imagery

- Originals live in `source/brand/assets/` at full resolution; the site serves processed copies only (see the images section of `source/formats/website.md`).
- TODO: the project's image style once known (photography vs illustration, color treatment, cropping habits).

## Responsiveness, learned the hard way

- Every visual change gets checked at mobile width (~390px) and a normal desktop before publishing, and at ~2560px if the audience uses large screens.
- When adapting to large screens, scale whole modules together (type, dimensions, spacing, wraps). Scaling only headings leaves a small design floating in whitespace.
- Late CSS wins ties: media-query override blocks go at the end of the style block they override, or they silently lose the cascade.

## Accessibility baseline

- Text over background always passes contrast (4.5:1 for body text).
- Every meaningful image has real alt text.
- The site works with keyboard only; interactive elements are actual links and buttons.
