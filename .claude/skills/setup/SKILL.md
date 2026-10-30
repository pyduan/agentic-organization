---
name: setup
description: "First-time project setup: walk the stack with the owner and get each row approved, build and publish their intranet, then interview the owner, ingest their content (dropped files, a scrape of their existing site, or a clone of an existing repo mined for content), personalize the brand guides, build v1 of the site, and help put it live. Use when source/brief.md still contains TODO placeholders, or when the owner asks to set up or start their site."
---

# Setup

The founding session. Unlike normal sessions, here you ask questions liberally: everything you learn now becomes guides that every future session runs on. Budget the conversation; batch questions in small, natural groups rather than one long form.

**The order matters more than the questions.** The stack first, approved row by row; then the
intranet, built and published; then the interview, structure and facts, guides, and the site last.
The first two are short and they come first for one reason each. The stack is every later step's
premise: an interview that assumes a host or a mailbox the owner has not chosen gets redone. The
intranet is the place the owner will come back to: within the first half-hour they have a private
page, behind a sign-in, that says how to work with you and where everything will appear. What the
rest of the session builds lands there.

An owner will often want to see the website in the first twenty minutes, and giving in to that is
how a project ends up with a pretty site and no source of truth underneath. The intranet is what
they see early instead, and it is built from the files from its first day. Say what you are doing
and why: the hour buys them a system, and the site falls out of it in the last third.

## 0. Before talking: the seed and the AI policy

This step is reading, on your side, before the first question. It stays step 0 because both files
change what you ask in steps 1 and 3; the owner confirms their content there, never here.

If `source/seed.md` exists, someone prepared this repository before today (`docs/seeding.md`): read
it now. Every line marked *(seed, to confirm)* is your interview notes, not an answer. Its lines
about services and accounts are settled in the stack walk (step 1), as rows the owner approves or
changes; every other line is confirmed at the start of the interview (step 3). When every line is
settled, record that in `source/decisions.md` and delete `source/seed.md`. Never treat a seeded
decision as taken.

If the organization publishes an AI policy, read it now as well: a principle about where data may
go constrains rows of the stack, and the others become rules in `AGENTS.md`, `ORGANIGRAM.md` and
`.gitignore`, which the owner confirms in the interview.

## 1. The stack, row by row

The first thing you do with the owner. `STACK.md` lists what runs on what: one row per brick, its
state and its way out. Walk it with them **one row at a time**, in plain words: what the brick does
for them, what the kit proposes, what it costs, and how they would leave it. Then ask for a yes or a
change. Do not hand them the table to approve in one go: a table approved whole was not read.

- **Approved as it stands:** fill the *Approved* column with the date and who said yes,
  `2026-10-30 @sam`, by the handle `ORGANIGRAM.md` uses (the owner's own the first time).
- **Changed:** rewrite the row with what they chose (another host, a mailbox they already pay for,
  a registrar they use), its way out, and the same date and handle. A change that touches a later
  step (no Cloudflare, so no Access) is said now, with what it changes.
- **Not decided today:** the row keeps *to decide*, and a dated `#decide` line with their name goes
  in the to-do list (`source/formats/todo.md`), so `open-decisions` raises it every session.
- **A brick the seed or the AI policy constrains:** say which line constrains it and let the owner
  settle it; a seeded row is a proposal like any other.

Hold the rule at the end of `STACK.md`: an account in a person's name is not an organization's
account. When the default is a fresh Cloudflare account, it is a fresh one in the organization's
name, with two administrators.

Two things follow the walk at once, because step 2 publishes:

- **If hosting is Cloudflare, run `npx wrangler login` with them now.** It is one browser click,
  and it is what lets every later session publish without them opening a dashboard. Two things that
  login still cannot do, so say so once rather than discovering them mid-deploy: **writing a DNS
  record** and **creating a Cloudflare Access policy** are dashboard steps or need a token of their
  own. (If `source/inbox/setup-answers.md` exists, the bootstrap script already asked where they
  publish and may have logged them in: read it, act on it, delete it.)
- **How you will handle their code, in plain terms.** It sets how every future session publishes,
  the intranet included. Two modes:
  - **Simplified (the default; right for most, especially non-technical owners):** you have full code-management rights: you commit, push, publish, and merge on your own, pausing only for destructive or irreversible actions. They never touch git or a command line; you never hand them one.
  - **Review mode (for owners comfortable with git who want to stay in the loop):** you still do all the git yourself, but you pause for a yes before each push or merge.
  Ask it simply, *"Once a change looks good, should I just publish it, or check with you first each time?"*, with AskUserQuestion offering those two options. Record the choice in `brief.md` (Governance → "How the AI publishes"); if they pick review mode, also flip the publish rule in `AGENTS.md`. Most owners want simplified. Either way you run all the git; the mode only decides whether you pause for a yes before publishing.

Commit `STACK.md` when the walk is done: it is the first decision of the project, and it is dated.

## 2. The intranet, built and published

Straight after the stack, before the interview. The intranet is the private home page of the
organization (`source/formats/dashboard.md`): a banner with a quickstart and how the system works,
then where projects stand, who waits on what, and the tools. On day one its dashboards are empty,
and its empty state tells the owner how to fill them; that is expected, and the banner is the point.

1. **Who may open it.** Their own address, plus anyone they name, one per line in
   `apps/dashboard/access.txt`. That file is the whole grant.
2. **The banner, in their words.** Read `source/content/intranet-home.md` with them. Translate it
   into their language if it is not English, and change what does not fit (a team that works in
   Slack says so in the quickstart). The tools in `source/content/intranet-tools.md` stay as they
   are until each app has an address.
3. **Build it and look at it.** Set `name` in `apps/dashboard/wrangler.jsonc` to `<slug>-dashboard`.
   `npm run intranet`, then serve `apps/dashboard/dist/` locally and show it at phone width and on a
   desktop. Run `node scripts/check-contrast.mjs` on its pages; it must exit 0. The header shows the
   repository's name until the brief is written in step 6.
4. **Publish it behind Access**, per `docs/deploy-cloudflare.md` ▸ *Publishing something private*:
   Zero Trust enabled once on the account (one human click; the free plan is enough),
   `npm run deploy:intranet`, then `node scripts/protect-access.mjs --worker=<name>
   --emails=apps/dashboard/access.txt`. The token that script needs is the first item of the access
   pass (step 4), taken now with the same rules: never through the conversation. Connect the Worker
   to the repository at creation, so a push republishes it.
5. **Verify from outside**: the URL with a cache-buster, from a browser that is not signed in, must
   answer a login redirect or a `403`. A `200` is an incident. Then sign in with them once, so they
   see the page and the one-time code.
6. **Record it.** The URL goes in `brief.md` under derivatives and in the *Private pages* row of
   `STACK.md`; their bookmark is the page they will open tomorrow.

If the stack walk chose a host without an access gate, the intranet stays on their machine (`npm
run intranet`, opened locally) until one exists, with a dated `#decide` line. It never goes on a
public URL in the meantime.

## 3. Interview

If a seed exists, start here with its lines that step 1 did not settle: walk the owner through them
in small groups, confirm or correct each one, replace the mark with their answer, and ask only what
the seed does not cover.

Establish, in the owner's own words:

- Who they are and what this site is for (the elevator pitch, the audience, what a visitor should do).
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
- **The optional modules, one plain question each.** The kit can also run more of the
  organization than its website: *do you want to track your actual work here* (clients, grants,
  launches: the `projects` skill, a folder per project with its charter, decisions and files)?
  And *do you manage people and want help with 1:1s and priorities* (the `team` skill; its data
  stays in a gitignored, local-only folder and never leaves the machine — say that sentence, it's
  the reason to trust it)? Yes activates the module now (create its folder per the skill); no
  costs nothing, and saying "start tracking project X" or "sync my team" later activates it then.
  Projects are what fill the intranet's dashboards, so a yes is also the moment to track the first
  one together and rebuild the intranet: the owner sees their work appear on the page they now have.
  If either is on, offer to fill `source/objectives.md` (the north star both modules prioritize
  against) from what the interview already established; it stays the owner's alone to change.

## 4. Access and tokens, all in one pass

**Do this before you build anything beyond the intranet, and do it in a single sitting.** Every account, every
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
  transcript. Have them set it where it belongs (a hosting secret, a password manager, the computer's
  keychain for a credential a local script uses) and, if a
  script is needed, write one that prompts for it locally and never echoes it. The same rule kills the
  shortcut of creating tokens on their behalf: a token you create is a token you have seen. The one
  exception is a token a CLI mints and pipes straight into the store that uses it: never printed,
  able to do one job, and dated (`docs/deploy-cloudflare.md` ▸ *Without a dashboard screen*).
- **Record the outcome, not the secret.** One table in `docs/` per project: which account, whose
  login, what it is used for, and where the credential lives. Future sessions read that table instead
  of asking again.
- **Before the first invitation to a GitHub organization, set its base permission to "No
  permission".** GitHub's default lets every member read every repo of the organization, so the first
  person invited for one repo can also read the restricted one. Give access per team or per repo
  instead, as `ORGANIGRAM.md` says, and read the setting back:
  `gh api orgs/<org> --jq .default_repository_permission` must answer `none`.
- **Keep `STACK.md` current as you go**: the rows were approved in step 1; an account or service
  this pass adds gets its row, its state and its way out, approved the same way, with the date and
  who. The rows still *to decide* at the end of the pass are the infrastructure the organization has
  not chosen yet, and the owner should see them.
- **Note what is still missing and who owes it.** An access the owner could not grant today, a token
  only they can create, a choice you made on their behalf (`source/decisions.md` ▸ *Only a person
  settles*): each becomes a dated `#decide` line in the to-do list with their name on it
  (`source/formats/todo.md`), so that `open-decisions` raises it at the start of every session, a
  parallel one included, until it is ticked. A step that lives only in the closing message is lost
  to the next session.

The failure this prevents: a system that works only when its owner is available to authorise
something. Judge the pass by asking whether you could now do a month of work without them.

**Start `FEATURES.md` ▸ *This organization's own*** with what the interview decided this
repository will do beyond the kit (a module turned on, an app, a pack), each with its **Why:**.
Every later session keeps it current in the same commit as the change.

## 5. Structure and facts, before anything is built

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

## 6. Personalize the system

Replace every TODO in these files with what you learned, keeping each file's structure:

- `source/brief.md`, complete and current; it's the first thing every future session reads. Its first heading is the organization's name, which the intranet's header shows from the next build: rebuild and republish it.
- `source/brand/voice.md`: tone words with meanings, banned words, notation of the project name, languages.
- `source/brand/design.md`: the philosophy paragraph, type choices, imagery style.
- `source/brand/tokens.css`: the real palette and fonts. If using webfonts, self-host them per the design guide.
- `source/facts/README.md`'s relevance section, and `source/facts/methodology.md` (the watch's themes, first sources, and cadence): in-scope/out-of-scope topics and trusted sources, from what the owner just told you.
- `ORGANIGRAM.md`: replace the placeholder repo row(s) with the real ones, and write the three rights as they actually stand. Solo with one repo means the template is nearly right already; leave it minimal.

Read each personalized guide back as a whole; it must read as this project's guide, with no template smell left.

## 7. Build v1

Build the site in `site/` per `source/formats/website.md`: layout shell first (nav, footer, typography on tokens), then pages, then collections if any. Replace the placeholder home page. Run `npm install` and `npm run dev` inside `site/`, verify at mobile and desktop widths, then review it with the owner page by page (share the local URL, show screenshots). Iterate until they're happy; this loop is most of the session.

## 8. Go live

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
Worker this project owns (the intranet, a second app) at the moment you create it. Once the site
is live, put its address on the *Website* line of `source/content/intranet-tools.md`, and do the
same for each app the day it gets one. If the owner is not technical, this is one of the screens you
walk them through in the access pass — a build configuration needs an API token that only their
dashboard can mint, so it cannot be done from here.

## 9. Offer the routines — do not install them

Read [`routines/README.md`](../../../routines/README.md) and tell the owner, in plain words, what
each available routine would do and how often. **Install only what they say yes to**, with the
scheduled-task tooling.

Start with `freshness-sweep`, monthly: it is the check nothing else performs, asking whether what
they published is still there and whether what the repo says about the world is still true. It only
reads.

**Every routine names who runs it. If that is not the owner in front of you, ask** whether they
want their own copy personalised to their accounts and repos, or meant to run someone else's. A yes
means a new routine carrying their identity, not a second installation of another person's.

Why offer rather than install: a routine writes a cron entry on their machine and then acts while
nobody is watching. That is a side effect on their computer, not a file in their repo, and the kit's
rule is that nothing is applied silently. Say what it does, say it can be removed, wait for the yes.

## 10. Close

Run the reflect skill (it will have plenty to record from this session), push everything, and tell the owner what exists now: the intranet's address first (the page to open every morning, whose banner repeats how to work with you), the live site's URL, what each folder is for in one line each, and how to work with you from now on (open the folder, run `claude`, talk, drop files in the inbox).
