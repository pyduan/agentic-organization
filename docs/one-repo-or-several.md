# One repo, or several?

Every workspace eventually asks this: keep everything in one repo with the site as a folder, or
split into a router repo plus a constellation of thin ones. The answer is not a matter of taste,
and the wrong split is expensive in a way that only shows up months later.

## Default to one repo

Start with one, and stay there far longer than feels natural. A single repo means one clone, one
history, one map, one set of tooling, and a task that touches two subjects is just a task. Folders
are free; repos are not.

What a split actually costs, and none of it is visible on the day you do it:

- **A second map to keep true.** Each repo asserts something about the others, and the day one
  changes, the copies keep describing last month. Nothing fails when they disagree.
- **Cross-subject work needs access.** A task spanning two repos needs both cloned and both
  permitted. A session that has one of them silently does half the job.
- **Tooling has to walk repos instead of directories.** Every script that used to glob a folder now
  resolves a map, handles a missing clone, and reports partial results.
- **Onboarding multiplies.** A new person clones N repos, and forgets the Nth.

## The one hard reason to split: different readers

**A repo is a permission boundary.** That is the only thing it does that a folder cannot. So the
question is never "are these different subjects" — it is:

> Is there anyone who should see one of these and not the other?

If no: one repo, two folders. If yes: two repos, and the split follows the *readers*, not the
subjects. This is why an organization ends up with a public router and private repos per domain,
rather than one repo per team or per tool.

## The one soft reason: a public surface

A repo that **serves something to the internet** should not also hold private material, even when
every human reader is the same person.

The failure mode is not a permissions mistake, it is a configuration one: a static host set to
serve the repository root instead of `public/`, and suddenly the playbooks, the notes and the
personal files are readable by anyone who guesses a filename. That has happened, to this kit's own
author, on his own site — which is why `wrangler.jsonc` names a folder and why nothing outside it
is served.

So: publishing repo on one side, private material on the other, even when they are "the same
project". The blast radius of a config error is the whole repo.

## Reasons that feel compelling and are not

- **"It's getting big."** Size is a folder problem. Split for readers, not for line count.
- **"These are different topics."** Topics are folders. A dashboard organised by repo instead of by
  subject is the classic symptom of having split on this reason.
- **"Different release cadence."** One repo can publish several things from several folders.
- **"It might be handed over one day."** Split when the handover is real. Extracting a folder into
  a repo later is an afternoon; maintaining two repos for a year is not.

## If you do split: the star, and its rules

The shape that works is a **router** plus **thin** repos. Not a mesh, not peers.

**The router holds the method. The thin repos hold the instances.** Recipes, brand, formats, the
map, the scripts — those live in the router, because they are what everyone should read. Data about
a specific funder, client or matter lives in the restricted repo. Getting this backwards, with
methods scattered across the leaves, is what makes a constellation unmaintainable.

Five rules, each of which exists because breaking it caused a real problem:

1. **One assertion, one place.** The map says who owns what. A signpost says *when to route there*
   and *what lives there* — and links for the rest. A signpost that also restates the owner becomes
   a second source of truth that nothing checks.
2. **Derive, never re-declare.** Anything a tool needs about the topology is computed from the map,
   not configured beside it. A hand-kept list of repos and paths is wrong within a fortnight.
3. **A thin repo never copies code from the router.** If it needs the code, the router gets the
   script that reads the thin repo's data. Copies drift, and there is no mechanism to notice.
4. **The router is a signpost for what it may not hold.** When the router is public and a leaf is
   private, each signpost states the boundary explicitly — the methodology is answerable freely, an
   instance requires the private repo — so a session knows what it may say without opening anything.
5. **Whatever is copied, record what it was copied from.** A template distributed to many projects
   is a copy, and the only way an upgrade can tell "the template changed this" from "the owner
   changed this" is a recorded baseline. See `.kit-sync` and `scripts/kit-sync.mjs`.

**Tell the tools which repo is which, in `ORGANIGRAM.md`'s `Kind` column: `router` or `satellite`.**
Otherwise they infer it, and one of them used to infer it badly. `check-fleet` counted every repo
whose `CLAUDE.md` named the kit as a full instance and told the owner each one was missing the
framework's furniture. On an organization built as a star that is a demand to install eleven copies
of a framework that exists once, and it produced a permanent red list nobody could clear without
breaking rule 3 above. An owner refused it, and she was right: she had followed this page, and the
tool was arguing with it. It now asks of a satellite only what a satellite can have, and it says out
loud when it is guessing rather than reading the column (2026-08-31).

## Three questions, in order

1. **Is there a reader who should see one and not the other?** Yes → separate repos.
2. **Does one of them serve a public surface?** Yes → keep the private material out of it.
3. **Would splitting mean the same fact lives in two places?** Yes → you are splitting along the
   wrong line. Move the fact first, then reconsider.

If all three are no, it is one repo with folders, and it will stay that way longer than you expect.
