# Web app playbook

The kit builds apps, not just pages: a calculator, a booking or intake form, an interactive
simulator, a small internal tool, a dashboard over a data file. Same brand, same rules, same
publish loop as the site — read `source/brand/voice.md`, `design.md` and `tokens.css` first, like
for any output.

## Page or app?

Before creating an app, check the ladder:

- **It mostly displays content** (even interactive touches: a gallery filter, an accordion) → it's
  a **page or collection** on the site, per `source/formats/website.md`. Don't create an app.
- **It's a tool someone uses** (inputs → computation or flow → result: a simulator, a configurator,
  a multi-step form, a game) → it's an **app**, per this playbook.
- **It belongs to a different project or brand** → it's a **new repo**, not an app here (the
  `new-project` skill makes that call).

## Shape

One app = one self-contained folder at `apps/<slug>/` (see `apps/README.md`). Defaults, in order
of preference:

1. **A single static folder** — `index.html` + inline or co-located CSS/JS, no build step, no
   framework. Right for most tools; a single file someone could download and open still works.
2. **A small Astro app** (its own `package.json` inside `apps/<slug>/`) only when the app
   genuinely needs components, routing, or a build — don't reach for this by default.

Either way: colors, fonts, and spacing come from `source/brand/tokens.css` (copy the current
values into a token block at the top of the app's CSS, like the deck template does, so the app
stays self-contained); the voice guide applies to every label and message.

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

Two options, simplest first:

- **Under the site** — for an app that belongs to the same domain: build/copy it into
  `site/public/apps/<slug>/` so it ships with the site at `yourdomain.com/apps/<slug>/`. Zero
  extra hosting setup, and it deploys with the site's Worker.
- **Its own Cloudflare Worker** — for an app that wants its own URL or its own domain:
  a second Worker **on the same repo**, connected through Workers Builds with its own deploy
  command and its own `wrangler.jsonc` (its `assets.directory` pointing at the app's build output,
  e.g. `apps/<slug>/dist`). Same gotchas as the site: the branch must exist before you connect,
  and the config's `name` must be unique — `docs/deploy-cloudflare.md` and `docs/troubleshooting.md`
  apply.

## Quality bar

Same as the site: check it at ~390px and desktop, click everything, console clean, real alt text.
Plus, for a tool: try wrong and empty inputs — a calculator that NaNs on a blank field isn't done.

Record every app in `source/brief.md` under derivatives (what it is, where it lives, its URL).
