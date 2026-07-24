---
name: setup
description: "First-time project setup: interview the owner, ingest their content (dropped files, a scrape of their existing site, or a clone of an existing repo mined for content), personalize the brand guides, build v1 of the site, and help put it live. Use when source/brief.md still contains TODO placeholders, or when the owner asks to set up or start their site."
---

# Setup

The founding session. Unlike normal sessions, here you ask questions liberally: everything you learn now becomes guides that every future session runs on. Budget the conversation; batch questions in small, natural groups rather than one long form.

## 1. Interview

Establish, in the owner's own words:

- Who they are and what this site is for (the elevator pitch, the audience, what a visitor should do).
- **How you'll handle their code — ask this early, in plain terms.** It sets how every future session publishes. Two modes:
  - **Simplified (the default; right for most, especially non-technical owners):** you have full code-management rights — you commit, push, publish, and merge on your own, pausing only for destructive or irreversible actions. They never touch git or a command line; you never hand them one.
  - **Review mode (for owners comfortable with git who want to stay in the loop):** you still do all the git yourself, but you pause for a yes before each push or merge.
  Ask it simply — *"Once a change looks good, should I just publish it, or check with you first each time?"* — with AskUserQuestion offering those two options. Record the choice in `brief.md` (Governance → "How the AI publishes"); if they pick review mode, also flip the publish rule in `CLAUDE.md`. Most owners want simplified. Either way you run all the git; the mode only decides whether you pause for a yes before publishing.
- What pages they imagine (offer a starting set: home, about, work/gallery, contact; fewer is fine).
- Languages, and which is the default.
- The starting point, one of:
  - **an existing live site to replace** (get the URL),
  - **an existing repo to mine** (get access: a public URL, or add as a collaborator if private),
  - **a pile of source documents** (have them drop everything into `source/inbox/`),
  - **nothing yet** (interview a bit deeper and draft for them).
- Taste: sites or brands they admire, colors and fonts they love or hate, photos of their work if relevant. Concrete references beat adjectives.
- Domain: do they own one, where is it registered. (Setup works fine before the domain exists; the site lives on a `.workers.dev` URL meanwhile.)
- Any recurring content: gallery, products, events. These become collections.
- **Governance and repos, in plain terms**: two short questions, both answered into `ORGANIGRAM.md`
  (the governance + repo-map file every future session reads). First, *who else, if anyone, will
  work on this, and who has the last word before something goes live?* Just the owner is the default,
  and the three rights (use, change, approve) collapse into "you, on `main`". Owner plus a helper or
  a team means each person gets a right sized to their role, with a review gate in front of
  publishing. Second, *does the organization already span more than this one repo?* A separate
  client or project repo, or a private repo for sensitive material that only some people can open.
  Don't invent structure they don't have: solo with one repo is the honest default and stays trivial.
  Fill the repo table and the three-rights section of `ORGANIGRAM.md` with their answers, grant
  GitHub access to match (repo Settings → Collaborators: read / write; publishing stays with the
  owner unless delegated), and revisit when someone new joins or a second repo appears.
- **The optional modules, one plain question each.** The kit can also run more of the
  organization than its website: *do you want to track your actual work here* (clients, grants,
  launches: the `projects` skill, a folder per project with its charter, decisions and files)?
  And *do you manage people and want help with 1:1s and priorities* (the `team` skill; its data
  stays in a gitignored, local-only folder and never leaves the machine — say that sentence, it's
  the reason to trust it)? Yes activates the module now (create its folder per the skill); no
  costs nothing, and saying "start tracking project X" or "sync my team" later activates it then.
  If either is on, offer to fill `source/objectives.md` (the north star both modules prioritize
  against) from what the interview already established; it stays the owner's alone to change.

## 2. Ingest

**Existing site** (a live URL): fetch every reachable page. Save each page's copy as markdown in `source/content/` (one file per page, marked with provenance and date). Download the images worth keeping into `source/brand/assets/`. Record observed design cues (palette, type feel, layout habits) as a starting proposal for the design guide; the owner may want continuity or a clean break, so ask which.

**Existing repo** (their old site's actual source, not just its rendered pages): clone it to a scratch location *outside* this repo (e.g. `/tmp/old-site`, never inside `source/` or committed here) so its history, code, and dependencies never mix with this kit's own. Then read it like a source dump, not a scaffold: pull real content into `source/content/` (a repo's raw files are often richer than a live scrape: drafts, unpublished pieces, structured data the site never displayed), sourced third-party figures into `source/facts/`, original images and assets into `source/brand/assets/`, and design cues into a starting `design.md` proposal, exactly as with a live-site scrape. **Rebase, not clone**: the destination is always this kit's own `source/`/`site/` structure; nothing from the old repo's framework, components, or file layout gets carried over. Delete the scratch clone once ingestion is done.

**Inbox**: process per `source/inbox/README.md`. Read everything before filing anything, since documents explain each other.

Facts you couldn't verify (scraped, mined from a repo, or inferred) get a `<!-- verify -->` marker in the content files.

## 3. Gap check: clarify what you already have

Between ingesting and writing any guide, take stock. For each of the four targets below, note what the material already answers (and where that came from) and what is missing or uncertain, then close the gaps with the owner in one or two batched rounds of questions. Ground every question in something specific you found; "your old site says the studio opened in 2019, is that still right?" gets a better answer than "tell me about your history". And prefer proposing over interrogating: show the three colors you extracted and ask keep or change, draft the bio from their documents and ask what's wrong with it.

- **Facts and content** (`source/content/`): bio, dates, prices, claims, contact details. Everything scraped or inferred gets confirmed now or keeps its `<!-- verify -->` marker.
- **Voice** (`voice.md`): the tone you observed in their material versus the tone they want; words they reach for; words to ban; the exact notation of the project name.
- **Design** (`design.md` + `tokens.css`): the palette, type, and layout cues you extracted; continuity with the old look or a clean break; references they admire.
- **Brief** (`brief.md`): audience, what a visitor should do, current priorities.
- **Facts relevance & the watch** (`source/facts/README.md`'s "What counts as a useful fact here",
  and `source/facts/methodology.md`): ask what outside numbers would actually strengthen this
  project — a sector, a set of competitors, a kind of benchmark — and what's out of scope. Turn the
  answer into the **themes, first sources, and cadence** of `methodology.md` (the brief a recurring
  watch follows). This is what keeps the `research` skill from wandering into generic noise later; a
  couple of concrete examples from the owner beats a vague category. If they want it running on its
  own, offer to schedule a weekly deep-search (e.g. Friday noon) once the themes are written down.

Where the interface offers structured questions (AskUserQuestion), use it with concrete options. Don't move on while a guide would still contain a guess on something the owner could settle in one sentence.

## 4. Personalize the system

Replace every TODO in these files with what you learned, keeping each file's structure:

- `source/brief.md`, complete and current; it's the first thing every future session reads.
- `source/brand/voice.md`: tone words with meanings, banned words, notation of the project name, languages.
- `source/brand/design.md`: the philosophy paragraph, type choices, imagery style.
- `source/brand/tokens.css`: the real palette and fonts. If using webfonts, self-host them per the design guide.
- `source/facts/README.md`'s relevance section, and `source/facts/methodology.md` (the watch's themes, first sources, and cadence): in-scope/out-of-scope topics and trusted sources, from what the owner just told you.
- `ORGANIGRAM.md`: replace the placeholder repo row(s) with the real ones, and write the three rights as they actually stand. Solo with one repo means the template is nearly right already; leave it minimal.

Read each personalized guide back as a whole; it must read as this project's guide, with no template smell left.

## 5. Build v1

Build the site in `site/` per `source/formats/website.md`: layout shell first (nav, footer, typography on tokens), then pages, then collections if any. Replace the placeholder home page. Run `npm install` and `npm run dev` inside `site/`, verify at mobile and desktop widths, then review it with the owner page by page (share the local URL, show screenshots). Iterate until they're happy; this loop is most of the session.

## 6. Go live

Set the deploy config first: open `wrangler.jsonc` at the repo root and set `name` to this
project's slug (it becomes the Worker's name and its `<name>.<subdomain>.workers.dev` URL, and must
be unique in the owner's Cloudflare account). Then walk the owner (or their helper) through
`docs/deploy-cloudflare.md` while they click, one step at a time, confirming each screen before
moving on. **Commit and push everything first**: Cloudflare's branch dropdown only lists branches
that already exist on GitHub, so until the first push there is no `main` to pick (a real stumble —
see `docs/troubleshooting.md`). If they hit any error along the way, check `docs/troubleshooting.md`
before improvising; if their problem isn't in it, add the entry once solved. Once the `.workers.dev`
URL is live, verify it yourself, record the URLs in `brief.md`, and continue to the domain if they
own one.

## 7. Close

Run the reflect skill (it will have plenty to record from this session), push everything, and tell the owner what exists now: the live URL, what each folder is for in one line each, and how to work with you from now on (open the folder, run `claude`, talk, drop files in the inbox).
