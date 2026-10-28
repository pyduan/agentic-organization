# Features and design decisions

What this repository does, one feature at a time, and the decision behind each: why it is built
this way rather than the obvious other way. Read it before proposing to change how something works,
so the reason it is this way is on the table. A change that adds, changes or removes a feature
updates its entry in the same commit (`AGENTS.md` ▸ *Working rules*).

Two files, two kinds of decision: `source/decisions.md` holds what the organization decided about
itself (its positioning, its hypotheses), this file holds what was decided about how the repository
works. The first part comes from the kit and is updated with it; the last part is this
organization's own.

## From the kit

### One repository is the source of truth
Content, facts, voice, brand and formats are plain files in `source/`; the site, the decks, the
documents and the apps are derivatives rebuilt from them.
**Why:** a fact changed once at the source is right everywhere by construction, and Git keeps every
version. A tool people edit by hand (a drive, a CMS, a project board) drifts, and nobody knows which
copy is true. External tools are read and ingested, never written back as the record.

### The agent's manual is `AGENTS.md`
The rules, the routing table (which guide to read for which task) and the map of the repository.
`CLAUDE.md` is one line that imports it.
**Why:** `AGENTS.md` is the name coding agents read across vendors, and the repository should not
be married to one of them. The one-line `CLAUDE.md` keeps Claude Code loading it automatically.

### Guides that inherit from one another
`voice.md`, `design.md` and `tokens.css`, a playbook per format in `source/formats/`, and a
person's own voice on top.
**Why:** an owner maintains a guide once instead of prompting the same preference in every session,
and a correction becomes a rule the next session reads.

### The website, published on every push
An Astro site in `site/`, served by Cloudflare Workers, which rebuilds on every push to `main`.
**Why:** free, fast, and the owner never touches a deploy. The host is replaceable: the source is
the repo, and `docs/deploy-cloudflare.md` says how to move.

### Decks, composed and measured
`decks/<slug>/deck.mdx`, composed from components, built into one shareable HTML file, then measured
in Chrome for overflow, overlap, contrast and copy rules.
**Why:** a deck built from components looks like the organization every time, and a check in a real
browser catches what an author's screen hides. A missing shape becomes a component, never CSS in a
deck.

### Documents on real A4 pages
`documents/<slug>/document.md`, paginated in the browser into physical pages, checked in Chrome,
printed to PDF from the same build. Blanks stay visible until filled.
**Why:** what the screen shows is what the printer produces, and a value nobody gave is never
filled with a guess (`source/formats/document.md`).

### Private pages behind Access
The dashboard and any page with private material publish as their own Worker behind Cloudflare
Access, with a list of addresses and a one-time code (`scripts/protect-access.mjs`).
**Why:** a secret URL is not a lock; it travels in screenshots and chat. An address on a list is
revoked by deleting a line. Every Worker that checks identity fails closed
(`scripts/check-access-config.mjs`).

### Projects and team, as optional modules
`projects/<slug>/` for the work the organization drives; `team/` for a manager's notes, gitignored
and local-only.
**Why:** the same repository can run the organization's work, but only when the owner wants it; and
people data never leaves the machine it was written on.

### Packs
`packs/<slug>/`: skills, scripts and formats another organization can install. A pack only adds
files and carries a permanent id.
**Why:** sharing what one organization built without either side editing the other's files, and
feedback that still reaches the right pack after a rename (`source/formats/pack.md`).

### The quality loop
An incident register (`source/quality/incidents.json`), the failure families it is filed under
(`docs/failure-modes.md`), a preflight before delivery, and an anonymized report for the kit's
maintainer.
**Why:** the rules record what to do; the register records what went wrong, which is the only way
to know whether the rules work.

### Guards that refuse
Hooks hold a message leaving in someone's name for a person's yes, refuse to end a turn on an
unchecked claim, and check every repository for unsaved work at the end.
**Why:** a rule in prose is re-read by someone who already believes it; a hook says no.

### A workspace of repositories, and the fleet
Repositories cloned side by side in one folder, kept current at session start; `ORGANIGRAM.md` maps
them; `check-fleet` says which projects run the kit and how far behind each is.
**Why:** one agent reads across a project, the brand and a client together, and a stale clone ships
a wrong fact.

### Kit updates that never overwrite the owner
`scripts/kit-sync.mjs` applies what only the kit changed and reports what both sides changed.
**Why:** an instance keeps its own rules and still takes the kit's fixes; nothing is merged silently.

### Code shared with another repository
`scripts/vendor-sync.mjs` keeps files two repositories co-own byte for byte identical, with a
manifest of hashes.
**Why:** a library copied by hand forks the first week, and a fix in one place never reaches the
other.

### Checks for what leaves
`check:leaks` (names that must not travel, from a list never committed), `check:ai-tics` (what reads
as machine-written), `check:retired` (a route a decision retired), `check:contrast`, and the freshness
sweep of what is published.
**Why:** each one was a mistake that reached a reader before it had a check.

### Installing the kit for someone else
`docs/helping-another-organization.md`, a repository seeded before the day (`docs/seeding.md`), and
a format for a repository shared with a partner (`source/formats/partner-repo.md`).
**Why:** a workshop stalls on accounts, never on the agent, and an organization that starts from a
seeded draft spends its first hour correcting rather than dictating.

### The infrastructure, written down
`STACK.md`: one row per brick, its state and its way out.
**Why:** a brick nobody knows how to leave is a brick nobody chose, and another project's stack is
never this one's.

## This organization's own

<!-- Add an entry per feature this repository has beyond the kit: what it does, and **Why:** the
     decision behind it, with its date when there is one. The setup session starts this part. -->
