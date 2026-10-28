# Documents: A4 pages from one markdown file

A proposal, a one-pager, a list of prerequisites, minutes, terms of reference: anything someone will
print, attach or sign. One file, `documents/<slug>/document.md`, becomes a standalone page of real
A4 pages (`index.html` beside it) and a PDF from the same build. What the screen shows is what the
printer produces, because the pages have a physical size.

```sh
node scripts/doc/build.mjs new <slug> [--onepager]   # start one
node scripts/doc/build.mjs <slug> [--pdf]            # build, check in Chrome, print
node scripts/doc/build.mjs --all --strict            # before anything leaves
```

## The file

Frontmatter, then markdown:

| Key | What it does |
|---|---|
| `title`, `subtitle` | the title block. A title is a label: no dash splitting it, no comma outside a list |
| `type` | `document` (default) or `one-pager`, which must fit on one page in two columns |
| `lang` | the typography (French spaces, curly apostrophes) |
| `kicker`, `author`, `date` | the lines around the title |
| `mark`, `running-head`, `foot` | the running head on every page, and the footer's left side |
| `brand` | a second brand's tokens (`[data-brand="x"]` in `source/brand/tokens.css`) |
| `to-complete` | what is still missing, shown above the pages on screen and never printed |

`##` opens a numbered band, `###` and `####` go below it. Lists, tables, quotes and code work as
usual. The directives, each closed by `:::`: `rows` (label and text lines), `cols` and `compare`
(sub-blocks opened by `###`; the last card of a comparison is the option the document argues for),
`steps`, `timeline`, `callout`, `quote`, `facts`, `fold` (folded on screen, open in print), and
`:::pagebreak`, which stands alone.

**A shape that is missing becomes a directive in `scripts/doc/markdown.mjs`, never CSS inside a
document.** Five ways of drawing a table is how a set of documents stops looking like one
organization.

## How the pages are cut

`scripts/doc/paged.js` pours the blocks into pages in the browser. A list or a table is cut between
two items, never inside one, and a table repeats its header on the next page. A heading never ends
a page, and neither does a sentence ending in a colon: both leave with what they announce. A block
taller than a whole page is placed anyway and flagged, and the check fails on it: split it.

## Blanks: visible, never invented

A value nobody has given you is written `[what goes here]`. It is highlighted on screen, it prints
without the highlight, and the build counts it. A price nobody wrote is "to be set", never a zero;
a step without a contract says "none". The `to-complete` list says what the document still waits
for, and `--strict` fails while either one is non-empty, which is the run to do before it leaves.

## The check

The build opens every document in Chrome and waits for the pagination. It fails when the
pagination never finishes, when the page throws an error, when a block is taller than a page, and
when a one-pager runs past one page. Exit codes: `0` clean, `1` a defect, `2` nothing to check or
no Chrome on this machine.

## Sending one

One folder per recipient when a document goes to someone outside: files numbered in reading order,
each PDF beside its source, the mail draft beside them, and a README naming the version, its date,
what changed since the previous one, and what is still open. Then "which version did we send?" has
an answer that is not someone's memory.

Before printing for real, search the PDF for `/Shading` and `/PatternType`
(`source/formats/deck.md` ▸ *Printing is not displaying*): the stylesheet prints flat, a document
that brings its own images may not.
