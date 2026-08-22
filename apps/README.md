# Apps

Web apps that belong to this project: one self-contained folder per app (`apps/<slug>/`), built
per the playbook in [`source/formats/webapp.md`](../source/formats/webapp.md) — that file decides
what counts as an app vs. a page, the default stack, the data rules, and how each app publishes.

**Where an app publishes is decided by who it is for, not by what it does.** Three paths, in the
playbook's publishing table:

| The app is for | It publishes to |
|---|---|
| visitors, as part of the site | `site/public/apps/<slug>/`, shipped with the site |
| visitors, on its own URL | its own Cloudflare Pages project on this repo, root directory `apps/<slug>` |
| **the owner alone, or named people** — anything personal, financial, client-related, or unreleased | the organization's **protected Worker** (the `toolbox` repo in [`ORGANIGRAM.md`](../ORGANIGRAM.md)), behind Cloudflare Access |

A private app never gets a public Pages project "with a URL nobody knows". That is not a lock, and
the playbook says why. The toolbox mounts the app from this folder at deploy time; the app stays
here, in this repo, as its source of truth. Declare the choice once in this repo's
`.agentic/manifest.json` (`publish.apps`), so the next session doesn't have to ask.

The boundary that matters: an app in here shares this project's brand, voice, and facts. Something
for a **different** project or brand is a **new repo from the template**, not a folder here — the
`new-project` skill (`.claude/skills/new-project/SKILL.md`) makes that call.

This folder starts empty; the first app creates `apps/<slug>/`.
