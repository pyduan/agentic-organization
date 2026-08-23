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
- **Structure that turned out wrong**: a folder nobody used, material that kept landing in the wrong
  place, a unit that fights how the owner thinks. Fix the layout and say so in `source/decisions.md`;
  a structure decided once at setup is a hypothesis like any other.
- **Leftovers**: unprocessed inbox files, unpushed work, a `<!-- verify -->` fact that got confirmed.

- **Misses, not just lessons**: anything that went wrong this session and cost something (a wrong
  conclusion travelled, the owner lost time, data was touched, a deliverable had to be redone) gets
  an entry in `source/quality/incidents.json` per the `feedback` skill. The rule you just wrote says
  what to do next time; the incident says what happened, who caught it, and whether anything now
  prevents it. Without the second, there is no way to tell whether the first is working — and it is
  what the framework's maintainer needs to fix the default that allowed it.

A rule only exists where it will be read: if it governs work done in another repo (one the
`new-project` skill created), write it in that repo's guide too, in the same change — and mirror the
whole operational path, not its headline, verifying that the path you write actually exists over
there.

Then:

1. Make the edits. Small and surgical; don't rewrite guides wholesale.
2. Commit and push everything (per the publish skill).
3. Tell the owner, transparently and briefly, what you saved: "I noted in your voice guide that you prefer X, and updated the brief with Y." If the session produced nothing new, say nothing about reflection and just make sure everything is pushed.
