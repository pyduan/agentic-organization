# How this works

The mental model behind the kit, for humans. The AI's version of this is `CLAUDE.md` at the repo root.

## One source of truth, many derivatives

Everything that defines your presence lives in `source/` as plain files you could read in any text editor: your texts and facts (`content/`), how you write (`brand/voice.md`), how you look (`brand/design.md` and `tokens.css`), and how each output format is built (`formats/`). The website and the decks are derivatives: rebuilt from those sources, never the other way around.

This is why the system stays coherent as it grows. Change the accent color once in `tokens.css` and the site and every future deck follow. Ban a buzzword once in `voice.md` and it never comes back.

## The AI is the operator, the repo is its manual

`CLAUDE.md` tells the AI, for every kind of task, exactly which guide to read first. You never need to say "remember, we don't use exclamation points": the voice guide says it, the AI reads the voice guide before writing, so it applies. When you give feedback in a session, the AI folds it into the right guide before it signs off, so the correction sticks for every future session, on any machine.

## Git, invisibly

Git gives the system its memory: every change to every file, forever, with the reason attached. You don't operate it; the AI pulls at the start of each session, commits and pushes at the end of each change. Two things follow that are worth knowing:

- Nothing is ever lost. "Put the gallery back how it was in June" is a valid request.
- Pushing is publishing. Cloudflare Pages watches the repo and rebuilds the live site on every push, in about a minute.

## Trust boundaries

The AI publishes routine changes on its own; that's the point. It's instructed to pause and ask for anything destructive, any visible redesign, and anything touching money, accounts, or credentials. Secrets never go in the repo.

## When the project outgrows solo mode

The kit is tuned for one owner (with the AI doing the work). When a second regular contributor joins, the sane next step is the one bigger organizations use: contributors work on branches, changes become pull requests, one person merges. Ask the AI to set that up; the switch is one conversation. The same escalation exists for content (from data files to a real CMS) and for features (forms, shops); start simple, upgrade when reality asks for it.

## Governance is part of the setup, in plain terms

Running an organization from a repo raises the same questions any shared system does, and git happens to have precise answers. In plain terms:

- **Who owns the vault** — the GitHub and Cloudflare accounts belong to the owner, never to a helper or vendor. That's the whole point of owning your source of truth.
- **Who can look** — read access: they can see everything, change nothing.
- **Who can propose** — write access: they (or their AI session) can push branches and open pull requests, but nothing they do goes live.
- **Who publishes** — merge rights: whoever can merge to `main` publishes, because pushing is publishing. Solo mode collapses all of this into one person; team mode separates proposing from publishing.

The setup interview asks these questions in exactly these terms and records the answers in `source/brief.md` ▸ Governance. Scope rights to the actual use case, not to trust in the abstract: a helper who only edits copy needs write, not admin; a reviewer needs merge, not admin; almost nobody needs admin. Revisit the section whenever someone new joins.

## Lineage

The rules in these guides are distilled from real projects: a multi-contributor organization site with a design system and a deck engine (where the guide-routing and reflection habits come from), an artist's gallery and shop updated weekly through an inbox folder (the inbox protocol and the publish-without-being-asked rule), a brand built from source documents before any website existed (brand kit first, derivatives after), and small personal sites (the bias for fewer moving parts).
