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

## Day-to-day

There is no day-to-day. Pushing is publishing. If the live site ever looks stale, check **Workers & Pages → your project → Deployments** for a failed build; the log says why. A previous deployment can be restored from that same screen with **Rollback**, and the AI can also revert the offending commit.

## Why Cloudflare (and how to swap it)

Cloudflare Pages is the default here for three reasons: it's free with generous, unlimited bandwidth on static sites; one owner-controlled account holds the domain, DNS, and — if an app later needs a backend — Workers + D1/KV (the sovereign-backend tier in `source/formats/webapp.md`); and it builds straight from the repo on every push, no config to babysit.

None of that is lock-in. The host only builds a static site from your repo, so the repo stays the source of truth and the host is a swappable build-and-CDN layer. **Vercel, Netlify, or GitHub Pages would all work the same way** — you repoint DNS and set one build command (`npm run build`, output `dist`, root `site`), and the content doesn't move. Pick Cloudflare unless you already live somewhere else; the choice costs you nothing later.
