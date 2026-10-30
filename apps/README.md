# Apps

Web apps that belong to this project: one self-contained folder per app (`apps/<slug>/`), built
per the playbook in [`source/formats/webapp.md`](../source/formats/webapp.md) — that file decides
what counts as an app vs. a page, the default stack, the data rules, and how each app publishes
(bundled under the site, or as its own Cloudflare Worker on this same repo).

The boundary that matters: an app in here shares this project's brand, voice, and facts. Something
for a **different** project or brand is a **new repo from the template**, not a folder here — the
`new-project` skill (`.claude/skills/new-project/SKILL.md`) makes that call.

Two apps ship with the kit. `apps/dashboard/` is the **intranet**, the private home page the setup
publishes first (`source/formats/dashboard.md`); `apps/todos/` is the to-do app. `apps/packs/` is
the packs catalogue, a page the intranet serves at `packs/`. Each app you add gets a line in
`source/content/intranet-tools.md`, which makes it a card on the intranet's home page.
