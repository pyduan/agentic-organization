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

## Day-to-day

There is no day-to-day. Pushing is publishing. A push to `main` deploys to production; a push to any other branch (or a pull request) gets its own **preview URL** so a change can be checked before it goes live. If the live site ever looks stale, open **Workers & Pages → your Worker → Deployments** for a failed build; the log says why. Any previous version can be restored from that same screen, and the AI can also revert the offending commit.

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
