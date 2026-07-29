# Website playbook

How the site is built and changed. Read together with `source/brand/design.md` and `voice.md`.

## Shape

The site is a minimal [Astro](https://astro.build) app in `site/`, fully static, hand-written CSS, no UI framework. Run it with `npm run dev` inside `site/`; build with `npm run build`. Cloudflare Pages builds and publishes it on every push to `main`.

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

## Contact details

- **Email addresses are obfuscated and shown as text**, never a hand-written `mailto:` in the HTML
  (the voice guide carries the rule). Build it once as a small shared component or snippet: the parts
  live in the markup as data, JS assembles the address on load, and it renders as selectable text so
  it still works for someone without a mail client.
- Phone numbers and postal addresses follow the same "shown as text" habit; only publish the ones the
  owner wants public.

## Being found and cited (SEO and GEO)

Two audiences read the site: search engines, and AI answer engines that quote pages back to users.
They are one job, not two disciplines: about nine in ten AI-answer citations come from pages already
ranking, so classic SEO is the foundation and citability is the layer on top.

The foundation, checked whenever a page is added or reworked:

- Static or server-rendered HTML (crawlers do not run JavaScript), `robots.txt` allowing the search
  and AI crawlers, a complete sitemap, no accidental `noindex`.
- One canonical host (apex or `www`, not one declaring the other while it redirects), and canonicals
  pointing at URLs that actually return 200.
- If the site is multilingual: `hreflang` complete and reciprocal, every declared locale resolving to
  200, one `x-default`, real content parity between locales.
- Unique title and meta description per page, exactly one `<h1>`, a clean heading hierarchy,
  descriptive URLs, internal links between related pages.
- `schema.org` structured data: `Organization` site-wide, `Article` on posts, `BreadcrumbList` on
  sections, and `sameAs` links to the owner's real profiles.

The citability layer, which is mostly a writing habit:

- Answer the page's question in the **first 40 to 60 words**, then develop. Most citations come from
  the top of a page.
- Self-contained passages (roughly 130 to 170 words) that stand alone when quoted, question-shaped
  headings, comparison tables, a short FAQ block where it fits.
- A named author, a publication date and an updated date. **Recency is a real lever**: content under
  three months old is far likelier to be cited, and pages untouched for six months lose ground. Plan
  refreshes of the pages that matter rather than one big push.
- Cite primary sources by name and link them (see `source/facts/`), and mix in images, charts, or a
  demo: multi-modal pages get picked up more often than walls of text.
- Off-site mentions (a Wikipedia or Wikidata entry, LinkedIn, YouTube, an interview) correlate more
  strongly with being cited than backlinks do. Worth proposing to the owner, not something the repo
  can fix alone.
- `llms.txt` is not a Google signal (Google states it ignores it). Add it if the owner wants it for
  other services, never as the answer.

## Pages that must never be published

An internal board, a team dashboard, a recap only the organization should see: build it on the same
stack as the rest of the site (same tokens, same components, same type) so it holds the same quality
bar, then keep it out of the published output deliberately:

- Put it in `site/src/pages/internal/<slug>/` and add that folder to `.gitignore`. Since Cloudflare
  builds from the repo, a page that is never committed is never deployed: the page exists on the
  owner's machine only. Add a `noindex` robots meta tag as a second belt, and keep an obvious in-page
  marker ("internal document, do not circulate") so a screenshot can't be mistaken for a public page.
- Deliver it as a local preview link, or as a PDF the owner exports from the browser. Never hand back
  a chat-hosted artifact as the deliverable: it can't be exported cleanly and lives nowhere the
  organization controls.
- An internal page is a **continuous scrolling page**, not a deck. Reach for `deck.md` only when it
  really is a presentation.
- `noindex` is obscurity, not access control. Anything genuinely confidential stays local-only per
  the sensitive-content rule in `CLAUDE.md`; publishing it later means a properly gated host.

## Quality bar before publishing

- Check the change at ~390px and desktop width; large screens too if the design has wide layouts.
- Click what you built: links, forms, hovers.
- No console errors, no broken image requests.
- Every link resolves (a 200, not a redirect chain or a 404), and no link goes through a redirect
  wrapper.
- If copy changed in a non-default language, do the native-reader pass from the voice guide.
- For anything an audience will read, run the `review` skill first (facts, attribution, voice, links).

## Things that need a human decision

Forms, analytics, e-commerce, and anything requiring an account or a key: propose the simplest option and let the owner decide. Defaults that have served well: no analytics until asked, an obfuscated email link before a form, payment links (Stripe) before a cart.
