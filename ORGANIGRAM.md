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

## The rule for the AI

1. **Identify** who's asking (by a stable identifier, not a display name) when more than one person
   uses this.
2. **Pull** every repo the task touches at the start; if a needed repo isn't cloned or the person
   lacks access, say so and stop rather than improvise around it.
3. **Route** the change by the rights above: the owner (or the area's named owner) may commit and
   merge; anyone else lands a pull request for the owner to review. Governance — this file and the
   rules in `CLAUDE.md` — is the owner's alone to change.
