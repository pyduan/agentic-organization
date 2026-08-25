---
name: setup
description: "First-time project setup: interview the owner, ingest their content (dropped files, a scrape of their existing site, or a clone of an existing repo mined for content), personalize the brand guides, build v1 of the site, and help put it live. Use when source/brief.md still contains TODO placeholders, or when the owner asks to set up or start their site."
---

# Setup

The founding session. Unlike normal sessions, here you ask questions liberally: everything you learn now becomes guides that every future session runs on. Budget the conversation; batch questions in small, natural groups rather than one long form.

**The order matters more than the questions.** Interview, then structure and facts, then guides, then
the site. An owner will often want to see something on screen in the first twenty minutes, and giving
in to that is how a project ends up with a pretty site and no source of truth underneath. Say what
you are doing and why: the hour buys them a system, and the site falls out of it in the last third.

## 1. Interview

Establish, in the owner's own words:

- Who they are and what this site is for (the elevator pitch, the audience, what a visitor should do).
- **How you'll handle their code — ask this early, in plain terms.** It sets how every future session publishes. Two modes:
  - **Simplified (the default; right for most, especially non-technical owners):** you have full code-management rights — you commit, push, publish, and merge on your own, pausing only for destructive or irreversible actions. They never touch git or a command line; you never hand them one.
  - **Review mode (for owners comfortable with git who want to stay in the loop):** you still do all the git yourself, but you pause for a yes before each push or merge.
  Ask it simply — *"Once a change looks good, should I just publish it, or check with you first each time?"* — with AskUserQuestion offering those two options. Record the choice in `brief.md` (Governance → "How the AI publishes"); if they pick review mode, also flip the publish rule in `CLAUDE.md`. Most owners want simplified. Either way you run all the git; the mode only decides whether you pause for a yes before publishing.
- **One repo or several?** Default to one, with folders. Only reach for a second when someone
  should see one and not the other, or when one of them serves a public surface and the other holds
  private material. `docs/one-repo-or-several.md` has the three questions and, if a split is real,
  the rules that keep a constellation from drifting. Do not split because the work has several
  subjects — that is what folders are.
- **Record the template baseline.** Add the `template` remote and write the commit this project
  starts from into `.kit-sync`, then commit it:
  `git remote add template https://github.com/pyduan/agentic-organization.git && git fetch template && git rev-parse template/main > .kit-sync`
  It is one line, and it is what lets every future upgrade tell "the kit changed this file" from
  "the owner changed this file". Without it, the first `update-kit` cannot apply anything safely.
- **Seed `source/decisions.md` from the interview, and say that you will keep it.** The choices made
  in this conversation — the positioning, the audience, what was deliberately left out, anything the
  owner ruled out and why — are decisions, and they are the ones most likely to be re-opened by a
  future session that was not in the room. Write them in as the first dated entry before the
  interview fades. Then tell the owner, in one sentence, what the file buys them: *"Anything we
  settle goes in here, so no future session reopens it and you never argue for the same choice
  twice."* Maintaining it is on by default; an owner who does not want it says so.
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
- **Where it gets published, and whether the AI can do it alone.** Default: a **fresh Cloudflare
  account** in the owner's name (free, and it holds the domain, DNS and any app in one place). The
  alternative is somewhere they already are (Vercel, Netlify, their own server, an existing
  Cloudflare account) — ask which, and record it in `brief.md`. If it is Cloudflare, run
  `npx wrangler login` with them **now**, in the setup session: it is one browser click, and it is
  what lets every later session publish without them opening a dashboard. Two things that login
  still cannot do, so say so once rather than discovering them mid-deploy: **writing a DNS record**
  and **creating a Cloudflare Access policy** are dashboard steps. (If `source/inbox/setup-answers.md`
  exists, the bootstrap script already asked these — read it, act on it, delete it.)
- **A private dashboard? One plain question, and the default is yes.** *"Do you want a private page,
  only you can open, that shows where everything stands?"* It is the kit's default private app: a
  themed dashboard built from the projects the `projects` skill tracks — what moved, what is open,
  one card per subject (`source/formats/dashboard.md`). If yes: set the Worker name in
  `apps/dashboard/wrangler.jsonc` to `<slug>-dashboard`, and ask **who else may open it** (their own
  address plus any colleague, by email — that list becomes the Access policy, and it is the whole
  grant). Deploying it needs Zero Trust enabled once in their dashboard, which is a human click:
  walk them through it per `docs/deploy-cloudflare.md` ▸ *Publishing something private*, and never
  put the dashboard on a public URL in the meantime.
- **The optional modules, one plain question each.** The kit can also run more of the
  organization than its website: *do you want to track your actual work here* (clients, grants,
  launches: the `projects` skill, a folder per project with its charter, decisions and files)?
  And *do you manage people and want help with 1:1s and priorities* (the `team` skill; its data
  stays in a gitignored, local-only folder and never leaves the machine — say that sentence, it's
  the reason to trust it)? Yes activates the module now (create its folder per the skill); no
  costs nothing, and saying "start tracking project X" or "sync my team" later activates it then.
  If either is on, offer to fill `source/objectives.md` (the north star both modules prioritize
  against) from what the interview already established; it stays the owner's alone to change.

## 2. Access and tokens, all in one pass

**Do this before you build anything, and do it in a single sitting.** Every account, every
invitation, every token the project will need for the next year gets asked for now, while the owner is
sitting at the keyboard and in the mood to click. After this pass you should never again have to
interrupt them to unblock yourself.

This matters most for a **non-technical owner**. They will not remember what a token is next month,
they will not want to be walked through a dashboard while waiting for a document, and each
interruption is where a project quietly stops. One shared half-hour buys a year of autonomy.

How to run it:

- **Write the list first, then ask.** From the interview, list every external thing this project will
  read or write: the code host, the hosting account, the domain registrar, the drive or folder where
  their documents live, the mailbox, the payment or donation platform, the analytics, any CRM. Show
  them the list before asking for anything, so they see the whole ask instead of a drip.
- **For each one, name what you need and what you'll do with it**: an invitation, a connector to
  authorise, an export, an API credential. Say plainly which are read-only.
- **Automate every step you can, and pre-chew the rest.** Do the parts that can be done from here.
  For what only they can do, hand them the direct link to the exact screen, the values to type, and
  the order to click — one screen at a time, confirming each before the next. Never send someone
  non-technical to "the settings".
- **Never take a secret through the conversation.** A key pasted into the chat is a key in a
  transcript. Have them set it where it belongs (a hosting secret, a password manager) and, if a
  script is needed, write one that prompts for it locally and never echoes it. The same rule kills the
  shortcut of creating tokens on their behalf: a token you create is a token you have seen.
- **Record the outcome, not the secret.** One table in `docs/` per project: which account, whose
  login, what it is used for, and where the credential lives. Future sessions read that table instead
  of asking again.
- **Note what is still missing and who owes it.** An access the owner could not grant today becomes a
  dated line in the to-do list with their name on it, not a vague intention.

The failure this prevents: a system that works only when its owner is available to authorise
something. Judge the pass by asking whether you could now do a month of work without them.

## 3. Structure and facts, before anything is built

**Run the `fact-finding` skill** (`.claude/skills/fact-finding/SKILL.md`) now, in full. It is the
kit's master recipe and this is its founding use: decide the folder and file structure for *this*
organization, decide which facts matter, sweep whatever corpus they have (documents, a live site to
replace, an old repo to mine, a mailbox they offer, or their own memory), and record the facts, the
decisions and the history with their sources.

Two things not to negotiate away, however keen the owner is to see a site:

- **The structure is decided with them, not inherited from the template.** The template's layout is a
  proposal. What accumulates here, and in what unit, is theirs to answer, and it is expensive to
  change once material has landed in the wrong shape.
- **Nothing is built before the fact base exists.** It is tempting to build v1 from the interview and
  fill `source/` afterwards. Afterwards never comes: once the site looks finished, nobody opens the
  corpus again, and every later session then reasons from a conversation it cannot read. The site is
  a derivative; build it from files, not from memory.

Come back from that skill with its three lists (what is recorded, what could not be established, what
you propose to build). Then continue here.

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

**The repo connection is the deliverable of this step, not the deploy.** A Worker you deployed by
hand looks identical to a connected one and silently stops publishing what you push. So finish by
pushing a trivial commit and watching a build start on its own, and do the same for every other
Worker this project owns (a private dashboard, a second app) at the moment you create it. If the
owner is not technical, this is one of the screens you walk them through in the access pass — a
build configuration needs an API token that only their dashboard can mint, so it cannot be done from
here.

## 7. Close

Run the reflect skill (it will have plenty to record from this session), push everything, and tell the owner what exists now: the live URL, what each folder is for in one line each, and how to work with you from now on (open the folder, run `claude`, talk, drop files in the inbox).
