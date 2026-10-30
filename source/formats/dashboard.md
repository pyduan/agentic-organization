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
`ORGANIGRAM.md`'s map and reads each `projects/<slug>/`. Two tabs, **Home** and **Projects**.

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

**Changing it.** New words go in the two files above. A new section is a tab in `TABS` in
`apps/dashboard/intranet.mjs` and a page rendered beside the others; the labels of the chrome are
its `STRINGS`, translated in one place. The pages are static HTML built with Node alone, so the
setup can publish the intranet before anything has been installed.

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
