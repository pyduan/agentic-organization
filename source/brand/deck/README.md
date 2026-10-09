# The brand's deck layer

What makes this organization's decks look like this organization's. The kit's engine
(`scripts/deck/`) builds every deck from the components it ships, its base theme, and what is here.
Every file here is yours: a kit update never touches it.

| File | What it holds |
|---|---|
| `theme.css` | the look: the `--dk-*` values first, then any component restyled |
| `components.mjs` | shapes only this brand uses, or a kit component replaced |
| `assets/` | logos, seal, backgrounds, icons; a deck writes them `brand:<file>` |
| `deck.md` | the brand's own deck rules, each with the correction that produced it |

None is required. Without them, a deck takes the brand's colours and fonts from
`source/brand/tokens.css` and the kit's base theme.

## Writing `theme.css` from an old deck

Measure, do not look: `node scripts/deck/read-pptx.mjs <best-old-deck>.pptx` writes a `style.md` with
the type scale in pixels on the 1280 × 720 stage, the colours, the header band and the recurring
images. Then:

```css
:root {
  --dk-paper: #f8f6f1;            /* slide background */
  --dk-ink: #16150f;              /* body text */
  --dk-muted: #5d5950;            /* secondary text: must still pass 4.5:1 */
  --dk-accent: #1f5c4a;           /* titles, emphasis, the one accent */
  --dk-accent-soft: #e3eee8;      /* callouts, light boxes */
  --dk-c1: #1f5c4a;               /* series: steps, card tones, bars, donut, in order */
  --dk-c2: #34557f;
  --dk-font-display: "Source Serif 4", Georgia, serif;
  --dk-font-text: Inter, Arial, sans-serif;
  --dk-size-title: 40px;          /* from style.md: the slide title's px */
  --dk-size-body: 21px;
  --dk-min-font: 13px;            /* the check refuses anything smaller */
  --dk-max-words: 140;            /* the check warns above; raise it if dense is the house style */
  --dk-pad-top: 56px;             /* the margins, i.e. the safe area the check enforces */
  --dk-pad-x: 80px;
}
```

Then restyle what the variables cannot say, by the components' classes (`.dk-chapter`, `.dk-title`,
`.dk-card`, `.dk-callout.is-goal`…): a header band, a background image, a card with a coloured head.
A `url()` in this file is relative to this folder. Mark anything meant to touch the slide edges with
`--dk-bleed: 1` so the margin check leaves it alone.

Check a theme by building every component on it: `node scripts/deck/build.mjs build
scripts/deck/examples`. A text whose measured colour fails the contrast check keeps its colour in
graphics and takes a darker shade as text.

## `components.mjs`

```js
export default ({ S, frame, head, esc, when, cls, img, prose }) => ({
  Project: {
    doc: 'A funded project: name, who, budget, objective.',
    props: { name: { ...S.text(), required: true }, by: S.text(), budget: S.text() },
    children: 'none',
    render: (p, ctx) => `<div class="dk-block dk-project">…</div>`,
  },
});
```

The same contract as `scripts/deck/components.mjs`: a schema the build checks, a render function that
escapes every text through `ctx.md`. A component named like a kit one replaces it.
