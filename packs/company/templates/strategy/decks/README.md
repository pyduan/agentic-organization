# decks

__COMPANY__'s decks: pitch, offer, talks. One folder per deck, `<slug>/deck.mdx` with its images in
`<slug>/assets/`. The intranet builds them and serves them under `/decks/<slug>/`.

The method: `__CENTRAL__/.claude/skills/new-deck/SKILL.md` and `__CENTRAL__/source/formats/deck.md`.
To start one, from `intranet/`: `npm run deck -- new <slug>`.
