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

The kit has no chart library: a simple chart is inline SVG or a few divs, which keeps a page or deck
self-contained. If a `dataviz` skill is available in the environment, load it before writing a chart.

- Series colors come from `tokens.css`, not from a rainbow. Add the two or three you need as tokens
  the first time a chart appears.
- Label the series directly (a label at the end of a line beats a legend) and never let color be the
  only thing carrying the meaning.
- Numbers: `font-variant-numeric: tabular-nums` so digits line up, text left, numbers right.
- Tables stay light: hairline row borders, no heavy gridded box, and a wide one scrolls inside its own
  `overflow-x: auto` container so the page never scrolls sideways.
- Any entrance animation stays subtle and honors `@media (prefers-reduced-motion: reduce)`.
- Every figure traces to `source/content/` or `source/facts/`, with the source shown when it's a
  third-party number.

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
