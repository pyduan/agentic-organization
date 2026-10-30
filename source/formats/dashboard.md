# The intranet

The organization's private home page: what the people who open it need to start, then where
everything stands, then the tools. Only the owner and whoever they name can open it. It is the
kit's default private app and the first thing the setup publishes, right after the stack is
approved (`.claude/skills/setup/SKILL.md` ▸ *2. The intranet*). It started as a dashboard and grew
a banner and tools around it; the app still lives in `apps/dashboard/` and its Worker keeps its
name, because Access is attached to that name.

Read `voice.md`, `design.md` and `tokens.css` first, like any output. `webapp.md` covers apps in
general; this file covers the one app the kit ships.

## Why it exists

Because the alternative is worse in a specific, repeatable way. Ask an agent for an analysis and it
produces a document: a note, a standalone HTML page, an artifact in a chat. That document is a
**snapshot** — it ages the moment a number moves, it is unfindable three weeks later, and if it was
hosted on a service the owner later changed accounts on, it is simply gone. The fix is not a better
document. It is that the deliverable **is the dashboard**, and the repo files behind it are the
source rather than the destination.

Which gives the rule: **if the information is not reachable on the intranet, in its place, the work
is not finished.** Writing it into a repo file is not enough on its own.

## What it shows

Built by `npm run intranet` (`scripts/dashboard-data.mjs`, which renders the pages in
`apps/dashboard/intranet.mjs` into `apps/dashboard/dist/`). It walks every repo on
`ORGANIGRAM.md`'s map and reads each `projects/<slug>/`. Two tabs, **Home** and **Projects**, plus
the organization's own (*Adding your own views*).

**Home**, top to bottom:

- **The banner**: a quickstart (how to open a session, what to say first, where things live) and
  how the system works (one source of truth, every page a view of it, workflows over one-off
  outputs, every correction a rule, mail and drives as ingestion). Its words are
  `source/content/intranet-home.md`, which the owner edits like any other file: the first heading
  is its title, the paragraph under it its opening line, each `##` a column. It is open on a first
  visit, and a viewer who closes it keeps it closed on that browser; its title opens it again.
- **A few numbers**: projects running, things to do, late, decisions waiting (`#decide`). Counted
  from the data at build time, never written into prose.
- **Who waits on what**: one card per person (`@slug` on the to-do lines), decisions first, then
  what is late, with the items nobody owns last.
- **Where things stand**: a card per subject, with its stage, its progress, and its first few open
  items. The title opens the project's page.
- **What moved**: the latest dated lines from every project's `log.md`, newest first.
- **Tools**: a card per app or page, from `source/content/intranet-tools.md`, one line each
  (`- [Name](address) what it is for`). An address of `TODO` shows the card as not published yet.

**Projects**: every subject, then one page per project with all its open items and its log. The
projects are listed in a sidebar, which folds into one control above the title on a phone
(`webapp.md` ▸ *One row of tabs, then a sidebar*).

**Changing it.** New words go in the two files above. A view of this organization's own (a tab, a
page, a section on the home page) goes in its extension, below, never in `apps/dashboard/`: that
folder is the kit's, and the next update replaces it. A change every organization would want goes
to the kit itself (`apps/dashboard/intranet.mjs`, its `TABS` and its `STRINGS`). The pages are
static HTML built with Node alone, so the setup can publish the intranet before anything has been
installed.

## Adding your own views

An organization that needs more than the kit's two tabs (its grantees, its rota, its pipeline)
writes them in **`apps/intranet-extend/index.mjs`**. `npm run intranet` loads that file when it
exists; it sits outside every path `kit-sync` owns, so no kit update touches it. Without it, the
build writes the kit's pages byte for byte. The machinery is `apps/dashboard/extend.mjs`, and an
invented, working example is `apps/dashboard/example-extension/` (built with
`node scripts/dashboard-data.mjs --extend=apps/dashboard/example-extension/index.mjs`).

```js
// apps/intranet-extend/index.mjs
export default async function extend(intranet) {
  const shifts = intranet.read('rota.md');            // a missing file reads as ''

  intranet.strings({ 'nav.rota': 'Rota' });          // words for the chrome, or the kit's translated
  intranet.tab('rota/', 'nav.rota');                 // before Projects; { before } or { after } to place it
  intranet.page('rota/', (c) => ({
    title: 'Rota',
    side: { label: 'Rota', links: [{ to: 'rota/', label: 'Coming shifts' }, { to: 'rota/swaps/', label: 'To fill' }] },
    body: `<h1>Coming shifts</h1>…`,
  }));
  intranet.home('top', (c) => `<h2>This week</h2><div class="tiles">${c.tile(3, 'shifts coming')}</div>`);
  intranet.css(new URL('./rota.css', import.meta.url));
}
```

**What the extension receives** (`intranet`), while it registers:

- `read(rel)`, `exists(rel)`, `list(rel, { ext, dirs })` and `todos(rel)` (a to-do file parsed by
  `lib/todo.mjs`), all from the repository's root, `local/` excepted; `local`, the same four on
  `local/` in a `--local` build and `null` in every other (below); `root`, `today`, and `data`, what the kit's build
  gathered (`projects`, `recap`, `org`).
- `esc`, `inline`, `renderMarkdown` and `slugify` from `scripts/doc/markdown.mjs`.
- `strings(words)`, `tab(path, label, { before, after })`, `page(path, render)`,
  `home(slot, render)` and `css(source)`, below. The function may be `async`; the renders may not.

**A tab** is a folder path (`'rota/'`) and a label, a key of the strings or the text itself. Tabs
go before the kit's Projects in the order they were added, unless `before` or `after` names another
tab. There is still one row: past two tabs, on a phone, the organization's name takes its own line
and the row scrolls sideways inside the header, opening with the current tab in view.

**A page** is a path (`'rota/'` or `'rota/swaps/'` for a page, `'rota/feed.json'` for a file) and
a render. The render gets `c`, the helpers above plus the pieces bound to where the page sits:
`c.href('rooms/')` for a link that works at any depth, `c.base`, `c.path`, `c.t(key)`,
`c.tile(n, label, note)`, `c.todoRow(item)`, `c.projectCard(project)`, `c.feed(entries)`,
`c.withSide(side, html)` and `c.shell({ title, body, tab })`. It returns `{ title, body }`, and the
kit puts the body in its shell inside `<main class="wrap">`; with `side`, in the kit's sidebar
instead (`{ label, links: [{ to, label, sub, group }] }`: `sub` indents a link under the one above,
`group` makes a heading; the page's own path is the current link), folded into one control on a
phone. `tab` names the tab to light when it is not the one the path starts with (`''` for Home). A
render that returns a string writes that file as it is. A path the kit already uses is refused.

**A home section** goes at one of three slots: **`top`**, under the banner and above the numbers;
**`before-tools`**, after the kit's dashboards; **`end`**, last on the page. The render gets the same
`c` as a page at the root, and returns HTML.

**Styles** (`css(new URL('./x.css', import.meta.url))`, or the text) are appended after the kit's,
each under a comment naming its file. Tokens only: a stylesheet that writes a colour as a value
(`#c00`, `rgb(…)`) stops the build. The kit's classes are there to use (`cards`, `card`, `tiles`,
`pill`, `badge`, `todo`, `feed`, `empty`, `note`, `page-head`); add a class only for what they do
not cover.

**Tests.** A `test.mjs` beside the extension runs inside `scripts/test-intranet.mjs`, so `npm test`
runs it with no change to `package.json`. The kit's test also builds this instance's intranet with
its extension and fails on a page that prints `undefined` or links to a page nobody built
(`brokenLinks` in `extend.mjs`, there for your own tests too).

**Material kept on one machine** (applications under review, a draft, an analytics export) goes in
`local/` at the repository's root, which `.gitignore` keeps out of git. `npm run intranet -- --local`
lets the extension read it, through `intranet.local` (also `c.local` in a render): the same `read`,
`exists`, `list` and `todos`, rooted at `local/`. In every other build `intranet.local` is `null`, and
the repository reader refuses a path inside `local/`, so a view tests `if (intranet.local)` and shows
something else otherwise. A `--local` build is for reading on that machine: it leaves a
`.local-build` file in `dist/`, and `npm run deploy:intranet` refuses to publish a marked build, or
an empty one (`scripts/intranet-guard.mjs`). Every build wipes `dist/` first, so nothing a `--local`
build wrote survives into the next one. What the shared intranet must show to only some people
comes from a restricted repository on the map, never from one person's `local/`.

Never reach into the kit from the extension: no pushing into the exported `TABS`, no rewriting a
built page, no copy of the shell, no second build chained in `package.json`. Each of those breaks
silently at the next kit update, which is why this contract exists; when it lacks something you
need, ask for it in the kit rather than patching around it.

## Rules that come from getting this wrong

- **Organize by subject, never by repo.** The owner opens this to see where a *thing* stands, not
  which repo holds what. A home page with one card per repo shows them your plumbing, and when one
  subject's tooling is split across two repos it shows the same subject twice.
- **One door per subject.** If two apps touch the same subject, the card links to the one where the
  work happens; anything else is reachable from inside it. Two doors on one card means choosing
  without knowing what is behind either.
- **Components, not rendered markdown.** Bullet lists, file paths and pasted headings are not an
  interface. Use the pieces the scaffold already has (number tiles, stage pills, progress meters,
  cards, the dated feed) and give them room; crowded is a defect. Never link to a file the page
  cannot open — if it deserves to be read, render it here.
- **No system objects in the navigation.** An entry names something the owner wants to *do*. The
  registry of repos, the list of mounted apps, the paths on disk: that is machinery, and it goes in
  one labelled place out of their way, or nowhere.
- **Never say a subject "has no app".** It has a page here, always. What may be missing is a
  *bespoke tool* for it (a simulator, a timeline, a document viewer) — say that instead, because the
  short version reads as "there is nothing for this".
- **Say what is unfinished, in the data.** An item that cannot be acted on today is not a to-do:
  it is a wait, and it belongs on a date, not in a list of tasks. A figure that is not established
  carries its status next to it (see `docs/failure-modes.md`).

## Where it lives, and why it is one dashboard and not one per repo

**In the org repo, aggregating the others.** One page for the person, not one per repo. The map in
`ORGANIGRAM.md` tells the builder which repos exist; each project stays owned by its own repo, and
only titles, stages, counts and dated lines travel into the page.

A project that should not export its wording writes one line in its `charter.md`:

```
dashboard: counts-only
```

It then shows its stage and its counts and nothing else — enough to see it exists and that it is
moving, with no sentence leaving its repo. That is the honest default for anything confidential;
turning it up to full is a deliberate, dated line in `source/decisions.md`, not a quiet edit.

A whole repo says it for itself in a `.read-consent` file at its root: `counts`, and the dashboard
shows it as one line of summed counts with no project named; `none`, and it only says the repo is
there. That one binds every tool that reads beside its repo, not only this page:
[`read-consent.md`](read-consent.md).

**Per-repo exception:** a tool that only makes sense inside one project (a calculator for one
client, a simulator for one dataset) stays in that repo under `apps/<slug>/` per `webapp.md`. The
dashboard links to it. What must not happen is a second dashboard.

## Publishing

Never a public URL "nobody knows" — a URL is not a lock; it ends up in a history, a screenshot, a
chat message. It publishes as its own Worker with a Cloudflare Access policy attached, per
`docs/deploy-cloudflare.md` ▸ *Publishing something private*. `npm run deploy:intranet` builds and
deploys (`deploy:dashboard` is the same command under its old name); who may open it is the Access policy's list of emails, kept as a file in the repo and
applied with `node scripts/protect-access.mjs`, changed whenever someone joins or leaves.

Verification is the only part that counts: request it from a browser you are **not** signed into. A
login redirect or a `403` is right. A `200` is an incident.
