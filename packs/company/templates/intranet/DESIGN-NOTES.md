# Design notes

Why things look and behave the way they do. These were in `DECISIONS.md` and they crowded out the
ones that bind: a decision log is read to settle an argument, and eleven notes about card layout
between two of them is how it stops being read.

They are kept because the reasoning is real and the same questions come back. The test for which
file something belongs in: **would someone relitigate it in a meeting?** If yes it is a decision. If
it would only ever be revisited by whoever next opens the file, it is a note.

## The pipeline chart encodes size and sector separately (2026-09-16) · technology
Bar length is headcount, colour is sector. Colour never carries size and length never carries kind.

Every bar is directly labelled with the company name, so identity never rests on colour alone, and
the same data appears as a table directly below the chart.

A company whose headcount is not confirmed gets a hatched stub in its sector colour rather than a
short bar. A short bar reads as "small" and the truth is "not known", which is a different claim and
the one we keep making about this pipeline.

The colours were validated for lightness, chroma, colour-vision separation and contrast against both
theme surfaces, and dark mode has its own steps rather than being a flip of the light ones. They are
not to be adjusted by eye.

## The dashboard is totals, chart, then work (2026-09-16) · technology
No lead paragraph, no table under the chart, no positioning boxes. Tiles, the pipeline, then the
next steps and the open questions.

The positioning and the ideal customer profile moved to About, where someone goes to read them. On
the dashboard they sat between the pipeline and the work, and the dashboard is opened to see what
needs doing. The table under the chart said exactly what the chart said.

## The pipeline chart runs vertically (2026-09-16) · technology
Columns rather than rows. The first version ran horizontally, which read well and used the full page
width for six companies. Columns say the same thing in a third of the space, and this sits at the
top of the page above the work.

A company with no confirmed headcount gets a short hatched stub in its sector colour. The first
vertical version drew that stub full height, which made "not known" the tallest bar on the chart.

## Prospects is one flat grid with filters (2026-09-16) · technology
Grouping under status headings made the page read as five short lists and made two companies at
different stages hard to compare. The status is on the card in colour, and the filter bar does the
grouping on demand, by status and by sector.

Clicking an active chip clears it, so the whole bar is reachable without going back to find All.

## Projects are nested inside their customer (2026-09-16) · technology
`/customers/<company>/<project>`, not `/projects/<slug>`.

A project only means something inside its customer: the stage, the people and the value are all
read against the account. The flat route made the two pages look like peers, and the customers page
now groups by customer anyway.

## The customers page opens with a capacity timeline (2026-09-16) · technology
Every dated milestone across every customer, one lane each, on one axis.

It answers the question the page exists for, which is load. Who is in delivery is on every other
page; that two workshops and a seminar land in the same fortnight is only visible here. A milestone
recorded to the month sits on the first and is drawn hollow, so the drawing does not claim precision
the file does not have.

## Key facts are boxes, not bullets (2026-09-16) · technology
Each fact gets its own outlined box, on cards and in running prose. They are the only lines most
people read, and a row of boxes is scannable where a bulleted paragraph is not.

## The display face has to be normal width (2026-09-16) · technology
Instrument Serif went in first and was replaced with Source Serif 4. It is a condensed face: at 22px
on a card title it reads as cramped, and it was called hard to read. A display face here is read,
not admired.

## "More" appears only where something is hidden (2026-09-16) · technology
Cards render every fact, clamped to a fixed height so a row matches. A script measures after layout
and adds the control only to cards that actually overflow.

The first version split the facts at three and showed "More" on any card with a fourth, which put a
control on cards with nothing behind it and left every card a different height.

## The journal is decisions, and contact history sits where its context is (2026-09-16) · technology

The journal page was "what we learned" plus every dated contact across every file. Both moved.

Insights went to Product, where an observation about the offer belongs. The full contact history
went to the customer pages, where the reader already has the account in front of them. What is left
on the journal is the decision log, typed and filterable, which is the thing people actually come
back to a journal for.

Prospects keeps a rail of major events, filtered to open accounts and built from milestones rather
than journal entries. A milestone is already the curated version: somebody decided it was worth a
line. Every mail in a thread is not a major event, and a rail that lists them is a rail nobody reads.

## The nav scrolls itself, and the timeline scrolls inside its panel (2026-09-16) · technology

Both were the same bug twice: a flex or grid child sizes to its content unless told otherwise, so
`overflow-x: auto` never engaged and the whole page scrolled sideways on a phone instead.

Measured rather than eyeballed, on every route at 375px: four of eleven overflowed, the worst by
246px. `min-width: 0` on the offending children fixes it, and it is now set once in `global.css`
rather than hunted per component.

The capacity timeline gets its own scroller besides. Five lanes at 375px is unreadable however it is
laid out, and its tooltips are absolutely positioned and were extending the page's scroll width even
while hidden.
