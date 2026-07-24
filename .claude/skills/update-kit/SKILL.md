---
name: update-kit
description: "Pull the latest agentic-organization template improvements into this project and re-apply the owner's own work on top, safely. Use when the owner says the kit/framework was updated, wants the newest guides/skills/scripts, or 'update the framework'."
---

# Update the framework in this project

This project was created from the `pyduan/agentic-organization` template. The template keeps
improving (new skills, better guides, fixed scripts). This skill pulls those improvements in
**without clobbering the owner's own content** — their `source/`, their `site/`, their pages are
theirs; the *framework scaffolding* (`.claude/`, `docs/`, `scripts/`, the format playbooks in
`source/formats/`, the root deploy config `wrangler.jsonc`/`package.json`, and the root
`CLAUDE.md`/`SETUP.md`/`README.md`) is what gets refreshed.

**The golden distinction.** Two kinds of files live here:
- **Framework** (comes from the template, safe to update): `.claude/skills/`, `.claude/hooks/`,
  `docs/`, `scripts/`, `source/formats/*.md`, the root deploy config (`package.json`,
  `wrangler.jsonc`), and the root `CLAUDE.md` / `SETUP.md` / `README.md`.
- **The owner's** (never overwrite): everything under `source/` *except* `source/formats/`
  (so `brief.md`, `content/`, `facts/`, `brand/`, `inbox/`), all of `site/`, `apps/`, and
  `site/public/decks/`.

## Steps

1. **Safety first.** `git -C <repo> status`. If there's uncommitted work, commit it (or stash with
   `-u`) before touching anything — the owner's in-progress edits must survive.
2. **Add the template as a remote** (once): `git remote add template
   https://github.com/pyduan/agentic-organization.git` (skip if it already exists), then
   `git fetch template`.
3. **Bring in framework files only.** Don't merge the whole template (it would fight the owner's
   content and history). Instead, check out just the framework paths from the template's main:
   `git checkout template/main -- .claude docs scripts source/formats SETUP.md README.md package.json`
   Leave `CLAUDE.md` for step 4 (it may carry local rules the owner added).
   Also compare the template's `.gitignore` with this project's and merge in any rules the
   template added for local-only folders (the team module's `team/*` + `!team/README.md`,
   and `.wrangler/`): those rules are a privacy/hygiene guarantee, and an updated skill must never
   run without them.
   **`wrangler.jsonc` is framework but carries one owner value — reconcile it, don't overwrite.**
   If the project has no `wrangler.jsonc` yet (set up before the Workers migration), bring it in
   (`git checkout template/main -- wrangler.jsonc`) and set its `name` to the project's slug. If it
   already has one, keep the owner's `name` and only fold in any other field the template changed.
   Bringing in `wrangler.jsonc` + `package.json` is safe on its own: it does **not** touch a live
   site (a still-running Cloudflare Pages deploy keeps working — its build root is `site/`, and
   these files sit at the repo root where Pages never looks). Switching hosting to Workers is a
   separate, deliberate step in `docs/deploy-cloudflare.md` ▸ "Already on Cloudflare Pages?".
4. **Reconcile `CLAUDE.md` by reading, not overwriting.** Diff the template's `CLAUDE.md` against
   this one (`git diff --no-index CLAUDE.md <(git show template/main:CLAUDE.md)`), and fold in the
   new framework rules while **keeping any project-specific rules** the owner or you added over
   time. Same for `README.md`/`SETUP.md` if the owner personalised them.
5. **Re-apply the owner's work on top.** The owner's `source/` (minus `formats/`), `site/`, and
   `apps/` were never touched, so nothing to re-apply there. But if a framework change *implies*
   follow-up (a new format playbook, a renamed skill, a changed folder), do that follow-up now:
   re-read the refreshed guides and bring the site/content into line where it's cheap and safe
   (e.g. a new `source/facts/` folder → offer to populate it; a new `apps/` convention → note it;
   the update introduced the `projects` and `team` modules → mention them in one sentence each and
   offer to activate, creating `source/objectives.md` from the template if the owner wants
   prioritization against a north star). **If this update brought in the Workers deploy config and
   the site is still hosted on Cloudflare Pages**, say so in one plain sentence — the site keeps
   working untouched, and moving it to Workers is an optional one-time step (create a Worker on the
   same repo, move the custom domain) they can do whenever they like, per
   `docs/deploy-cloudflare.md` ▸ "Already on Cloudflare Pages?". Don't do it unprompted.
   Show the owner what changed and what you propose to redo; don't silently rewrite their pages.
6. **Verify + publish.** `npm run build` inside `site/` is green, run it locally, then commit
   ("chore: update framework from template") and push, per the `publish` skill. Tell the owner in
   plain words what improved and anything they should look at.

## If the merge gets messy

The template and this project have unrelated histories, so a plain `git merge template/main` will
conflict heavily — **don't**. The path-scoped `git checkout template/main -- <paths>` above avoids
that entirely: it only touches framework files. If a framework file was locally customised and you
don't want to lose that, diff it first (`git show template/main:<path>`) and merge by hand.

## Telling other people on the same project

If teammates cloned this repo, they just `git pull` — the framework update rode in with the owner's
push. If someone has **their own project** from the same template and wants these improvements, they
run this skill in *their* repo (their `source/`/`site/` stay untouched; only the framework refreshes).
