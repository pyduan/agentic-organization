# Changelog

What changed in the kit, newest first. `update-kit` reads this file to tell the owner what an
upgrade actually brings them, so **write for the owner, not for the developer**: what they can now
do, and what they must do about it, in plain language.

One entry per release. Mark it `MAJOR` when it changes something they will notice or must act on —
a new app, a new file format, a rule that changes how their agent behaves. Everything else is
`MINOR` and gets one line.

---

## 2026-08-26 · MAJOR · Post an update on a to-do, from your phone

You can now write on a task, not just tick it. The update is dated, signed with whoever is logged
in, and lands in the markdown file next to the task — so it reaches whoever reads the repo next,
including your agent.

This is what makes the app worth opening when you are not at a computer. Ticking a box says
something ended; it loses why, and why is usually what you needed later. "Found her on rue de
l'Arbre Sec, poster no longer needed" is worth more in six months than a checked box.

## 2026-08-26 · MINOR · Internal apps have a default now

Anything behind your access gate — an intranet page, a dashboard, a tool for you and a couple of
named people — is built with the same stack from the start, rather than hand-rolled and rewritten
six weeks later. Public pages keep the old judgement call, where plain and static is very often the
right answer.

## 2026-08-26 · MINOR · Upgrades stop hiding, and stop freezing your fixes

Four things a live project ran into on the first real upgrade, all fixed.

**A customisation you made no longer freezes a fix we make later.** When an upgrade sets a file
aside because you had edited it, it now remembers. Every later check tells you when the kit has
changed one of those files, so you decide — instead of never hearing about it again.

**"0 projects found" now says why.** It used to print a bare zero, which reads as "there is nothing
here" when it usually means "I could not read your map". It now names the rows it read and what
each one was missing.

**The upgrade instructions no longer loop.** They told you to run a script that a project older
than the mechanism does not have yet. They now fetch it first.

**A repo that publishes nothing can no longer be deployed by accident.** The placeholder deployment
name is deliberately invalid, so a stray command fails loudly instead of quietly going somewhere.

## 2026-08-26 · MAJOR · To-dos you can tick from your phone

**What it is.** Your `next-steps.md` files become a small web app: tick a box, set a due date,
drag an item to reorder. Every change is a commit on the markdown file, so the list an agent reads
in a terminal and the list you tap on your phone are the same list. No database.

It handles several projects at once, in several repositories, in one app.

**What you must do.** Nothing, unless you want the app. Setting it up needs a GitHub token and a
deploy, which your agent can do for you — ask it to set up the to-dos app.

**What changed in your files.** To-dos now have a standard shape, with an owner, a due date and a
small identifier at the end of the line:

```
- [ ] Chase the printer @sam due:2026-09 #brochure ^k3f9
```

Old lines still work. The identifier is what lets the app change the right line, so **it must never
be edited by hand**, and your agent now knows to patch these files rather than rewrite them.

Due dates keep the precision you chose: a day, a week, or just a month. "Some time in September"
stays that, instead of pretending to a date and then nagging you on the 2nd.

## 2026-08-26 · MINOR · Upgrades no longer overwrite your own work silently

The kit now records which version you last upgraded from, so an upgrade can tell the difference
between "the kit changed this file" and "you changed this file". When both changed, it stops and
shows you, instead of quietly replacing yours.

## 2026-08-26 · MINOR · Your agent argues with you less

Two new rules. A decision written down is treated as settled: your agent should not reopen it, nor
re-add a hedge to a fact you confirmed. And it now has a list of AI writing tics to strip before
anything is published.
