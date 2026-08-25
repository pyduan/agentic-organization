# Publishing with Cloudflare Workers

One-time hosting setup, about 15 minutes, free. After this, every push to `main` rebuilds the live site automatically; nobody ever "deploys" by hand. The AI can walk you through these steps while you click.

Cloudflare has two ways to host a site: **Workers** (the current default, actively developed) and **Pages** (older, now in maintenance mode). This kit uses **Workers**. If you set up on Pages before this change, your site still works and nothing breaks on its own; see [Already on Cloudflare Pages?](#already-on-cloudflare-pages) below.

The repo already ships the config Workers needs: a `wrangler.jsonc` at the root that points Workers at the built site (`site/dist`) and serves it as static assets, plus a root `package.json` with the `build` and `deploy` commands. You only connect the repo and click deploy.

## 0. Push first

Connect Cloudflare only **after** the first version of the site has been committed and pushed to GitHub (Claude does this as part of building v1). Cloudflare's **branch** dropdown only lists branches that already exist on GitHub, so a repo with nothing pushed yet shows an empty dropdown. The production branch is always **`main`**.

## 1. Connect the repo (Workers Builds)

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com) (it should belong to the owner, like the GitHub account).
2. In the dashboard: **Workers & Pages → Create → Workers → Import a repository** (this is Cloudflare's Git-connected CI/CD, called *Workers Builds*).
3. Authorize Cloudflare on GitHub and pick your repo.
4. Build settings:
   - Git branch: **`main`**
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - Root directory: leave it at the repo root (`/`). The `wrangler.jsonc` there already knows the site is built into `site/dist`; you do **not** set the root to `site` the way Pages did.
5. Set the project name. Open `wrangler.jsonc` and set `name` to your project slug (e.g. `acme-site`); it becomes your Worker's name and its `https://<name>.<your-subdomain>.workers.dev` URL, and must be unique in your account. Claude sets this during setup, so it is usually done already.
6. Save and deploy. The first build takes a couple of minutes and gives you a URL like `https://<name>.<subdomain>.workers.dev`. That URL is live from now on; put it in `source/brief.md`.
7. **Verify the connection exists, don't assume it.** Push a trivial commit and watch a build start on its own in **Workers & Pages → your Worker → Deployments**. If no build appears, the repo is not connected and every later push will look published while nothing goes live. This is the single most expensive thing to get wrong here, because it fails silently — see the box below.

If the build fails, open the build log. The usual fix for version complaints is setting the build's Node version to a current LTS (for example `22`) in the build settings.

## 2. Connect your domain

In the Worker: **Settings → Domains & Routes → Add → Custom domain**, enter your domain, and follow what Cloudflare proposes. Workers custom domains require the domain to be a **Cloudflare zone** (its DNS managed by Cloudflare). What that means depends on where your domain lives:

- **Domain already on Cloudflare**: it adds the record for you. Done.
- **Domain registered elsewhere** (OVH, Gandi, GoDaddy...): move DNS to Cloudflare. Add the domain as a site in Cloudflare (free plan), Cloudflare shows two nameservers, and you paste those into the nameserver settings at your registrar. Propagation takes minutes to a day. The domain stays owned at your registrar; only DNS moves. Then add the custom domain to the Worker.
- **A subdomain only** (e.g. `www.yourdomain.com`): a subdomain can be pointed with a `CNAME` without moving the whole zone, but an apex/bare domain (`yourdomain.com`) needs the zone on Cloudflare. Moving DNS to Cloudflare is the smoothest path either way, and it is what makes the apex work.

Add both `yourdomain.com` and `www.yourdomain.com` so either one works; Cloudflare handles the certificate and the redirect.

## 3. Sanity checks

- Push a small change and watch it appear on the live URL about a minute later.
- `https://` works and `http://` redirects to it (automatic with Cloudflare).
- Record the final URLs in `source/brief.md`.
- **Check that your private files are not public** (see below):
  `curl -s -o /dev/null -w '%{http_code}' https://yourdomain.com/CLAUDE.md` must print `404`.

## A host serves *everything* in the folder you point it at

The **Build output directory** and **Root directory** settings above are not just plumbing, they
decide what the world can read. A host serves every file in the folder it is given, with no notion
of which ones you considered private.

The settings in step 1 are safe on purpose: the host is pointed at the built site, so your
`CLAUDE.md`, your `source/` folder and your notes are never served. **The risk appears the moment
something is hosted straight from a folder you also write notes in** — a plain HTML page with no
build step, or an app published from `apps/<slug>/` per `source/formats/webapp.md`. Then the
folder's own README and working files are on the public internet.

This is not hypothetical. A private repo of ours was hosted from its repo root, which put its
`CLAUDE.md`, its bio notes and its style guide on the open web for weeks. Nothing warned anyone: the
site looked perfect, and the repo was correctly marked private.

Two rules, and the second matters more than the first:

1. **Point the host at a folder that contains only publishable files.** A `public/` or `dist/`
   folder, never the repo root and never a folder you also keep notes in. It is an allowlist by
   construction, which beats remembering to exclude things.
2. **Verify, don't assume.** After any hosting change, request a file that should be secret and
   confirm it 404s. It is one command, it takes a second, and it is the only way you find out.

## Day-to-day

There is no day-to-day **once the repo is connected**. Pushing is publishing: a push to `main` deploys to production; a push to any other branch (or a pull request) gets its own **preview URL** so a change can be checked before it goes live.

> **⚠️ If you deployed by hand with `wrangler deploy` instead of connecting the repo, pushing does NOT publish** — and nothing tells you. This happened on a real project: the live site served a corrected figure's old value for six days, and a newly-pushed app returned 404, while the repo and every summary said the change was live. The docs even claimed "Cloudflare rebuilds on every push", which made it worse.
>
> **How to tell in ten seconds.** In **Deployments**, look at the source of the latest deployment: `wrangler` means by hand, a commit hash means Workers Builds. Or ask the AI to check the API — a Worker with no build trigger has none.
>
> **Until it is connected**, deploy explicitly after every push (`npm run deploy`), and verify **on the live URL**, never on the local build. `freshness.json` supports a `mustContain` claim for exactly this: name a string the live page must carry, and `scripts/check-freshness.mjs` fails when the repo is ahead of what is served. If the live site ever looks stale, open **Workers & Pages → your Worker → Deployments** for a failed build; the log says why. Any previous version can be restored from that same screen, and the AI can also revert the offending commit.

## Publishing something private: the dashboard Worker

Everything above puts files on the open internet. Some things must not go there: the private
dashboard (`source/formats/dashboard.md`), a financial model, a tool showing client material. For
those the answer is **not** "a Pages project with a URL nobody knows". A URL is not a lock. It ends
up in a browser history, a screenshot, a chat message.

It goes on a **second Worker with Cloudflare Access in front of it**. Access attached at the Worker
level covers every route it has, its `workers.dev` hostname, its preview URLs and any custom domain
added later, so there is no list of URLs to remember to protect.

1. **Build and deploy it** (the repo already ships the config):

   ```sh
   npm run deploy:dashboard
   ```

   That runs `scripts/dashboard-data.mjs` into `apps/dashboard/dist/` and deploys
   `apps/dashboard/wrangler.jsonc`. Set its `name` to `<your-slug>-dashboard` the first time.

2. **Turn Access on for the account, once.** Cloudflare Zero Trust has to be enabled and given a
   team domain before any policy can exist; until then the API answers that Access is not enabled,
   and `wrangler` has no Access command at all. This one step is a human clicking in the dashboard:
   **Zero Trust → set your team domain** (free plan is enough for this).

3. **Protect the Worker**: **Workers & Pages → your dashboard Worker → Access → Protect this
   Worker**, then choose who may sign in — specific email addresses, or everyone on your email
   domain. That list *is* the access list; adding a person there is the whole grant, and it applies
   to everything on that Worker at once.

4. **Verify from outside.** The only check that counts: request the URL from a browser you are not
   signed into.

   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' "https://<name>.<subdomain>.workers.dev/?cb=$RANDOM"
   ```

   A `302` to the login page or a `403` is right. A `200` is an incident. **Always add that
   cache-buster**: Cloudflare caches these answers, and a plain `curl` has reported a hole still
   open minutes after it was closed, and vice versa.

Two things worth knowing before you design anything on it:

- **The policy is the boundary — do not write your own identity check.** An assets-only Worker (what
  the dashboard is) never sees the request in code, and that is the point: there is no fail-closed
  check to get wrong. If you ever do add a fetch handler and want the signed-in identity, be aware
  that a Static Assets binding in front of your code can leave it without one, which turns a
  well-meaning `if (!identity) return 403` into a page that refuses everybody.
- **No WebSockets.** Worker-level Access policies reject WebSocket upgrades with a `403`. Anything
  realtime needs a hostname-based Access application instead, which is a different setup.

## Already on Cloudflare Pages?

If you deployed this site on Cloudflare **Pages** before the kit moved to Workers, read this once.

**Pulling the Workers config does not break your Pages site.** The `wrangler.jsonc` and root `package.json` live at the repo *root*, while your Pages project builds from the `site/` subfolder (that was the "Root directory: `site`" setting). Pages never looks at the repo root, so it does not see the new files and keeps building and publishing exactly as before. You lose nothing by pulling the update, and you are under no obligation to migrate: Pages still works.

**When you do want to move to Workers** (recommended over time, since Cloudflare is investing in Workers and only maintaining Pages), migrate in this order so the site never goes dark:

1. Set up the Worker following [section 1](#1-connect-the-repo-workers-builds) above. Connect the same repo through Workers Builds; leave the root directory at `/`. It deploys to a `*.workers.dev` URL alongside your existing Pages site.
2. Verify the `*.workers.dev` URL looks right.
3. Move the custom domain: in the **Pages** project remove the custom domain, then add it to the **Worker** (section 2). A domain can only point to one of them at a time.
4. Turn off the old Pages build so it stops rebuilding: in the Pages project, **Settings → Builds → disconnect Git** (or delete the Pages project once you are happy). Do this last, after the domain is on the Worker.

There is no content to move: both hosts build the same repo. Migration is purely re-pointing where the domain resolves.

## Why Cloudflare (and how to swap it)

Cloudflare is the default here for three reasons: it's free with generous, unlimited bandwidth on static sites; one owner-controlled account holds the domain, DNS, and (if an app later needs a backend) Workers + D1/KV (the sovereign-backend tier in `source/formats/webapp.md`); and it builds straight from the repo on every push, no config to babysit.

None of that is lock-in. The host only builds a static site from your repo, so the repo stays the source of truth and the host is a swappable build-and-CDN layer. **Vercel, Netlify, or GitHub Pages would all work the same way**: you repoint DNS and set one build command (`npm run build`, output `site/dist`), and the content doesn't move. Pick Cloudflare unless you already live somewhere else; the choice costs you nothing later.
