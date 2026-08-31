# Web app playbook

The kit builds apps, not just pages: a calculator, a booking or intake form, an interactive
simulator, a small internal tool, a dashboard over a data file. Same brand, same rules, same
publish loop as the site — read `source/brand/voice.md`, `design.md` and `tokens.css` first, like
for any output.

## Who decides there should be a tool

The common failure is not building the wrong app. It is never building one.

An owner who does not write software asks their agent questions and gets answers, and a good answer
feels like the end of the exchange. So a subject that deserved a tool gets handled as a rolling
conversation instead: the same arithmetic redone by hand each session, from whatever the transcript
happened to keep, with no two answers computed the same way. Nobody notices, because every
individual answer looked right. **Waiting to be asked for an app is the same as deciding there will
not be one**, since the person who would ask does not know it is on the menu.

So proposing it is your job, not theirs. Four conditions, and it is the conjunction that matters:

1. the same question comes back with different inputs — a simulation, not a one-off;
2. the answer is a figure assembled from several sources;
3. being wrong costs something real: money, a deadline, a legal position;
4. the inputs move under you — a rate, a balance, a valuation, a rule.

When all four hold, stop answering the question and say so plainly: what the tool would hold, what
it would check, roughly what it costs to build, and what stays manual. Then build it if they agree.
One tool per body of facts that moves together, not one per question asked — the unit is the domain
(the retirement position, the cash runway, the grant pipeline), because that is what has to stay
consistent with itself.

### A computing tool carries its own checks, or it is only a nicer way to be wrong

The interface is not the point. The point is that a machine finally has something it can refuse.

A projection with a slider is prettier than the same projection in prose and no more trustworthy. The
version that earns its existence is the one where **every figure traces to a sourced entry, the
totals are recomputed at display time rather than stored, and a projection that no longer reconciles
with its inputs refuses to render** — showing the two numbers and the gap instead of the chart. Same
for anything that must sum: an allocation that no longer totals 100%, a schedule whose instalments
no longer add to the principal, a budget whose lines drifted from the header figure.

Write those as real assertions in the code, run on every change, not as a note in the README. This is
the whole reason to prefer a tool over a well-written answer: a rule that lives in prose is re-read
by someone who already believes it, while a rule that lives in the recomputation gets the chance to
say no. Where an invariant genuinely cannot be expressed, say so in the interface rather than
implying the check exists.

Figures that will inform a real decision also carry their provenance where the reader is looking, not
in a footnote: the source and the date the value was last confirmed, next to the value. `source/facts/`
holds the sourced entries; the app reads them, never its own copy.

## Page or app?

Before creating an app, check the ladder:

- **It mostly displays content** (even interactive touches: a gallery filter, an accordion) → it's
  a **page or collection** on the site, per `source/formats/website.md`. Don't create an app.
- **It's a tool someone uses** (inputs → computation or flow → result: a simulator, a configurator,
  a multi-step form, a game) → it's an **app**, per this playbook.
- **It belongs to a different project or brand** → it's a **new repo**, not an app here (the
  `new-project` skill makes that call).

### First cut: which side of the gate is it on?

Before the ladder, one question settles most of it.

> **Is it behind the access gate, or is it a public surface?**

**Behind the gate — an intranet app, a dashboard, a tool for the owner and a couple of named
people — is Astro by default.** Not "when it needs components": by default. These are the apps that
get opened daily, changed weekly, and always end up holding state, because that is what a tool for
your own people is for. Hand-rolling them is a bet that they will stay simple, and that bet loses
every time. Start with the build step and stop thinking about it.

Two boundaries on that default, both learned on a live project:

- **It decides what you build, not what you replace.** An internal app that already works, already
  aggregates several sources, and is already the one place people open is enriched, never migrated
  by default: port the missing piece into it. A rewrite is a trade-off whose cost depends entirely
  on what exists, and two to-do lists make zero to-do lists. Read "by default" at creation time.
- **Behind the gate, Astro means static output with no adapter.** The build step is bought for
  components, Tailwind and shadcn, none of which needs a server. Adding the Cloudflare adapter
  turns the app into a Worker with Static Assets, a shape that silently breaks identity checks:
  read *Access and identity* below before deploying anything behind the gate.

**A public surface is a judgement call.** A marketing page, a landing page, a calculator someone
lands on from a search: static is very often exactly right, it is faster, it survives longer, and
it has no dependency tree to maintain. The site itself already has its own playbook
(`website.md`); for a public *tool*, the test below decides.

So the rest of this section is about the public side. Internal is settled: Astro, static, no
adapter.

### The test that decides how much machinery a public tool gets

"A tool someone uses" is too soft to build on: a filter is interactive, an accordion is
interactive, a calculator is very interactive, and none of them need a framework. The question that
actually predicts whether you will regret a hand-rolled build is narrower:

> **Does the user change data that has to outlive the tab?**
>
> - **No** — they change inputs to a computation and the result is thrown away when they close it.
>   A calculator, a simulator, a configurator that ends in a summary to copy. **Shape 1** below.
> - **Yes** — they tick, reorder, schedule, assign, edit. **Shape 2**, and go there immediately.

Two corollaries, because people get this wrong in both directions:

- **A read-only view is Shape 1, however rich.** A dashboard rendering numbers, cards and charts
  from a data file, with filters, changes nothing that outlives the tab. Charts do not make an app.
- **A single persisted write is Shape 2.** One checkbox that must still be ticked tomorrow needs an
  id, a write path, an optimistic state and an error state. That is a component, not a script tag.

## Shape

One app = one self-contained folder at `apps/<slug>/` (see `apps/README.md`). Three shapes, chosen
by the test above rather than by taste:

1. **A single static folder** — `index.html` + inline or co-located CSS/JS, no build step, no
   framework. Right for a **public** tool that computes and forgets; a single file someone could
   download and open still works. Never the shape for something behind the gate.
2. **An app** — its own `package.json` inside `apps/<slug>/`: Astro shell, Tailwind, React islands,
   [shadcn/ui](https://ui.shadcn.com) components. The default for everything internal, and where a
   public tool lands as soon as it persists what the user did.
3. **An app with a real backend** — see the escalation section below. Rare, and deliberate.

**Do not pass through Shape 1 on the way to Shape 2.** The failure mode is well documented and
always identical: a static page grows a checkbox, then a second, then a sort, then a date picker,
then hand-rolled state management, and by the time it is obviously an app it is a thousand lines of
vanilla DOM nobody wants to touch. The cost of starting at Shape 2 is a `package.json`. The cost of
arriving there sideways is a rewrite.

**Why shadcn/ui and not a component library.** Because it is not a dependency: the components are
copied into the repo as source and owned there. That is the same argument this kit makes about
everything else — own your source, stay lock-in-free. A library you import is a library you are
stuck with; a component in `apps/<slug>/src/components/ui/` is a file you edit. Companions, by
need: **dnd-kit** for drag and reorder, **Recharts** through shadcn's chart wrapper for graphs,
**react-day-picker** for dates, **TanStack Table** for tables, **FullCalendar** only when month and
week views are genuinely required.

Either way: colors, fonts, and spacing come from `source/brand/tokens.css` (copy the current
values into a token block at the top of the app's CSS, like the deck template does, so the app
stays self-contained); the voice guide applies to every label and message.

**Every app ships a favicon, and it is not optional.** These tools live in the tabs of people who
keep ten open; an app with no icon is an anonymous tab they lose. Two lines in the `<head>`:

```html
<link rel="icon" type="image/png" sizes="256x256" href="favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
```

Where the image comes from, in order:

1. **A variant of the project's mark**, kept in `source/brand/assets/favicons/` so the next app
   reuses it instead of remaking it. Two are usually enough: the public one (the mark on
   transparent, matching the site) and an **inverted internal one** (the mark in white on the brand
   colour) for anything private — a dashboard, a deck, an internal tool. The inversion is the point:
   it tells an internal tab from a public one at a glance.
2. **No mark yet?** Render the project's initials in the brand colour with the brand typeface,
   256×256 and 180×180, and say you did — a plain lettermark reads better than a blank page icon,
   and it is replaced the day a logo exists.

Never leave the browser's default. And check the tab, not the file: a favicon at the wrong path
fails silently.

## Data and logic

- **Client-side by default.** Computation in the browser, data as a co-located JSON/CSV (or drawn
  from `source/content/collections/` when it's the same data the site uses — one source, two
  views).
- **No secrets, ever.** An API key in a static app is public. Anything needing a real backend,
  accounts, payments, or a database is a "needs a human decision" item, same ladder as the site's
  forms: propose the simplest option (a mailto, a Stripe link, a hosted form) and let the owner
  decide.
- The model that has served well: heavy simulation in a spreadsheet or data file in `source/`,
  the app as an interactive **view** of it — change the assumptions at the source, the app
  follows.
- **A tool that touches personal data stays client-side, and that is a rule rather than a
  default.** If the owner keeps names, emails or payment status out of the repo deliberately, then a
  tool that needs that list takes it as a **file the person drops into the page**, computes in the
  tab, and stores nothing — no database, no upload. Say so on screen, where they can see it.
  Expect this to be tested: the same owner who wrote the no-personal-data rule will later ask for
  "just a little table of who has paid", because the rule and the need are both real. Build the
  client-side version, and if they genuinely want to change the policy, make it an explicit dated
  entry in `source/decisions.md` rather than a quiet technical choice.
- **If a tool sits behind an access proxy, check that the proxy actually covers the pages.** Auth in
  front of a static site often protects the parts you wrote code for and serves the HTML
  untouched, and a second URL for the same app (a preview or platform subdomain) is usually not
  covered by the rule you configured for your domain. Test it the only way that counts: request the
  app with no credentials, from a browser you are not logged into, and see what comes back.

## State without a database: the repo is the store

Shape 2 apps persist things, and the first instinct is a database. Usually the repo is enough, and
better: the facts stay in markdown that a person and an agent can both edit, and every change
becomes a commit, so history, attribution and undo are free.

```
Browser  ─ static shell + one hydrated island
   │        GET  /api/todos              read
   │        POST /api/todos/k3f9/toggle  write
   ▼
Worker  ─ behind Access, holds a GitHub token as a Worker secret
   │        GET  /repos/:o/:r/contents/:path   → markdown + blob sha
   │        PUT  /repos/:o/:r/contents/:path   → commit (sha required)
   ▼
GitHub  ─ the store
```

The token stays server-side, which is what keeps the "no API key in a static app" rule intact.
Access supplies identity and the Worker fails closed without it — identity meaning the *verified*
Access JWT, never the bare email header and never `ctx.access` (which a Worker with assets does
not receive); `apps/todos/worker.js` is the reference, and *Access and identity* below explains
why each of those distinctions is load-bearing.

Four things decide whether this is pleasant or awful:

1. **Never regenerate the file; patch one line.** Parse-to-objects then re-serialize reformats
   everything and fights every hand edit. Locate the line by its `^id` and rewrite only what
   changed. See `source/formats/todo.md` and `lib/todo.mjs`.
2. **Send the blob sha, and treat the 409 as a feature.** It is compare-and-swap: a stale sha is
   refused. Re-read, re-find by id, re-apply the same intent, retry once. This works because the
   anchor is an id, not a position.
3. **Debounce.** A commit per checkbox is 300-800 ms of latency and an unreadable history. Apply
   optimistically, commit after a few seconds of idle, one commit per batch. On drag and drop,
   commit on drop and never during the drag.
4. **Do not bake the data at build time.** A commit changes nothing on screen until the next build.
   The shell is static, the list is fetched from the Worker on mount.

**Where it stops.** This is a few writes a minute by a few people. Past that — many concurrent
editors, live collaboration, queries or aggregation over thousands of rows — it stops being clever
and the escalation below applies.

## Access and identity: the trap that does not show up in dev

Found on a live project, and worth its own section because every part of it is silent: the door
looks locked while standing open, and no local test says otherwise.

**A Worker with Static Assets never sees `ctx.access`.** Cloudflare runs such a Worker behind an
internal router, and the router does not pass `ctx.access` through to your code — the
[Workers docs](https://developers.cloudflare.com/workers/configuration/cloudflare-access/#ctxaccess-limitations)
state it explicitly. Access still gates the application and its assets, but code that decides from
`ctx.access` sees `undefined` on every request. For an app that merely displays, nothing happens.
For a Worker that refuses to serve until it can prove who is asking, the result is a 403 on
everything — or worse, an identity check that no longer runs while the code still reads as if it
does. Two shapes survive this, and only two:

- **Assets binding + the verified token.** Identity comes from the `Cf-Access-Jwt-Assertion` JWT,
  verified against the team's public keys and the application's AUD — `lib/access.mjs` does it,
  `apps/todos/worker.js` uses it, and the two values it needs (`TEAM_DOMAIN`, `POLICY_AUD`) are
  vars documented in that app's `wrangler.jsonc`. **Never the bare
  `Cf-Access-Authenticated-User-Email` header**: it is a plain string, a Worker cannot tell the
  copy Access set from one a client typed, and Cloudflare's own docs say validating the header
  alone is not sufficient. This shape keeps the normal framework path.
- **No assets binding, and `ctx.access`.** The runtime supplies it and a caller cannot forge it —
  the strongest form, for a Worker that serves its files from its own script and would rather
  depend on a mechanism that cannot be imitated than on a verification that must be done right.

**The assets block can appear without anyone writing it.** The Cloudflare Vite plugin adds `assets`
to the *generated* deploy configuration when the input `wrangler.jsonc` omits it, and frameworks
built on that plugin (the docs name TanStack Start) are affected even when no file in the repo
declares an asset. Nobody reviews a config block that exists in no file.

**Local dev proves nothing here.** `wrangler dev` with an `access.dev` block simulates `ctx.access`
whether or not the deployed Worker will actually receive it; the local server does not reproduce
the internal router. A green local check, a deploy, and the gate is open without a single test
having said so. The only verification that counts is the one the proxy bullet above already
demands, in production: **request the deployed app from a browser that is not signed in. A login
redirect or a 403 is the right answer; a 200 is an incident.** Run it at first deploy and again
after any change to adapters, build tooling, or wrangler config.

## When an app needs a real backend (state, accounts, a database)

Static-first covers most of what this kit is for. When an app genuinely needs a server, a shared
database, real auth or file uploads, escalate deliberately — cheapest and most *sovereign* first,
because the whole point of this kit is that **you own your source of truth and stay lock-in-free**:

1. **Can it stay client-side?** Often yes: a data file + browser computation, a `mailto:` or a
   Stripe Payment Link instead of a form backend, a read-only dashboard over a committed CSV. Prefer
   this — it keeps the app in the repo, free on Cloudflare Workers, owned end to end.
2. **A sovereign backend the owner controls.** If it truly needs state: a Cloudflare Worker + D1/KV
   (same account that already hosts the site), or a self-hostable open-source backend (Supabase,
   PocketBase). The data and code stay the owner's, exportable, no vendor runtime. This is the right
   escalation for anything meant to last.
3. **An agent-native app builder (fast, but lock-in) — a pointer, not a default.** Tools like
   [Lakebed](https://docs.lakebed.dev) let an agent spin up a small full-stack TypeScript app
   ("capsule": typed DB, auth, storage) and deploy it in one flow. Philosophically aligned (agent
   builds it) and great for a quick stateful prototype, **but** it runs on the vendor's proprietary
   runtime + database on a vendor subdomain — the opposite of "own your repo, no lock-in." So point a
   technical owner to it only when speed beats ownership and they accept the tradeoff; never make it
   the default, and never move the source of truth into it.

Whatever the choice, the source of truth stays in this repo; a backend is a dependency the app
talks to, not the place your facts, voice, or content live.

## Publishing

**Who it is for decides where it goes**, not what it does. Three paths:

- **Under the site** — for an app that belongs to the same domain: build/copy it into
  `site/public/apps/<slug>/` so it ships with the site at `yourdomain.com/apps/<slug>/`. Zero
  extra hosting setup, and it deploys with the site's Worker.
- **Its own Cloudflare Worker** — for an app that wants its own URL or its own domain:
  a second Worker **on the same repo**, connected through Workers Builds with its own deploy
  command and its own `wrangler.jsonc` (its `assets.directory` pointing at the app's build output,
  e.g. `apps/<slug>/dist`). Same gotchas as the site: the branch must exist before you connect,
  and the config's `name` must be unique — `docs/deploy-cloudflare.md` and `docs/troubleshooting.md`
  apply.
- **Its own Access-gated Worker** — for anything **private**: a personal dashboard, a financial
  model, a tool showing client or unreleased material. Never a public project "with a URL nobody
  knows": a URL is not a lock, and it ends up in a history, a screenshot, a chat message. The kit
  ships this path for the private dashboard (`source/formats/dashboard.md`,
  `apps/dashboard/wrangler.jsonc`, `npm run deploy:dashboard`); any other private app follows the
  same shape, with the Access policy as its access list. The steps, and the two limitations worth
  knowing before you design on it, are in `docs/deploy-cloudflare.md` ▸ *Publishing something
  private*.

## Quality bar

Same as the site: check it at ~390px and desktop, click everything, console clean, real alt text.
Plus, for a tool: try wrong and empty inputs — a calculator that NaNs on a blank field isn't done.
If the app shows data, its charts and tables follow the charts section of `design.md`. An app the
owner doesn't want published follows the matching section of `website.md`.

Record every app in `source/brief.md` under derivatives (what it is, where it lives, its URL).
