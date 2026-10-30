# Decisions

The design choices of the company pack. Those of a company set up with it live in its own repos.

## A separate kit became this optional pack (2026-10-30) · technology

The five-repo setup and its intranet grew in a private kit kept beside this one, which made a company
by replaying its own `bootstrap.sh`, tracked every change of the public kit in a ledger, and updated
companies by replaying the bootstrap at two versions and writing only the files they never touched.
That kit was retired, and what it carried came here as an optional pack, so nothing is lost and
there is one kit to maintain.

Three things changed on the way. **The central repo is the kit instance itself**: a company's routing,
rules, brand, decisions (`source/decisions.md`), journal (`source/journal.md`) and inbox are the kit's
own files, and the pack only adds the four repos beside it, with `ORGANIGRAM.md` marking them
`satellite`. **The shared engine is vendored, not duplicated**: the deck and document engine and the
checks are copied from the central repo into `intranet/` with a `vendor/` manifest, so
`npm run vendor:pull` keeps them current. **Update by replay and the upstream ledger are dropped**:
the satellites' files are the company's own from the day they are created, which is what a company
does with them anyway, and the ledger only existed because two kits shared files.

Set aside: keeping the private kit alongside, which doubled every fix; and folding the pack into the
kit's defaults, which would impose five repos on organizations that need one.

## The profile decides what the pipeline contains, not only its label (2026-09-17) · technology

`b2b-services`, `b2b-product`, `b2c-product`. The profile writes the `model` block of `config.mjs`:
the folder read under `customers/`, the field that sets bar height, the one that sets its colour, the
families, the statuses.

The first version offered `services` or `product` and only changed labels. It did not hold: a B2B
pipeline is named accounts moving through stages, a conversation behind each, a bar as tall as the
headcount. A B2C pipeline is segments of a population, a few thousand people who share a reason to
buy, no conversation with any of them, a bar as tall as their number. Those are not two words for one
thing, and a kit that settles only the word leaves the whole job.

The cost: two trees in `templates/customers/`, one dropped at each bootstrap. That is the price of
every template file being a real file, testable before it is copied.

## Colours are numbered slots, not names (2026-09-17) · technology

`--cat-1`…`--cat-5`, `--stage-1`…`--stage-5`, `--who-1`…`--who-5`, plus slot 0, grey, reserved for a
value the configuration does not declare.

They used to be called `--sector-manufacturing` and `--owner-sam`. A kit cannot know the sectors or
the first names of the company it sets up, and generating a hue on demand would lose what makes the
palette worth having: it is validated for colour vision and contrast, in both themes, pair by pair.

So the CSS holds the colours and the configuration holds the meaning. Position N in `model.families`
takes slot N. Reordering the list recolours the chart, which is visible at once and so correctable; a
sixth family needs a validated colour added by hand, which is the intended behaviour.

## The kit stops before deploying (2026-09-17) · business

The bootstrap creates the repos and stops. It does not deploy, does not configure Access, invites
nobody.

Each of those is irreversible in its own way: a Worker deployed without Access serves the content to
whoever has the URL, a misconfigured Access application locks out the people it should let in, and an
invitation to a GitHub organization is a decision about who is part of the company. None of the three
is an installation step. The cost is three more commands, in the `company-setup` skill.

## Placeholders are strings, not a template engine (2026-09-17) · technology

`__COMPANY__` rather than `{{company}}` resolved by an engine. A string leaves every file in
`templates/` openable, readable and runnable as it is: the intranet builds without instantiating
anything, and a syntax error shows in the editor. An engine would make every file wrong until it is
generated.

The cost is that a forgotten placeholder reaches production as a literal `__COMPANY__`. It is
visible, and that is the right side of the trade: a loud omission beats a file nobody can test.

## Two status vocabularies, not one (2026-09-17) · technology

`model.statuses` for the pipeline entities, `model.accountStatuses` for named accounts and projects.
In B2B they are the same; in B2C they differ. A segment is "beachhead" or "later", an installer is
"active" or "prospect". Forcing one list on both makes one of them lie, and the version that tried did
not pass its own content check, which is the right way to find out.

The cost: one more key in the configuration, and two lists to keep in step in B2B.

## A page's title comes from its tab's label (2026-09-17) · technology

`tabLabel("/prospects")` rather than a separate string. Two places naming the same section end up
naming it differently: in the first company set up, the tab said "Market" and the page "Prospects",
on the same page.

## Funnel first, and a template never talks about itself (2026-09-25) · business

The essential first, dense, and no sentence that describes the file or defends the method. The
templates used to open on a paragraph explaining the file; agents kept or imitated it, and every
company inherited pages that began with their own instructions. Those instructions are now HTML
comments: readable by whoever fills the file, invisible on the intranet.

## A deck is composed, and the build refuses it when it fails (2026-10-09) · technology

A deck is a `deck.mdx` in `strategy/decks/` or `customers/decks/`: one component per slide, the
content in its props, nothing else. The engine is the kit's; what the company owns is in
`source/brand/deck/` of the central repo. The intranet builds each deck, measures it in Chrome
(overflow, text under the footer, clipped text, type too small, unequal grids, contrast) and reads its
text with `check-ai-tics`: an error, a defect or a tell refuses it. The refused deck is not served
and the Resources page says why; the build itself does not fail.

A deck written by hand in HTML redesigned its layout every time, and one organization rewrote its
whole deck guide into a hundred and forty lines of contradicting dated corrections without getting
slides it did not have to redo. The organizations whose decks hold compose a register of components
and measure the result. A deck is refused rather than the build because one overflowing slide must
not hold back the pipeline and every customer file. The cost: Chrome on the machine that measures
(the GitHub runner has it), and a brand theme written once, from `read-pptx`'s numbers rather than by
eye.
