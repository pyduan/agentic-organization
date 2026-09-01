---
name: update-kit
description: "Pull the latest agentic-organization template improvements into this project and re-apply the owner's own work on top, safely. Use when the owner says the kit/framework was updated, wants the newest guides/skills/scripts, or 'update the framework'."
---

# Update the framework in this project

This project was created from the `pyduan/agentic-organization` template. The template keeps
improving (new skills, better guides, fixed scripts). **The owner does not have to ask**: a
session-start hook runs `scripts/kit-news.mjs`, which checks the template quietly and, when there
is something new, opens the session with the list of what this project has not taken. Your job
then is to say what those updates bring in the owner's language and offer this skill — never to
apply them on your own. This skill is the "yes" path. It pulls the improvements in
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

2. **Add the template remote, and fetch the script itself.** On a project older than this
   mechanism `scripts/kit-sync.mjs` does not exist yet, so the instruction to run it cannot be
   followed — the procedure loops. Bring it down first; it overwrites nothing, because it is absent:

   ```bash
   git remote add template https://github.com/pyduan/agentic-organization.git   # once
   git fetch template
   git checkout template/main -- scripts/kit-sync.mjs
   ```

   **Commit that file before going further.** `git checkout` stages what it fetches, and the steps
   below take a while: in a repo where another session is working, its next narrow commit will
   publish this file under a message about something else.

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

   **It installs every framework file the project does not have**, not only the unedited ones: an
   absent file counts as pristine, so a project that diverged from the kit's shape gets the whole
   scaffolding at once. On a live instance that meant a root `wrangler.jsonc` in a repo whose own
   CLAUDE.md forbids a second one, two apps it already had its own versions of, and a module its
   confidentiality rules do not allow. Read the pristine list before believing it, and delete what
   the project's shape does not want: `status` then reads those deletions as yours and never
   restores them.

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

## The block to send an install that predates `kit-sync`

An instance onboarded before the kit-news hook existed cannot be told anything by the kit: the
notifier ships inside the repo it notifies about, so its owner learns about a change only when
somebody emails them. Worse, its copy of *this skill* is the old one, which proceeded by
`git checkout template/main -- …` over whole paths and would overwrite the owner's own files. The
step that saves them is fetching `kit-sync.mjs` from the template **before** reading any local
instructions, which is why the block below opens with it.

Send this verbatim. It is written to run to the end without a conversation, because the version that
paused after each step generated a dozen emails of arbitration for two projects, and every pause is
a place a non-technical owner has to decide something they have no way to judge. Keep it in English
whatever language the owner writes in; the block tells the agent which language to answer in.

```
Update this project to the current version of the agentic-organization kit.

Run all six steps to the end without asking me anything. I am not technical and I
cannot arbitrate mid-way. Decide the ordinary things yourself, and use the defaults
below where you would otherwise ask. Report once, at the end.

Do NOT follow this repo's own .claude/skills/update-kit/SKILL.md if it tells you to
run `git checkout template/main -- <paths>` over whole folders: that version is old
and it overwrites my work. Step 3 replaces it.

1. INVENTORY, and change nothing. How many commits is this clone behind its own
   origin; is there uncommitted work, including files that were never added to git
   (`git status --porcelain --untracked-files=all` — the never-added ones are usually
   the real week's work and the ordinary stash path walks straight past them); are
   there unpushed commits or stashes; is there more than one copy of this project on
   this machine, and which one am I in. Do not skip the last one: three copies of a
   project on one disk is common and working in the wrong one is silent.

2. RESCUE, before touching anything else. Put every uncommitted change AND every
   untracked file on a branch named `catchup/<today>`, push it, and tell me its name.
   Never on main. Then confirm the tree is clean and say why it is clean. If another
   session might be writing here, take the capture without touching the working tree.
   Do not merge this branch into anything, now or later: it is mine to sort through.

3. GET THE SYNC TOOL FROM THE TEMPLATE, not from this repo.
   `git remote add template https://github.com/pyduan/agentic-organization.git` (skip
   if it exists), `git fetch template`, then
   `git checkout template/main -- scripts/kit-sync.mjs` and commit that one file.
   If `node --version` fails, install Node first (`brew install node` on a Mac, or
   scripts/bootstrap-mac.sh) and say so in the report — nothing below can run without it.

4. SYNC. `node scripts/kit-sync.mjs status`, then `adopt` if it says there is no
   .kit-sync, then `apply`. Apply everything it offers. Where it sets a file aside
   because I changed it too, LEAVE IT SET ASIDE and list it in the report: those are
   the only real decisions and they are mine. Do not resolve them by choosing the
   template's version.

5. VERIFY, and read the output rather than assuming it. `node scripts/check-fleet.mjs`
   and `node scripts/kit-news.mjs` — paste what they actually print. Then
   `node scripts/check-freshness.mjs`, which now asks whether this repo's .gitignore
   is true: if it reports files already in git under a rule forbidding them, list them
   and say whether any could have held a password, but do not untrack anything yet.
   Then open ORGANIGRAM.md and fill in the `Kind` column of the repo table: `router`
   for a repo carrying the framework, `satellite` for one that only holds its own
   material and points at another. If in doubt write `router`. Commit and push.

6. REPORT, once, in my language, in under twenty lines: the rescue branch name and
   link; how many files were applied and how many set aside, with the set-aside names;
   what check-fleet and kit-news actually said; anything the freshness check found; and
   anything you deliberately did not do. No options, no questions I have to answer for
   you to finish — you have already finished.

Three things only are a hard stop, and for each, do the thing next to it rather than
writing to me: unpushed commits nobody can account for (leave them, say so, continue);
a merge conflict inside a file kit-sync did not set aside (set it aside too, say so,
continue); this repo's origin pointing at pyduan/agentic-organization instead of my
own repo (stop entirely and say so — pushing would put my content in someone else's
repo).
```
