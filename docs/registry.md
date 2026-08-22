# The workspace registry — how your repos find each other

An organization outgrows one repo quickly: the org repo, a project repo the `new-project` skill
created, a private repo for sensitive material, a toolbox that ties them together.
[`ORGANIGRAM.md`](../ORGANIGRAM.md) already lists them **for a human and for the AI reading it**.
This file adds the other half: a tiny file each repo carries so a **program** can find it, know
what it is, and know what it may read — without opening the repo's content.

Both exist on purpose. `ORGANIGRAM.md` is the prose the AI reads at the start of a session;
`.agentic/manifest.json` is what a script reads when it walks the workspace. When they disagree,
one of them is lying, and the check at the bottom of this file tells you which.

## The manifest

One file per repo, at `.agentic/manifest.json`. It is short, hand-written, and committed.

```json
{
  "manifest_version": 1,
  "slug": "acme-site",
  "name": "Acme",
  "kind": "project",
  "sensitivity": "open",
  "summary": "One line: what this repo is for.",
  "repo": {
    "path": "~/projects/acme-site",
    "remote": "git@github.com:owner/acme-site.git",
    "visibility": "private"
  },
  "publish": {
    "site": "https://acme.example",
    "apps": "pages"
  },
  "expose": {
    "level": "full",
    "todos": ["projects/relaunch/next-steps.md"],
    "note": ""
  },
  "updated": "2026-08-22"
}
```

| Field | What it decides |
|---|---|
| `slug` | the stable identifier every other repo and tool uses. Never rename it casually. |
| `kind` | `org` (the source-of-truth repo) · `project` · `toolbox` (hosts private apps) · `area` (a folder that isn't a repo) |
| `sensitivity` | `open` or `confidential`. A confidential repo's material never lands in a public artifact — a page, a deck, a published app, a commit in a public repo. |
| `repo.visibility` | `public` · `private` · `local-only` (no remote at all). Write what is **true today**, not what was true when the folder was created. |
| `publish.site` | the live URL, or `null` if this repo publishes no site. |
| `publish.apps` | where apps from this repo go: `pages` (public Cloudflare Pages), `private-worker` (the org's protected Worker — see `source/formats/webapp.md`), or `none` (local only). |
| `expose.level` | what a tool in another repo may pull automatically. |
| `upstream_template` | optional, for a repo made from a template: the template owner's GitHub name. The check below fails loudly while `origin` still points there, which is the one mistake that publishes your content to someone else's repo. |
| `expose.todos` | the markdown files the repo's open items live in (typically `projects/<slug>/next-steps.md`). |

### `expose.level` — the consent field

This is the field that matters, and it is deliberately conservative:

- **`full`** — another tool may read the declared files and copy their content (todo titles, dates)
  into its own store. Right for open repos.
- **`pointers`** — a tool may know the repo **exists**, its name, its sensitivity, and how many open
  items it has. Nothing else moves. Right for a confidential repo: you get the count on your
  dashboard without the wording of a clause travelling anywhere.
- **`none`** — nothing is read. The repo is listed and left alone.

### `expose.todos` — pointing at items that already exist

The default is the checkbox convention: every `- [ ] something` line in the listed files is an open
item, `- [x]` a done one. That is what `projects/<slug>/next-steps.md` already looks like.

A file written before any of this existed should not be reformatted to suit a script, so an entry
can also be an object:

```json
"todos": [
  "projects/relaunch/next-steps.md",
  { "path": "source/dossier/questions-conseils.md", "match": "list", "until": "## Settled" }
]
```

`match: "list"` counts plain numbered or bulleted items instead of checkboxes, and `until` cuts the
file at a heading — typically the "settled" or "done" section, whose items would otherwise be
counted as open forever. Prefer checkboxes for anything new; use this for what already exists.

Default to `pointers` for anything marked confidential, and change it only as a deliberate,
dated entry in `source/decisions.md`. A sync that quietly starts copying sentences out of a private
repo is exactly the kind of thing nobody notices until it is somewhere it shouldn't be.

## Who writes it

- **`setup`** writes the manifest for a new repo, from the same answers that fill `ORGANIGRAM.md`.
- **`new-project`** writes it for every repo or area it creates, in the same step that adds the
  `ORGANIGRAM.md` row. A repo without a manifest is invisible to every tool in the workspace.
- **Any session that changes what is true** — the repo got a remote, the site went live, an area
  became confidential — updates the manifest and the `ORGANIGRAM.md` row **in the same commit**.

## Who reads it

Anything that needs the shape of the workspace rather than the content of one repo:

- a toolbox that shows todos across projects (that is what `publish.apps: "private-worker"` exists
  for — see `source/formats/webapp.md`);
- a session in repo A that needs to know repo B exists, is confidential, and is not its to read;
- a health sweep (the `freshness` skill) checking that the map still matches the disk.

The reading rule for you, the AI: **the manifest tells you what a repo is; it never authorizes you
to read its content.** `expose` is a ceiling for automated tools, not a permission slip. Content
still comes from cloning the repo and the person having access to it.

## Keeping it honest

The map rots silently. A repo gets a remote and the row still says local-only; a project is renamed;
a folder is deleted and the toolbox still counts it. So check it, don't trust it:

```bash
node scripts/check-registry.mjs
```

It walks the workspace, reads every manifest, and reports the disagreements: a manifest with no
`ORGANIGRAM.md` row, a row with no manifest, a `visibility` that contradicts `git remote -v`, a
declared `expose.todos` file that doesn't exist, a `publish.site` that no longer answers. Run it
with the `freshness` sweep.

**This is not hypothetical.** The workspace this came out of had a repo described as "local-only,
no remote, never published" in `ORGANIGRAM.md` — true when it was written, and still sitting there
weeks after the repo was given a private GitHub remote. Nothing was wrong on either side; the two
facts simply stopped matching, and only a check that reads both would have said so.
