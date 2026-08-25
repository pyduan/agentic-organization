# Organigram — your organization's repos, and who may do what

The map of your agentic organization: **which repos it spans**, and **who may use, change, and
approve what**. Start as simple as it really is (usually: one repo, just you), and fill this in as
you grow — a second contributor, a separate client repo, a teammate who owns one area. The AI reads
this to know **what to clone and pull** and **whose sign-off a change needs**. You (the owner) are
the only one who changes this file.

## Repos in this organization

Everything the AI might need lives in one of these. **Clone the ones a task needs, side by side, and
`git pull` each at the start of a session** (a stale clone ships an out-of-date brand or a wrong
fact). Access is per your own accounts — never anyone else's login.

One row per repo. The first two columns are read by `node scripts/check-workspace.mjs`, so keep
the repo slug and the local folder in backticks; the rest is prose for you and the AI.

| Repo | Local folder | What it holds | Access | Publishes to |
|---|---|---|---|---|
| `<owner>/<repo>` **(this one, the org repo)** | `~/Projects/<repo>` | your source of truth, the site, the decks, the apps, the private dashboard | you | `<your-domain>` |
| _(add a row per repo as you grow)_ | `~/Projects/<other>` | a project repo the `new-project` skill created; a private repo for sensitive material | who you grant it to | its own URL, or nothing |

Default: it's just this one repo, and the map is trivial. It matters once a task reaches **across**
repos (a shared org repo plus a client's own repo), or when some material lives in a **restricted**
repo only some people can open — then list them here so the AI clones and pulls the right ones and
never assumes access it doesn't have.

Deciding whether a second repo is warranted at all is a separate question, and the wrong split is
expensive months later: see [`docs/one-repo-or-several.md`](docs/one-repo-or-several.md).

### One map, and pointers back to it

Once you have more than one repo, the same information wants to live in several places, and that is
exactly how a map starts lying: a repo gains a remote, a project is renamed, a folder is deleted, and
the other copies keep describing last month. So the kit deliberately keeps **one** map:

- **This table is the only list of repos.** Nothing else enumerates them. Not a second file, not a
  per-repo manifest, not a paragraph in another guide.
- **Every other repo carries a pointer, never a copy.** Each project repo's `CLAUDE.md` opens with a
  short *Where this repo sits* block: which organization it belongs to, which repo holds the shared
  guides and this map, and the one or two siblings it actually reads from or writes to. A pointer
  cannot drift out of sync with the map, because it does not restate it.
- **A change of shape updates the map in the same commit** as the thing that changed: a new repo, a
  new remote, a project that went live, an area that became restricted.
- **Then check it, rather than trust it:**

  ```sh
  node scripts/check-workspace.mjs
  ```

  It reads this table, then looks at the disk and at what `git remote -v` actually says, and reports
  the disagreements: a repo listed but not cloned, a folder whose remote is not the one declared, a
  kit project sitting next to the others but absent from the table, a project repo whose `CLAUDE.md`
  has no pointer home, a published URL that no longer answers, and an `origin` still pointing at the
  template (the one mistake that pushes your content into someone else's repo). Run it with the
  `freshness` sweep.

### Signposting: a rule lives where the work happens

Two rules that only bite once the organization spans repos, both learned the hard way:

- **A rule that governs work done in another repo has to be written in that repo's guide too**, in
  the same change. The session doing that work opens *that* repo's `CLAUDE.md` and nothing else, so a
  rule recorded only here does not exist for it.
- **When you do mirror something, mirror the whole operational path, not its headline** — the folder
  to write in, the command to run, the file to create if it is missing. A mirrored rule that names a
  path which does not exist in the target repo is worse than no rule at all, because the reader
  follows it.

**Naming and layout, once there's more than one project.** Put real projects in a **GitHub
organization, not a personal account**, and name the primary repo **`<org>/website`** (e.g.
`bopa/website`), so sub-projects can join later as `bopa/appX` without renaming anything. Whether
several projects share one repo (folders), one org (separate repos), or separate orgs is a spectrum
decided by how much documentation they share and which inherits from which — the `new-project` skill
runs that decision, and `docs/how-it-works.md` ▸ "Several projects" explains it for humans.

## Who may do what — the three rights

- **Use** — ask for something, run a workflow. **Default: you.** As people join, anyone you bring in
  can ask; nothing here gates who requests.
- **Modify** — change a guide, a fact, a page. **Default: you, directly on `main`.** With a second
  regular contributor, changes become branches + pull requests (see the "When you grow" note in the
  README).
- **Approve & merge** — sign off what goes live. **Default: you.** When you have contributors, you
  (or a named owner per area) review their PRs before they publish.

Solo, all three collapse into "you, on `main`" — that's the default and it's fine. This section is
simply where you write the rules down **once** as the team grows: who may change which guide, who
approves each area, what stays yours alone. Keep it honest and minimal; don't invent structure you
don't have yet.

Two files are special whatever the team looks like: `source/objectives.md` (the north star) stays
the owner's alone to change, and the `team/` folder (the team module's people data) is local-only
and belongs to nobody's review, not even the owner's reviewers.

## Your responsibility chart, made executable

As the organization grows, this file converges with your actual org chart: the repo map mirrors
how responsibility is divided (a shared org repo, a repo per client team, a restricted repo for
what only some may see), and the three rights mirror who owns each area. That's deliberate. "Code
is law" applied to an organization means the responsibility chart isn't a diagram people try to
remember; it's **enforced by construction**: repo access decides who can even read an area,
write access decides who can propose, merge rights decide whose sign-off publishes, and the
guides' inheritance (org-wide voice → area guides → personal voice) mirrors who answers to whom.
When responsibilities move, move the access and the rows here in the same change; when the two
disagree, one of them is lying, and it's usually this file.

## The rule for the AI

1. **Identify** who's asking (by a stable identifier, not a display name) when more than one person
   uses this.
2. **Pull** every repo the task touches at the start; if a needed repo isn't cloned or the person
   lacks access, say so and stop rather than improvise around it.
3. **Route** the change by the rights above: the owner (or the area's named owner) may commit and
   merge; anyone else lands a pull request for the owner to review. Governance — this file and the
   rules in `CLAUDE.md` — is the owner's alone to change.
4. **Check pending work against today's guides before merging it.** A branch can be up to date with
   `main` and still miss a rule that landed after it was written, with no git conflict to warn you.
   Fix that on top of their commit, so their authorship survives, and say what you changed. If the
   gap is big enough to redo their work, let them choose. Then delete the merged local branch.
