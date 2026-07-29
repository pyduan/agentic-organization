---
name: reflect
description: "End-of-session reflection: fold new preferences, corrections, and facts from this session into the guides, prune stale rules, then commit and push. Run before ending any session in which something was learned or changed; the Stop hook enforces it."
---

# Reflect

The step that makes feedback permanent. Review the session and update the source of truth, so the next session (any machine, any AI) starts smarter.

Scan the conversation for:

- **Taste and corrections**: anything the owner corrected, praised, or rejected about words → `source/brand/voice.md`; about looks → `source/brand/design.md` (and `tokens.css` if values changed); about how a format is built → the relevant `source/formats/*.md`. Write rules the way the guides do: short, concrete, with an example when the correction came from a real one.
- **New facts**: about the owner, the project, priorities, decisions taken → `source/brief.md` (update the sections, append dated one-liners to history).
- **Stale rules**: anything in the guides this session contradicted or made obsolete. Prune it; guides must stay lean and current or they rot.
- **Solved problems**: an install, git, or hosting snag that got diagnosed this session → an entry in `docs/troubleshooting.md` (what you see, what it means, what to do), so the next person finds the fix instead of asking a human.
- **Leftovers**: unprocessed inbox files, unpushed work, a `<!-- verify -->` fact that got confirmed.

## Where a rule has to land

A rule only exists where it will actually be read.

- **Write it where the work happens.** If the rule governs something built in another repo (a
  separate project repo the `new-project` skill created, an app with its own folder and its own
  notes), it has to land in *that* repo's guide too, in the same change. A session that starts inside
  that repo reads its files and nothing else, so a rule left only here is invisible to it.
- **Prefer a check over a paragraph** wherever the rule is machine-checkable: a script, a build step,
  a hook. One more sentence in a guide is the weakest form of enforcement; the guide should carry the
  *why* and the check should carry the *must*.
- **Keep duplicated rules in sync in one change**, and name the copies in each so the next session
  knows where they all are.

Then:

1. Make the edits. Small and surgical; don't rewrite guides wholesale.
2. Commit and push everything (per the publish skill).
3. Tell the owner, transparently and briefly, what you saved: "I noted in your voice guide that you prefer X, and updated the brief with Y." If the session produced nothing new, say nothing about reflection and just make sure everything is pushed.
