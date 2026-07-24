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

| Repo | What it holds | Who has access |
|---|---|---|
| **this one** (`<your-repo>`) | your source of truth, the site, the decks, the apps | you |
| _(add rows as you grow)_ | e.g. a separate client/project repo the `new-project` skill created; a private repo for sensitive material | who you grant it to |

Default: it's just this one repo, and the map is trivial. It matters once a task reaches **across**
repos (a shared org repo plus a client's own repo), or when some material lives in a **restricted**
repo only some people can open — then list them here so the AI clones and pulls the right ones and
never assumes access it doesn't have.

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
