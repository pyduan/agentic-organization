# The to-do format

Every open item in this workspace is one line in a `next-steps.md`, in one shape. The dashboard
counts them, the to-do app edits them, and agents read and write them — three readers, so the shape
is a contract rather than a habit.

Parsing and patching live in [`lib/todo.mjs`](../../lib/todo.mjs); its tests are
`scripts/test-todo.mjs`. Nothing should re-implement the regex.

## The line

```markdown
- [ ] Chase the printer for the brochure proof @sam due:2026-08-29 #brochure ^k3f9
```

Fixed field order, everything optional except the checkbox and the text:

| Part | Form | Rule |
|---|---|---|
| checkbox | `- [ ]` / `- [x]` | Valid GFM, so it renders as a checkbox on GitHub and in any editor |
| text | plain prose | The **action**, not its status. Short enough to read as a row |
| owner | `@slug` | Repeatable. Never `[Nom]`: brackets collide with the checkbox |
| due | `due:2026-09-15`, `due:2026-W36`, `due:2026-09` | ISO only, at the precision that was actually decided. Never `08-22`, never "next week" as words |
| done | `done:YYYY-MM-DD` | On completed items |
| tag | `#slug` | Repeatable, optional |
| id | `^k3f9` | Generated once, **never written or changed by hand** |
| update | `      YYYY-MM-DD @who · text` | An indented, dated line. Append-only, see below |

Context that is not the action goes on indented continuation lines. They travel with the item and
never become its title:

```markdown
- [ ] Chase the printer for the brochure proof @sam due:2026-08-29 ^k3f9
      Third time asking. They have had the files since the 12th.
```

### A due date carries its own precision

Most things are not due on a day. They are due *this month*, or *some time next week*, and forcing
that into `due:2026-09-15` invents a decision nobody made — then shows the item as late on the 16th
for no reason. So the field holds whatever precision was actually chosen:

| Written | Means | Late from |
|---|---|---|
| `due:2026-09-15` | that day | 16 September |
| `due:2026-W36` | that ISO week | the Monday after |
| `due:2026-09` | that month | 1 October |
| *(absent)* | no date, which is the default and stays the default | never |

It is still one field, it still sorts lexically, and `dueEnd()` in `lib/todo.mjs` closes the period
so `isOverdue()` only fires once the whole period has passed. **No date is the normal state.** An
item without one is not incomplete; a date is a commitment and most items have not earned one.

### Updates: how information gets back in

A continuation line that opens with an ISO date is an **update**, not context:

```markdown
- [ ] Imprimer l'affiche et la poser dans les commerces @paul due:2026-08-30 #shah ^foy3
      Les commerces valent mieux que les poteaux : l'affiche y reste des semaines.
      2026-08-26 @paul · Shah a été retrouvée rue de l'Arbre Sec. Affiche inutile.
```

The distinction is the point. **Context describes the task and is rewritten freely. An update is
something that happened, and is append-only** — a new one goes after the last line of the item's own
block, never displacing what was there, never landing under the next item.

**Why the app needs this at all.** Ticking a box records that something ended and loses *why*, which
is usually the part worth keeping. "Found her on rue de l'Arbre Sec, poster no longer needed" is
worth more six months later than a checked box, and it is the only way information travels back into
the repo from a phone. Without it, the app is a remote control; with it, it is a capture surface.

**The author is the authenticated identity, never what the client sends.** The Worker overwrites the
`by` field with the Access email before applying, because anything else lets a browser sign someone
else's name.

Lines without a leading date stay context, so every file written before this parses unchanged.

### Handing an item to an agent

Each item can produce a one-line prompt to paste into an agent session:

```
Start on ^k3f9 in projects/brochure/next-steps.md: Chase the printer for the brochure proof (due 2026-09)
```

**Short on purpose.** Whoever pastes this is talking to an agent that already has the repo, the
playbooks and this file. Restating the context spends its attention and buries the only two things
it does not already know: which item, and where it lives. The id is in there so the agent can patch
the right line when it is done.

Completed items keep their place in the file. They are not moved to a "Done" section: the dashboard
counts them for progress, and the surrounding lines are the context that makes them readable later.

## A bare line stays legal

```markdown
- [ ] Call the printer
```

This parses, and it must keep parsing. The day the format demands five fields is the day people
stop writing to-dos in it and start keeping them somewhere else. Fields are added by whoever needs
them, when they need them. An app backfills the `^id` on first write.

## There is no priority field, on purpose

An earlier draft had `p:1..3`. It was removed: it put a control on every row and a decision on
every item, while a due date already says what is urgent. Where ordering matters beyond that, the
order of the lines in the file *is* the priority — which is what the reorder handle manipulates,
and it needs no field at all.

Old lines carrying `p:1` still parse; the token stays part of the text instead of becoming a field.
Nothing breaks and nothing is silently dropped.

## Why `^id` carries the weight

Everything else is ergonomics. The id is what lets a tool change a file without guessing: **line
numbers move on every edit above them, ids do not.** A write that says "toggle line 14" is a bug
waiting for the next commit; "toggle `^k3f9`" is correct forever, including after someone reorders
the list from their phone.

It is Obsidian's block-reference syntax, so it is not invented here. The tradeoff, stated plainly:
GitHub renders it literally as a small `^k3f9` at the end of the line. The alternatives are worse —
an HTML comment is noisier in the source, and a sidecar file breaks the property that one item is
one line.

Ids come from `idFrom()`, over an alphabet with no `l`, `i`, `o`, `0` or `1`, so nobody has to
squint at one.

## The rule that binds agents

**`next-steps.md` is patched, never regenerated.**

An agent asked to update a to-do list will, left alone, rewrite the whole file — that is the normal
reflex, and it is the one thing that breaks everything downstream. Regenerating reformats lines
nobody asked to touch, and it churns or drops ids, which dangles every anchor the app holds.

So:

- Change the lines you were asked to change. Leave the rest byte-identical.
- Preserve every `^id` exactly. Add one to a genuinely new item; never invent one for an existing
  item, never renumber, never "tidy" them.
- Use `lib/todo.mjs` when you are writing code. Its `apply()` takes an intent (`toggle ^k3f9`) and
  rewrites exactly one line.

## Concurrency

Writes are compare-and-swap, not merges. An editor sends the version it read; if the file moved
since, the write is refused and the intent is re-applied to the newer version — which works
precisely because the anchor is an id and not a position.

**Git must never merge this file.** A conflict writes `<<<<<<<` markers into it: valid text, invalid
data. The parser reads them, the dashboard renders them, and nothing complains. So the goal is to
make file-level conflicts impossible, not to resolve them well. A `.gitattributes` union strategy is
worse still, because it "resolves" by keeping both sides, which for a to-do list means silently
duplicating items.

The one operation that genuinely loses a write is **two people reordering the same list at once**.
Toggles and field edits are per-line and commute; an ordering is a property of the whole run and
does not. Last write wins, and the previous order is one commit back. That is accepted rather than
solved.

Between agent *sessions* it is ordinary git divergence, resolved the ordinary way. The rule that
prevents most of it sits upstream of any merge UI: pull before you write, commit narrowly, push
immediately. An agent that reads a file, thinks for ten minutes and writes it back is working from
a stale copy.

## One app, several projects

Most workspaces are several repos, and the temptation is one app per repo. Don't: the owner opens
this to see what they have to do, not to remember which repository holds what. The same rule the
dashboard follows applies here — **organise by subject, never by repo.**

**And you do not write that list by hand.** `npm run todos:sources` walks the repos on
`ORGANIGRAM.md`, finds every `projects/<slug>/next-steps.md` plus any root one, resolves each repo's
GitHub name from its own remote, and writes `apps/todos/sources.json`. The deploy script regenerates
it, so adding a project means adding a project, not remembering to update an app.

That is deliberate and it is the kit's rule, not a preference: **there is one map of the workspace,
`ORGANIGRAM.md`**, and the dashboard already reads it rather than keeping a second list. Whatever
topology you actually have — one repo holding several projects, several repos holding one each, an
annex repo beside a common one — it is already a row on that map. A second list would describe last
month within a fortnight.

The generated shape, which you would only write by hand as a `TODO_SOURCES` override:

```jsonc
"TODO_SOURCES": [
  { "id": "brochure", "label": "Brochure", "repo": "owner/repo",       "path": "projects/brochure/next-steps.md" },
  { "id": "site",     "label": "Site",     "repo": "owner/other-repo", "path": "projects/site/next-steps.md" }
]
```

Four rules keep this coherent as it grows:

- **One entry per project, not per repository.** A repo holding three projects contributes three
  entries; a project split across two repos still appears once, wherever its `next-steps.md` lives.
- **The label names the project.** "Brochure", not `owner/repo ▸ projects/brochure/next-steps.md`.
  Which repo a project sits in is plumbing, and it belongs nowhere near the picker.
- **The client names a source, never a path.** The browser sends `id`, the Worker resolves it
  against this list. The allow-list therefore works by *resolution* rather than by comparison, and a
  path the owner never configured cannot be expressed at all — no traversal, no prefix trick. The
  repo and path travel back out so a hand-off prompt can name a real file; they are never read off
  a request.
- **The commit message names the project.** `todos (Brochure): 2 ticked`. It lands in the history of
  a repo that may hold several of them, and "2 ticked" alone says nothing a month later.

The order of the list is the order in the picker, so put what gets touched daily at the top.

One token has to reach every repo in the list. That is the practical argument for a fine-grained
token scoped to *all repositories* with Contents only, rather than a per-repo one — see below.

## The token the app writes with

The Worker needs a GitHub token, and there are two ways to give it one. Neither is wrong; they
trade a setup step against a failure mode.

**A fine-grained personal access token** is the tidy answer. Pick the repositories it covers — *all
repositories* is legitimate when every repo in the workspace has a `next-steps.md` — and grant only
**Contents: read and write**. That is deliberately narrower than it sounds: a classic `repo` scope
also carries webhooks, deploy keys, releases and `workflow`, none of which an app that edits
markdown has any use for. It has to be created in a browser, because **GitHub has no API for
minting a personal access token** — by design, so that a token cannot mint another one.

**A token piped from the `gh` CLI** is the answer when the setup step is the obstacle:

```bash
gh auth token | npx wrangler secret put GITHUB_TOKEN
```

Nobody sees the value: it goes from one local process to another, so it never reaches a terminal, a
shell history, or an agent's context. The cost is that the Worker holds a *snapshot* of a token
owned by a different tool. Re-authenticating `gh` gives the CLI a new token and leaves the Worker
with the old one, and the symptom is asymmetric — the agent in the terminal keeps working while the
app on the phone quietly starts failing.

That asymmetry is the whole reason `docs/troubleshooting.md` carries an entry for it. **If you set
it up this way, write down that you did**, in the project's own notes, or the eventual 401 is
undiagnosable by whoever meets it.

## The note bubble: capture that is not a to-do edit

The app also carries a floating ✎ bubble, and it exists because of what people actually type from a
phone. Most of it is not a to-do edit: a number heard in a call, a piece of news, an idea, a
correction. Forcing that through a to-do line mislabels it, and asking the person to wait for a
keyboard mostly kills it.

The bubble takes anything, as it comes, and `POST /api/notes` commits it — one file per note, dated,
signed with the verified identity — into `source/inbox/notes/` of the **notes target**: by default
the first configured source's repo, or `NOTES_TARGET` in vars (`{ "repo": "…", "dir": "…",
"branch": "…" }`) the moment the workspace has several repos and the default stops being obvious.
From there the **inbox protocol** takes over, unchanged: the agent's next pass reads the note, files
it where it belongs (a fact into the fact file, a task into the list, news into the journal), and
leaves the inbox empty. The bubble is a capture surface, not a second place where truth lives.

## Examples in this file are invented

Every to-do above is fictional — a printer, a brochure, `@sam`. That is a rule, not a coincidence:
**this template is public, and it must never carry data from a real project someone is also working
on.** When you write an example here, invent it. Do not paste a line out of the repo you happen to
have open, even if it looks harmless — a name, a client, an internal project code and a supplier's
situation are all real information about real people, and a public template is the worst possible
place for them.

## Migrating what exists

Old lines still parse — `- [ ] [Sam] Chase the printer (due week of Aug 17)` yields that whole
string as the text, with no owner and no date. Nothing breaks; it simply carries no fields.

Convert opportunistically, when you are already editing an item, rather than in one sweep that
touches every file and collides with everyone. `ensureIds()` backfills ids deterministically when a
file is first opened by a tool.
