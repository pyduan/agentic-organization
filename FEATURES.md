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

### The intranet, a home page before anything else
A private home page (`apps/dashboard/`, `npm run intranet`): a banner with a quickstart and how the
system works, then stat tiles, who waits on what, where each project stands, what moved, and a card
per tool; a page per project behind a Projects tab with a sidebar. The banner's words are
`source/content/intranet-home.md` and the tools `source/content/intranet-tools.md`, so changing
them is editing a file. A viewer can close the banner and it stays closed on that browser.
**Why:** asked for on 2026-10-30, so that the first thing an organization sees of the kit is its own
private page saying how to work with it, with everything else reached from there. It grew out of
the dashboard rather than beside it (`webapp.md` ▸ *First cut*: an internal app that already works
is enriched, never migrated): same folder, same Worker name, so the Access policy an instance
already attached keeps protecting it, and `npm run dashboard` still works. It stays static HTML
built by Node alone, against `webapp.md`'s Astro default for internal apps, because the setup
publishes it within its first half-hour, before any `npm install`, and a read-only view has no
state that would need components. The company pack's intranet (`packs/company/templates/intranet`)
was the reference for the shape (one header row of tabs, the chrome's words in one table, the
sign-out link, "nothing is edited here"); its code was not reused because it is an Astro app built
over five repos.

### An instance's own views on the intranet
An instance adds tabs, pages, home-page sections and styles to the intranet from one file of its
own, `apps/intranet-extend/index.mjs`, which `npm run intranet` loads when it exists
(`apps/dashboard/extend.mjs`; the contract is `source/formats/dashboard.md` ▸ *Adding your own
views*). Its pages are rendered in the kit's shell with the kit's sidebar, the home page has three
named slots (`top`, `before-tools`, `end`), its stylesheet is appended after the kit's and refused
if it writes a colour instead of a token, and a `test.mjs` beside it runs inside the kit's
`scripts/test-intranet.mjs`, which also builds the instance's intranet and fails on a link to a page
nobody built. Past two tabs, the one row of tabs scrolls sideways on a phone and opens with the
current tab in view. Without the file the build writes the kit's pages byte for byte.
**Why:** 2026-10-30, after two instances had each built an adapter that patched the kit at run time:
pushing into the exported `TABS`, re-rendering the kit's pages from `dist/data.json`, splicing HTML
after `<main class="wrap">`, copying the page shell and testing that the copy still matched, and
chaining a second build in `package.json`. Every joint was one kit change away from breaking, and
the copied shell was exactly the duplicate `AGENTS.md` warns about. The file sits outside every path
`kit-sync` owns, so no update can overwrite it; the kit ships only an invented example
(`apps/dashboard/example-extension/`), built in its tests and never by default. Renders are plain
functions returning HTML, like the kit's own pages, so the intranet still builds with Node alone.

### A local-only intranet that cannot be deployed
`npm run intranet -- --local` lets the extension read `local/`, a git-ignored folder of material
kept on one machine, through `intranet.local`, which is `null` in every other build; the repository
reader refuses `local/` paths. Such a build leaves `.local-build` in `dist/`, every build wipes
`dist/` first (and refuses to wipe a folder that holds no earlier build), and `npm run
deploy:intranet` runs `scripts/intranet-guard.mjs`, which refuses a marked or an empty build.
**Why:** 2026-10-30, after two instances had built the same guard by hand around the kit's build: a
person wants to look at applications or drafts beside the organization's pages, on their own
machine, and the one failure that matters is that view going online. The mark is checked at deploy
time rather than trusted to memory, the wipe is what stops a page from a `--local` build surviving
into the next build, and the reader's refusal makes `intranet.local` the only door, so a view cannot
read `local/` in a build that will be published. Restricted material for the shared intranet comes
from a restricted repository instead.

### Setup starts with the stack, then the intranet
The setup skill's first step with the owner walks `STACK.md`, then `CONNECTORS.md`, row by row, each
row approved or changed with the date and who said yes; the second builds and publishes the intranet
behind Access. The seed is confirmed next, then the interview, the structure and facts (the history
imported through approved connectors only, each import scoped), and the owner's first real task,
built as a recipe the repository keeps; the guides and the site come after. A seeded repository's
service lines are settled in the stack walk, its other lines at the start of the interview.

### One install prompt, and scripts that end where it does
`QUICKSTART.md` ▸ *Install, in one paste* is the kit's one install prompt; `README.md` and
`SETUP.md` link to it, and `docs/helping-another-organization.md` adapts it in the same order for a
seeded repository (taking it over, the first task, the second person). The bootstrap scripts end in
the same state: the workspace folder given its guards (`install-workspace`), and Claude Code opened
on that folder with "set up my organization" on a fresh repository. Every script that ends on a next
step (the bootstrap scripts, `install-workspace`, `setup-status`) takes it from `lib/setup-stage.mjs`,
which reads the brief, the two approval tables and the intranet's build
(`node scripts/setup-status.mjs --next`).
**Why:** 2026-10-30. Each page had grown its own variant of the paste, and they had drifted (one
asked for an SSH key, another for the browser login; none mentioned the stack walk), so an
installer could not tell which one the kit stood behind, and the next step a script printed no
longer matched the setup's order. One prompt, linked rather than copied, and one function for the
next step, keep them from drifting again.
**Why:** asked for on 2026-10-30. The stack is the premise of every later step, so an interview held
before it can assume a host or a mailbox nobody chose. The intranet gives the owner, within the first
half-hour, the private page they will come back to and the instructions for working with the agent,
and everything the session builds afterwards appears on it. It is also the early thing on screen
that owners ask for, built from files, so it does not pull the session towards a website with no
source of truth beneath it.

### Private pages behind Access
The intranet and any page with private material publish as their own Worker behind Cloudflare
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

### A company on five repos, as a pack
`packs/company/`: this repo as a company's central repo, four repos beside it (customers, strategy,
administrative, intranet), and an intranet that reads them at build time, behind Access. Optional,
set up on request by its `company-setup` skill.
**Why:** areas with different readers need repo boundaries, and a pipeline worth steering needs a
view nobody edits; most organizations need neither, so it stays out of the defaults
(`packs/company/DECISIONS.md`, 2026-10-30).

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
`docs/helping-another-organization.md`, with its three prompts for a seeded repository; a repository
seeded before the day (`docs/seeding.md`), which carries their published tools verbatim, their
workflows as the repository's own recipes and proposed rows of `STACK.md` and `CONNECTORS.md` with
no approval; and a format for a repository shared with a partner (`source/formats/partner-repo.md`).
Packs stay the layer shared between organizations; recipes are the organization's own.
**Why:** a workshop stalls on accounts, never on the agent, and an organization that starts from a
seeded draft spends its first hour correcting rather than dictating.

### The infrastructure, written down
`STACK.md`: one row per brick, its state, its way out, and who approved it when.
**Why:** a brick nobody knows how to leave is a brick nobody chose, and another project's stack is
never this one's.

### Connectors, approved row by row
`CONNECTORS.md`: one row per connector or MCP server (Gmail, Drive, Notion and Slack suggested;
Calendar, GitHub, browser control and others beside them), with its status (*recommended*,
*authorized*, *not allowed*, *to decide*), what it may be used for and how far it reaches, who
approves it, and an *Approved* column like `STACK.md`'s. The setup walks it right after the stack,
and the history import uses only approved rows. `setup-status` reads the names of the MCP servers
configured for this repo and its workspace folder (`~/.claude.json`, `~/.claude/settings.json`,
`.mcp.json`), never their settings, and reports one with no approved row (orange), one an approved
row forbids (red), and an approved one it cannot see here. `kit-sync` reports both files rather
than replacing them, and delivers them whole to a project that lacks them.
**Why:** asked for on 2026-10-30. A connector is access to people's mail and files, and the default
reach of one (a whole mailbox, a whole drive, kept open) is wider than any task needs: a one-off
import scoped to a person, a date range or a folder, then disconnected, covers the history, and an
inbox the agents read, which people CC, covers the day to day without reading anyone's mailbox.
Writing the list down makes the reach a decision with a name and a date on it, and checking it
against what is configured on the machine is what catches a server installed for an experiment
and never removed. Names only, because the settings beside them may hold a token.

### The setup check sees the setup's first steps
`setup-status` reports whether every row of `STACK.md` is approved, `CONNECTORS.md` against the
servers configured here, and whether the intranet is named for publishing, built (and not with
`--local`), published at the address recorded in `STACK.md`'s *Private pages* row, and behind a
sign-in (a redirect to Access or a `403` is green, a `200` is red).
**Why:** 2026-10-30, the setup now starts with those steps, and a step that only a conversation
remembers is redone or forgotten. The address is read from the file the setup writes it in, so the
check needs no configuration of its own.

## This organization's own

<!-- Add an entry per feature this repository has beyond the kit: what it does, and **Why:** the
     decision behind it, with its date when there is one. The setup session starts this part. -->
