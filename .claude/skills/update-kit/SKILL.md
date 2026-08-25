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
  `docs/`, `scripts/`, `lib/`, `source/formats/*.md`, the root deploy config (`package.json`,
  `wrangler.jsonc`), and the root `CLAUDE.md` / `SETUP.md` / `README.md`.
- **The owner's** (never overwrite): everything under `source/` *except* `source/formats/`
  (so `brief.md`, `content/`, `facts/`, `brand/`, `inbox/`, and `quality/incidents.json` — the
  register of what went wrong on *their* project), all of `site/`, `apps/` **except
  `apps/dashboard/` and `apps/todos/`** (framework, minus the owner values in their
  `wrangler.jsonc`), and `site/public/decks/`.

## The one owner file with generic content in it

`source/brand/voice.md` is the owner's and is never overwritten. But the template sometimes adds a
section to it that is generic rather than personal — the *AI tics* list is the case that exists
today. When the template's voice guide has a section the project's does not, **offer it**: show the
owner the heading and a line of why, and append it only if they say yes. Never merge it silently
into a file that carries their voice.

## Steps

**Run the script; do not hand-roll the git.** `scripts/kit-sync.mjs` does the comparison that
matters, and getting it wrong silently reverts the owner's work.

1. **Safety first.** `git status`. Commit or stash anything uncommitted before touching a file.

2. **Add the template remote, once:**
   `git remote add template https://github.com/pyduan/agentic-organization.git`

3. **See what an upgrade would do:**

   ```bash
   node scripts/kit-sync.mjs status
   ```

   It prints the changelog entries added since this project's baseline — **read those to the owner
   in plain language**, because that is the only moment they learn what they gained. Then it lists,
   separately: what only the kit changed (safe), what only they changed (left alone), and what both
   changed (needs a human).

4. **If it says there is no `.kit-sync`, adopt first:**

   ```bash
   node scripts/kit-sync.mjs adopt
   ```

   One time only, for a project older than this mechanism. It asks the template's own history
   whether it ever published each file exactly as it is here: if so the owner never edited it and
   the new version is taken; if not, the file is kept as theirs and reported. On a real project this
   turned 54 files to review into 11.

5. **Apply:**

   ```bash
   node scripts/kit-sync.mjs apply
   ```

   Nothing colliding is ever written. `CLAUDE.md`, `package.json` and `wrangler.jsonc` are
   report-only: they always carry local values, so they are listed and never replaced.

6. **Resolve the collisions with the owner, one at a time.** For each file, `git diff <baseline>
   template/main -- <file>` shows what the kit changed and `git diff <baseline> -- <file>` what they
   changed. Three outcomes, and naming which one it is matters more than the merge itself:
   - the local edit was **fixing something the kit got wrong** → upstream it, do not just re-apply it
   - it is a **legitimately local rule** → move it out of the framework file into one the kit never
     touches, so it stops colliding every upgrade
   - it is **drift** nobody meant → take the kit's version

7. **Tell the owner what changed**, from the changelog, in their language. Then commit, including
   the updated `.kit-sync`.

## What a real update run teaches (learned 2026-07-29, refreshing a live project)

- **"Framework" files get locally customised too.** `docs/deploy-cloudflare.md` had become that
  project's actual hosting config, `source/facts/README.md` and the format playbooks carried
  project-specific conventions. Before checking out a framework path, compare it with the template
  (a quick `md5`/`diff` sweep over the list is enough) and hand-fold the ones that genuinely differ
  instead of overwriting them. Overwrite only the files that are still the template's own text.
- **Don't install a module the project has no use for.** An all-volunteer association has no 1:1s,
  so the `team` module (and its `.gitignore` rules) stayed out, and `SETUP.md` was dropped because
  the project is long since set up. Say what you left out and why; an unused skill is noise that a
  future session will try to honour.
- **Seed the new files, don't leave a TODO template in a live project.** `objectives.md` and
  `decisions.md` could be filled from the repo itself (the facts file, the brief, the git history),
  marked as reconstructed and awaiting the owner's confirmation. A file full of TODOs teaches the
  next session nothing.
- **A new framework file often overlaps something local.** `facts/methodology.md` duplicated a scope
  section the project had grown inside `facts/README.md`. Pick one home, move anything unique into
  it, and leave a pointer from the other, or the two will drift.

## If the merge gets messy

The template and this project have unrelated histories, so a plain `git merge template/main` will
conflict heavily — **don't**. The path-scoped `git checkout template/main -- <paths>` above avoids
that entirely: it only touches framework files. If a framework file was locally customised and you
don't want to lose that, diff it first (`git show template/main:<path>`) and merge by hand.

## Telling other people on the same project

If teammates cloned this repo, they just `git pull` — the framework update rode in with the owner's
push. If someone has **their own project** from the same template and wants these improvements, they
run this skill in *their* repo (their `source/`/`site/` stay untouched; only the framework refreshes).
