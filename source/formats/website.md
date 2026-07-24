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

## Collections

For repeated content that changes often (gallery pieces, products, projects, events), keep the data out of the layout:

- One data file per collection in `source/content/collections/`, JSON, one object per item with explicit fields (`title`, `year`, `price`, `status`, `image`, ...).
- The page imports the file and renders items in a loop. Routine updates (add a piece, change a price, mark sold) then touch only the data file, which makes them fast, safe, and reviewable.
- When a collection gains a field, update the data file and the rendering together, and note the field's meaning in a comment at the top of the data file.

## Images

- Originals stay in `source/brand/assets/`. Web copies go in `site/src/assets/` and pages use Astro's `<Image>` component so builds emit optimized formats. SVGs go in `site/public/`.
- Process before adding: strip EXIF (photos can carry GPS data), orient correctly, resize to at most ~2000px on the long edge.
- Real alt text on every meaningful image, empty alt on decorative ones.

## Quality bar before publishing

- Check the change at ~390px and desktop width; large screens too if the design has wide layouts.
- Click what you built: links, forms, hovers.
- No console errors, no broken image requests.
- If copy changed in a non-default language, do the native-reader pass from the voice guide.

## Things that need a human decision

Forms, analytics, e-commerce, and anything requiring an account or a key: propose the simplest option and let the owner decide. Defaults that have served well: no analytics until asked, a `mailto:` link before a form, payment links (Stripe) before a cart.
