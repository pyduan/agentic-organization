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

## When an app needs a real backend (state, accounts, a database)

Static-first covers most of what this kit is for. When an app genuinely needs a server, a shared
database, real auth or file uploads, escalate deliberately — cheapest and most *sovereign* first,
because the whole point of this kit is that **you own your source of truth and stay lock-in-free**:

1. **Can it stay client-side?** Often yes: a data file + browser computation, a `mailto:` or a
   Stripe Payment Link instead of a form backend, a read-only dashboard over a committed CSV. Prefer
   this — it keeps the app in the repo, free on Cloudflare Pages, owned end to end.
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

**Ask who the app is for before you ask where it goes.** A public app and a private one are two
different publishing paths, and the mistake is putting a private one on a public URL because that
was the shorter route. Nothing about an app's *code* tells you which it is; only what it shows and
who it is for.

| The app is | It goes | Because |
|---|---|---|
| for visitors, part of the site | `site/public/apps/<slug>/` — ships with the site at `yourdomain.com/apps/<slug>/` | zero extra hosting setup |
| for visitors, wants its own URL or domain | its **own Cloudflare Pages project on this same repo**, **Root directory: `apps/<slug>`**, production branch `main` | same gotchas as the site: the branch must exist, the root directory is the easy-to-miss field (`docs/deploy-cloudflare.md`, `docs/troubleshooting.md`) |
| for the owner alone, or for named people — anything showing personal, financial, client, or unreleased material | the organization's **protected Worker**, the repo marked `toolbox` in [`ORGANIGRAM.md`](../../ORGANIGRAM.md) | it is behind Cloudflare Access, so a URL leaking is not a disclosure |

### Private apps: the protected Worker, never a public URL

A private app does **not** get its own Pages project. "Private" and "public host with an
unguessable URL" are not the same thing, and the second one is not a security model: the URL ends
up in a browser history, a screenshot, a chat message, a search index. Publish it where the gate is.

The protected Worker is a repo of `kind: "toolbox"` in the workspace registry
([`docs/registry.md`](../../docs/registry.md)): one Cloudflare Worker, Access attached **at the
Worker level** so every route, the `workers.dev` hostname, preview URLs, and any custom domain
added later are covered without maintaining a list. Apps from other repos are **mounted** on it —
they stay in their own repo, under `apps/<slug>/`, which remains their source of truth; the toolbox
bundles them at deploy time and serves them behind the gate.

What that asks of the app, and it is not much:

- **Static files only** — `index.html` plus co-located CSS/JS, exactly the default shape at the top
  of this playbook. No build step to run on the host.
- **Same-origin requests only.** The app is served from the toolbox's origin, so a `fetch` to
  `/api/...` reaches the toolbox Worker, already authenticated. There is no key to embed and no
  CORS to configure.
- **Declare it**: the repo's `.agentic/manifest.json` says `"publish": { "apps": "private-worker" }`.
  That line is what makes the toolbox pick the app up, and what tells the next session where this
  repo's apps go without having to ask.

Two things the gate does not change. **It is not an excuse to relax the data rules above** — a tool
touching personal data still computes client-side unless a dated entry in `source/decisions.md` says
otherwise. And **the Access policy is the whole boundary**: everyone it admits sees every app
mounted on it, so adding a person is a policy decision about all of them at once, not a per-app
detail.

### Whichever path

Verify it the only way that counts, per the access-proxy rule above: request the app with no
credentials, from a browser you are not signed into, and see what comes back. A private app that
answers `200` to a stranger is an incident, not a bug.

Record every app in `source/brief.md` under derivatives (what it is, where it lives, its URL, and
whether it is public or behind the gate).

## Quality bar

Same as the site: check it at ~390px and desktop, click everything, console clean, real alt text.
Plus, for a tool: try wrong and empty inputs — a calculator that NaNs on a blank field isn't done.
If the app shows data, its charts and tables follow the charts section of `design.md`. An app the
owner doesn't want published follows the matching section of `website.md`.
