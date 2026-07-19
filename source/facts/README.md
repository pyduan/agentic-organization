# Facts & key figures

Sourced facts and statistics you might cite on the site or in a deck: a number from a report, a
sector benchmark, a competitor's figure, anything that came from outside. This is different from
`source/content/`, which holds your own canon (your bio, your prices, your dates). A figure here
only earns its place once it has a source attached.

## Layout

One markdown file per topic or per source (`2026-sector-report.md`, `competitor-benchmarks.md`).
For each fact, write down the number, enough context to use it correctly, and where it came from:
a URL, a document name and date, or who told you.

```
| Figure | Context | Source |
|---|---|---|
| 40% | of small galleries in France now sell online, per a 2026 CGA survey | cga.fr, survey PDF, p.3 |
```

## Rules

- Cite the source. A number with no source isn't usable yet; find it or don't cite it.
- Flag anything that needs a check before it goes public (`<!-- verify before use -->`).
- Never blend a third-party figure with your own numbers from `source/content/` without saying
  which is which; a page or deck that mixes them should make the distinction obvious to the reader.
- The AI never invents a number here. If a stat comes up in conversation, it either finds the real
  source or asks you for it.
