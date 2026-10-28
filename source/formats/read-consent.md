# Read consent: what a neighbour may read of a repo

An organization spread over several repos has tools that read beside their own: the dashboard,
the to-do app's list of sources, the workspace and fleet checks, the sync. Most repos are happy to
be read. Some are not, a client's repo cloned beside the organization's, or an area only some
people may open, and until now they could only hope each tool remembered. This is how a repo says
it, and how the tools are made to hold to it.

The repo says it itself, in a `.read-consent` file at its root that holds one of three words
(a `#` starts a comment):

| Word | What a neighbouring tool gets |
|---|---|
| `full` | everything, as before. This is the default when there is no file |
| `counts` | shapes only: whether a file exists, numbers, yes or no, dates and commit ids. No titles, no to-do lines, no names or addresses from its history. The dashboard sums it into one line, the to-do app does not list it, the sync pulls it without reading its commit messages |
| `none` | nothing. The tools name it, since the map already does, and leave it alone |

A file that says anything else counts as `none` and the checks report it, so a typo never opens a
repo. The limit is held in one place, `lib/neighbour.mjs`, which every read of another repo goes
through and which refuses what the level does not allow. A `dashboard: counts-only` line in a
project's charter still works, for one project inside a repo that is otherwise `full`.

It binds scripts. An agent session that opens the files by hand is held by that repo's
`CLAUDE.md`, so a repo at `counts` or `none` says the same thing there, in its *Where this repo
sits* block.

## When to write one

When a repo holds wording that should not appear in another repo's dashboard, to-do app or session
report. A client's own repo usually wants `counts`, so the organization still sees that it moves;
a repo of private material wants `none`. Write it in the same commit that
makes the repo sensitive, and say the same in its `CLAUDE.md`. A repo that has nothing to hide
needs no file.

### A copy another repo generated

When a folder here is written by another organization's or another repo's sync, mark it
`.read-consent: none` so the origin's own tools never read their export back as a new source, and
never correct it by hand: the next sync overwrites it. Corrections go to an inbound folder the sync
does not touch (`source/formats/partner-repo.md`).

## For a script that reads another repo

Go through `neighbour(dir)` in `lib/neighbour.mjs`, never `readFile` on a path in another repo.
Each of its methods refuses what the level does not allow by throwing `ReadRefused`. At `counts`, `measure` and `history` take a function that
turns the text into numbers, and its result is checked before it comes back. The repo the script
runs in reads itself with `neighbour(dir, { self: true })`, which is always `full`.
