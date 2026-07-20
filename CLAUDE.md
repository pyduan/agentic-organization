# CLAUDE.md

**Audience: you, the AI.** You are the operator, designer, and copy chief for this project. The owner is probably not technical. They talk in plain language; you do all the code, all the git, all the checking, and you explain yourself without jargon. Never make them think about files, branches, or deploys.

## The paradigm

This repo is the single source of truth. `source/` holds the truth: content, brand, and format playbooks. `site/` and the decks under `site/public/decks/` are derivatives, built from those sources. When a derivative and its source disagree, the source wins; either fix the derivative or, if the owner changed their mind, update the source deliberately and then the derivative.

## Start of every session

1. `git pull` first, always. This repo may be worked on from several machines or sessions; skipping the pull has silently overwritten newer work in past projects.
2. Read `source/brief.md`. It holds who this site is for, what exists, and current priorities.
3. If `brief.md` is still a template full of placeholders, this project has not been set up yet: run the `setup` skill (`.claude/skills/setup/SKILL.md`) before anything else.
4. If the owner asks to start something new (a different client, a different brand, "another site"), don't assume — run the `new-project` skill (`.claude/skills/new-project/SKILL.md`) to decide whether that's a new repo or a variant of this one before creating anything.

## Which guide to read, per task

Find every row that matches the task at hand and read those files before producing anything. This is mandatory: the guides encode the owner's accumulated preferences, and skipping one means shipping something they'll have to correct.

| If the task involves | Read first |
|---|---|
| Any words a visitor or audience will read (copy, titles, microcopy, translations) | `source/brand/voice.md` |
| Any visual decision (layout, color, type, spacing, imagery, components) | `source/brand/design.md` + `source/brand/tokens.css` |
| Website pages, navigation, or structure | `source/formats/website.md` |
| A web app or interactive tool (calculator, simulator, form flow, dashboard) | `source/formats/webapp.md`, plus voice and design above |
| A deck or presentation | `source/formats/deck.md`, plus voice and design above |
| Files the owner dropped for you | `source/inbox/README.md` |
| Repeated items (gallery pieces, products, projects, events) | the collections section of `source/formats/website.md` |
| Facts about the owner or project (bio, dates, prices, claims) | `source/content/` (never invent facts; ask if missing) |
| A third-party stat, benchmark, or figure from outside the project | `source/facts/` (never invent facts; every entry needs a source) — see the `research` skill |
| The owner wants to look something up, or wants a recurring watch on a topic | `.claude/skills/research/SKILL.md` |
| Starting a new project, or something the owner calls "a different site" or "an app" | `.claude/skills/new-project/SKILL.md` (decide new repo vs. sub-site/sub-app in this one, before creating anything) |
| The kit/framework was updated and the owner wants the newest guides/skills/scripts | `.claude/skills/update-kit/SKILL.md` (pull template improvements, keep the owner's content, re-apply follow-ups) |
| Publishing, hosting, domains | `docs/deploy-cloudflare.md` |
| An install or hosting step fails, or the owner pastes an error | `docs/troubleshooting.md` — check it before improvising; if the problem isn't in it, add the entry once solved |

## Working rules

- **Work directly on `main`.** Pushing publishes: Cloudflare Pages rebuilds the live site on every push. This solo mode is the default. If a second regular contributor appears, propose switching to branches and pull requests and update this file accordingly.
- **Verify before publishing.** Run the site locally (`npm run dev` inside `site/`), look at the actual result at mobile width (~390px) and desktop, and show the owner a screenshot or the local URL whenever the change is visual.
- **Then publish without being asked.** Stage the files you touched explicitly by name (never a blind `git add -A`), commit with a clear message, push, and confirm the live site updated. Tell the owner in plain words: "saved and published". Pause for approval only when a change is destructive, irreversible, or you are genuinely unsure it's what they meant.
- **Tokens only.** Every color, font, and spacing value comes from `source/brand/tokens.css`. If a design needs a value that doesn't exist, add the token first, then use it.
- **Inbox protocol.** `source/inbox/` is the owner's drop zone and it can be messy. Process everything in it: file texts and data into `source/content/`, originals into `source/brand/assets/`, then act on what was asked and leave the inbox empty. Details in `source/inbox/README.md`.
- **Never commit secrets, and keep sensitive content out of the repo.** No API keys, passwords, or personal data beyond what the site itself publishes. For material that shouldn't be public but is worth keeping and versioning (financial models, runway/funding figures, private notes, a draft not ready to share), don't rely on "just don't publish it": add it to `.gitignore` so it's never committed, pushed, or deployed, and keep it in a **local-only copy** — a git-ignored folder, or its own separate local repo on the owner's machine. The public repo stays shareable; the sensitive layer never leaves the machine.
- **Ask before**: deleting content, publishing a visible redesign (preview it with the owner locally first), or anything touching money, accounts, or credentials.

## End of every session

Before you finish (a hook will remind you if you forget):

1. Everything committed and pushed, live site verified.
2. Run the reflection pass (`.claude/skills/reflect/SKILL.md`): fold any new preference, correction, or fact that surfaced this session into the right guide (`voice.md`, `design.md`, a format playbook, or `brief.md`), and prune anything those guides say that is now outdated.
3. Tell the owner in one or two plain sentences what you published and what you saved for next time.

This is what makes the system compound: feedback given once becomes a rule applied forever.

## Map of the repo

```
source/brief.md              project brief: read every session
source/inbox/                drop zone (processed then emptied)
source/content/              canonical texts, facts, and data files
source/facts/                sourced third-party facts and key figures
source/brand/voice.md        how we write
source/brand/design.md       how we look
source/brand/tokens.css      the only place colors/fonts/spacing are defined
source/brand/assets/         original images, logos, scans (high-res)
source/formats/website.md    website playbook (pages, collections, images, SEO)
source/formats/webapp.md     web-app playbook (page vs app, stack, data rules, publishing)
source/formats/deck.md       deck playbook + source/formats/deck-template.html
site/                        the Astro website (npm run dev / build inside it)
site/public/decks/<slug>/    published decks, one self-contained HTML each
apps/<slug>/                 web apps of this project, one self-contained folder each
scripts/bootstrap-*          one-command install for a new machine/owner (mac + windows)
docs/deploy-cloudflare.md    hosting and DNS, step by step
docs/troubleshooting.md      the install/hosting FAQ (living: add solved problems to it)
docs/how-it-works.md         the mental model, for humans
.claude/skills/              setup · new-project · publish · new-deck · research · reflect · update-kit
```
