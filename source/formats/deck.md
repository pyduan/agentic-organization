# Deck playbook

Presentations are derivatives of the same brand as the site: same tokens, same voice, same imagery rules. Read `voice.md` and `design.md` first, then this.

## Shape

One deck = one self-contained HTML file at `site/public/decks/<slug>/index.html`, live at `https://<domain>/decks/<slug>/` about a minute after pushing. Self-contained means everything inline: styles, scripts, and the current token values copied in from `source/brand/tokens.css` (decks must keep working as a single file someone downloads or opens offline). Images may reference `/` paths when the deck lives on the site, but a deck meant to travel embeds or bundles them.

Start every new deck from `source/formats/deck-template.html`, which provides the slide engine: fixed 16:9 canvas scaled to fit any screen, arrow-key and click navigation, a slide counter, URL hash per slide, and print-to-PDF support.

## Building one

1. Establish with the owner: audience, occasion, the one thing the audience should remember, and language. Pull facts from `source/content/` and any sourced third-party figures from `source/facts/`; never invent numbers.
2. Draft the narrative as a slide list (title + one line each) and confirm it before designing. Restructuring an outline is cheap; restructuring finished slides is not.
3. Design within the system: tokens for everything, one idea per slide, type large enough for the back of a room. If a slide needs a smaller font to fit, the slide has too much on it.
4. Preview locally (serve via the site's dev server or open the file directly), walk the owner through it, iterate.
5. Publish by pushing, then hand over the live URL.

## Content rules

- The deck supports a person speaking; slides carry the anchor, the speaker carries the detail.
- Numbers get a source; either in `source/content/`/`source/facts/` or in small print on the slide.
- Consistent slide anatomy: recurring layouts (title slide, statement slide, evidence slide) rather than a new composition each time.

## Presenting and sharing

- Present in a browser, fullscreen (F11 or ⌘⌃F), arrow keys to navigate.
- Share the live URL; the hash (`#5`) links to a specific slide.
- PDF when requested: print from the browser; each slide becomes exactly one page, printed at the **same fixed 1280×720 canvas** as on screen. The print box *is* the design box, so a slide that fits on screen fits the page, and anything overflowing the canvas is clipped in the PDF exactly as it is on screen. This is the real teeth behind "one idea per slide": if it doesn't fit the canvas, cut content, never shrink it or let it spill onto a second page.
- **Export rule — the print box is fixed and full-bleed, whatever the screen or fullscreen state.** In `@media print`: pin `@page{size:1280px 720px;margin:0}` and the slide to `1280×720`; **reset any inherited scale transform** (`.slide, body.pres .slide, body.rot .slide { transform: none }`) or slides print as shrunken, overlapping vignettes; and **force backgrounds on** (`-webkit-print-color-adjust: exact; print-color-adjust: exact` on `html, body, *`) or the browser strips dark backgrounds and coloured cards. One slide per page: `.wrap/.slide { page-break-after: always; break-inside: avoid }`. This lives in `deck-template.html`, so every deck inherits it. For a clean machine-side export, headless Chrome honours this CSS: `chrome --headless=new --no-pdf-header-footer --print-to-pdf=out.pdf "file://…/index.html"`.
- For phone / chat / platform demos inside a deck, see `demos.md` (real-phone look, actions as a platform card, never brand-colour the bubbles).
- A deck that must stay private doesn't get pushed: keep it out of the repo entirely and present it locally, since the repo publishes on push.
