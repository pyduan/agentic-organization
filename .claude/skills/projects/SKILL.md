---
name: projects
description: "Track the organization's real work (a client engagement, a grant, a product launch, a partnership) across its whole lifecycle: charter, decisions log, dropped documents, next steps, and a cross-project status view. Use when the owner says 'start tracking project X', 'where do we stand on X / across projects', 'log this decision on X', 'here are files for X', or asks what to do next on a piece of work. Not for 'a different site or brand' — that's the new-project skill (separate repo decision)."
---

# Projects

The organization's work, followed from idea to done, in the same repo as everything else. A
*project* here is something the organization drives in the world: a client engagement, a grant, a
launch, a partnership. (Someone asking for "a new site for another client" wants the `new-project`
skill instead; when the wording is ambiguous, ask which they mean before creating anything.)

The point is the same as the rest of the kit: the AI you talk to about a project keeps its memory
in files, so the tenth conversation about it starts from everything the first nine established,
on any machine, in any session.

## First use

If `projects/` doesn't exist yet, create it with this README (and mention the module is now
active):

```markdown
# Projects

One folder per piece of work the organization drives. Created and maintained by the `projects`
skill; humans welcome to read and edit everything. `playbook.md` collects what we learn about
running projects well; each project folder holds its charter, its dated log, its next steps, and
its dropped files.
```

## One folder per project

```
projects/
├── playbook.md            lessons on running projects well, per stage (grows over time)
└── <slug>/
    ├── charter.md         why this exists, who it serves, what winning looks like,
    │                      current stage, key people and links
    ├── log.md             dated decisions and progress, append-only
    ├── next-steps.md      the living TODO for this project
    └── files/             documents dropped for this project, kept verbatim
```

The lifecycle, kept deliberately simple: **idea → exploring → active → winding down → done**.
The current stage lives in `charter.md` and changes by a dated line, so the history of the
project's life stays readable. If the organization has richer stages (a sales pipeline, a grant
cycle), rename the stages in `playbook.md` once and use those.

## What each request does

- **"Start tracking X"**: interview briefly (what is it, who is it for, what does winning look
  like, what stage is it at), then create the folder with a real `charter.md`, an empty dated
  `log.md`, and a first `next-steps.md`. If `source/objectives.md` exists, say which objective
  this project advances; a project that advances none is worth a gentle flag, not a refusal.
- **"Here are files for X"** (or files in the inbox that belong to a project): file them under
  `projects/<slug>/files/` verbatim, extract what changes the picture (a date, a budget, a
  decision) into `charter.md` or `log.md`, and say what you filed where. Never leave project
  documents in the inbox, a chat, or a deck folder.
- **"Log this on X" / anything decided in conversation**: a dated entry in `log.md` (the what
  and the why), and `next-steps.md` updated to match.
- **"Where do we stand on X?"**: answer from the files, then verify they still match reality
  with the owner and fold in corrections.
- **"Where do we stand across projects?"**: a short status view: per active project, its stage,
  the last log entry, and the top next step; flag projects untouched for over a month (stale or
  done?) and, if `source/objectives.md` exists, order by contribution to the objectives.
- **A deck, page, or post about a project**: build it with the normal format playbooks, but pull
  the facts from the project's folder, and write anything new you learn back into it. The
  project folder is the memory; the deck is a derivative.

## Rules

- **Never invent project facts.** Everything in a charter or log traces to the owner's words or
  a filed document; mark what's unconfirmed.
- **Log decisions when they happen**, in the same session, with the why. A log that's
  reconstructed later is fiction.
- **Close the loop on "done"**: when a project ends, a final log entry says how it ended and
  what it taught us, and the reusable lesson goes to `projects/playbook.md` (that file is why
  the second project runs better than the first).
- **Sensitive projects**: if a project must not be in this repo (it may be shared, published, or
  read by contributors who shouldn't see it), say so and follow `ORGANIGRAM.md`: a restricted
  repo, listed there, is the honest answer; a half-hidden folder is not.
