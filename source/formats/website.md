# Website playbook

How the site is built and changed. Read together with `source/brand/design.md` and `voice.md`.

## Shape

The site is a minimal [Astro](https://astro.build) app in `site/`, fully static, hand-written CSS, no UI framework. Run it with `npm run dev` inside `site/`; build with `npm run build`. Cloudflare Workers builds and publishes it on every push to `main` (the repo-root `wrangler.jsonc` serves the built `site/dist` as static assets; see `docs/deploy-cloudflare.md`).

- `site/src/layouts/Base.astro` holds the shared shell: head, nav, footer. Page-specific styling stays in each page's `<style>` block; shared styling lives in `site/src/styles/site.css`; all values come from tokens.
- One `.astro` file per page in `site/src/pages/`. Keep pages self-explanatory; a stranger (or a fresh AI session) should understand a page by reading it top to bottom.

## Pages

- Before adding a page, check whether the content belongs on an existing one. Fewer, stronger pages beat a sprawling menu.
- Every page defines a real `<title>` and meta description, drawn from the page's actual content and the voice guide.
- Navigation lives in `Base.astro` only. Adding a page means updating nav in exactly one place.
- **Email addresses are obfuscated**, not hand-written as a `mailto:` in the HTML, or they get
  scraped. Build it once as a small shared snippet: the parts sit in the markup as data, JS assembles
  the address on load, and it renders as selectable text so it works even without a mail client. Reuse
  that snippet everywhere an address appears (a page, a deck, an app).

## Collections

For repeated content that changes often (gallery pieces, products, projects, events), keep the data out of the layout:

- One data file per collection in `source/content/collections/`, JSON, one object per item with explicit fields (`title`, `year`, `price`, `status`, `image`, ...).
- The page imports the file and renders items in a loop. Routine updates (add a piece, change a price, mark sold) then touch only the data file, which makes them fast, safe, and reviewable.
- When a collection gains a field, update the data file and the rendering together, and note the field's meaning in a comment at the top of the data file.

## Images

- Originals stay in `source/brand/assets/`. Web copies go in `site/src/assets/` and pages use Astro's `<Image>` component so builds emit optimized formats. SVGs go in `site/public/`.
- Process before adding: strip EXIF (photos can carry GPS data), orient correctly, resize to at most ~2000px on the long edge.
- Real alt text on every meaningful image, empty alt on decorative ones.

## Being found

Search engines and AI answer engines want the same things, so this is one job. The basics, worth
getting right once:

- Static HTML (crawlers don't run JavaScript), a sitemap, `robots.txt` not blocking anything by
  accident, one canonical host (apex or `www`, not one declaring the other while it redirects).
- Unique title and meta description per page, one `<h1>`, descriptive URLs, internal links between
  related pages. `schema.org` `Organization` once site-wide, with `sameAs` links to the owner's real
  profiles, plus `Article` on posts if the site has any.
- Answer the page's question in the first sentence or two, then develop. Both search results and AI
  answers get quoted from the top of a page.
- Put a date on anything datable and refresh the pages that matter. Stale pages quietly lose ground.

Anything beyond that (keyword research, `hreflang` for a multilingual site, link building, an
`llms.txt` file — which Google says it ignores) is a deliberate project to propose, not a default.

## A page the owner doesn't want published

A private draft, a page for one client, a board only they should see. Build it like any other page,
then keep it out of the deploy: put it in `site/src/pages/internal/<slug>/`, which is gitignored, so
it never gets committed and Cloudflare never sees it. Share it as a local preview or a PDF they print
from the browser. `noindex` and an unlisted URL are obscurity, not access control: anything genuinely
confidential stays local-only per the sensitive-content rule in `CLAUDE.md`.

## Quality bar before publishing

- Check the change at ~390px and desktop width; large screens too if the design has wide layouts.
- Click what you built: links, forms, hovers. Every link resolves, and none goes through a redirect
  wrapper (see the voice guide).
- No console errors, no broken image requests.
- Read the words once more against the voice guide, and check any figure or name against
  `source/content/` and `source/facts/`. Nothing invented ever ships.
- If copy changed in a non-default language, do the native-reader pass from the voice guide.

## Things that need a human decision

Forms, analytics, e-commerce, and anything requiring an account or a key: propose the simplest option and let the owner decide. Defaults that have served well: no analytics until asked, an email link before a form, payment links (Stripe) before a cart.
