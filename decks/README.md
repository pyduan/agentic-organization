# Decks

One folder per deck: `deck.mdx` (the content, composed from components), `assets/` (its images) and
`index.html` (built, committed, opened in any browser). Nothing here is served: publishing a deck is
`node scripts/deck/build.mjs publish <slug>`, when the owner asks for it.

`node scripts/deck/build.mjs new <slug>` starts one. The method is `source/formats/deck.md`.
