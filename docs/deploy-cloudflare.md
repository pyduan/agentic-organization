# Publishing with Cloudflare Pages

One-time hosting setup, about 15 minutes, free. After this, every push to `main` rebuilds the live site automatically; nobody ever "deploys" by hand. The AI can walk you through these steps while you click.

## 0. Push first

Connect Cloudflare only **after** the first version of the site has been committed and pushed to
GitHub (Claude does this as part of building v1). Cloudflare's **Production branch** dropdown
only lists branches that already exist on GitHub — a repo with nothing pushed yet shows an empty
dropdown that won't take free text, which stops everyone who connects hosting before building.
The production branch is always **`main`**.

## 1. Connect the repo

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com) (it should belong to the owner, like the GitHub account).
2. In the dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Authorize Cloudflare on GitHub and pick your repo.
4. Build settings:
   - Production branch: **`main`**
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - **Root directory: `site`** (easy to miss; the website lives in the `site/` subfolder)
5. Save and deploy. First build takes a couple of minutes and gives you a URL like `https://<project>.pages.dev`. That URL is live from now on; put it in `source/brief.md`.

If the build fails, open the build log. The usual fix for version complaints is adding an environment variable `NODE_VERSION` set to a current LTS (for example `22`) in the Pages project settings.

## 2. Connect your domain

In the Pages project: **Custom domains → Set up a custom domain**, enter your domain, and follow what Cloudflare proposes. What happens next depends on where the domain lives:

- **Domain already on Cloudflare**: it adds the DNS record for you. Done.
- **Domain registered elsewhere** (OVH, Gandi, GoDaddy...): the smoothest path is moving DNS to Cloudflare. Add the domain as a site in Cloudflare (free plan), Cloudflare shows two nameservers, and you paste those into the nameserver settings at your registrar. Propagation takes minutes to a day. The domain stays owned at your registrar; only DNS moves. Then repeat the custom-domain step.
- **Can't or won't move DNS**: at your registrar, create a `CNAME` record for `www` pointing to `<project>.pages.dev`, and use `www.yourdomain.com` as the custom domain. Bare domains (no `www`) generally require DNS on Cloudflare, which is another reason the previous option is smoother.

Add both `yourdomain.com` and `www.yourdomain.com` as custom domains so either one works; Cloudflare handles the certificate and the redirect.

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

## Publishing a **private** app: the protected Worker

Everything above puts files on the open internet. Some apps must not go there: a personal
dashboard, a financial simulator, anything showing client or unreleased material. For those, the
answer is not "a Pages project with a URL nobody knows" — a URL is not a lock, and it ends up in a
history, a screenshot, or a chat message soon enough.

Private apps go on the organization's **protected Worker**: the repo marked `toolbox` in
[`../ORGANIGRAM.md`](../ORGANIGRAM.md). One Cloudflare Worker on the same account, with Cloudflare
Access attached **at the Worker level**, which covers every route, the `workers.dev` hostname,
preview URLs, and any custom domain added later — without maintaining a list of URLs to protect.

How it goes, from the app's side:

1. Build the app as a static folder in its own repo, at `apps/<slug>/` (the default shape in
   `source/formats/webapp.md`).
2. Set `"publish": { "apps": "private-worker" }` in that repo's `.agentic/manifest.json`.
3. The toolbox picks it up at deploy time and serves it behind the gate. The app never gets its own
   hosting project, its own DNS record, or its own URL to protect.

Two properties worth understanding, because they decide what you can and cannot do there:

- **The Access policy is the whole boundary.** Everyone it admits sees every app mounted on the
  Worker. Adding a person is a decision about all of them at once.
- **Access at the Worker level rules out two things**: a Static Assets binding (its internal router
  does not forward the identity to your code, which breaks a fail-closed check) and WebSockets
  (Worker-level policies reject the upgrade). Anything realtime needs a hostname-based Access
  application instead — a different setup.

And the same verification as everywhere else on this page, which is the only one that counts:
request the app from a browser you are **not** signed into. A login redirect or a `403` is right;
a `200` is an incident.

## Day-to-day

There is no day-to-day. Pushing is publishing. If the live site ever looks stale, check **Workers & Pages → your project → Deployments** for a failed build; the log says why. A previous deployment can be restored from that same screen with **Rollback**, and the AI can also revert the offending commit.

## Why Cloudflare (and how to swap it)

Cloudflare is moving its investment to **Workers**, and static sites run there too. Pages still
works, is simpler to set up from the dashboard, and is what the steps above describe, so start
there. If you ever want to move, it is one config file and the same build command, and Workers
Builds gives back the push-to-deploy and preview URLs that Pages provides. Not urgent.

Cloudflare Pages is the default here for three reasons: it's free with generous, unlimited bandwidth on static sites; one owner-controlled account holds the domain, DNS, and — if an app later needs a backend — Workers + D1/KV (the sovereign-backend tier in `source/formats/webapp.md`); and it builds straight from the repo on every push, no config to babysit.

None of that is lock-in. The host only builds a static site from your repo, so the repo stays the source of truth and the host is a swappable build-and-CDN layer. **Vercel, Netlify, or GitHub Pages would all work the same way** — you repoint DNS and set one build command (`npm run build`, output `dist`, root `site`), and the content doesn't move. Pick Cloudflare unless you already live somewhere else; the choice costs you nothing later.
