---
name: freshness-sweep
description: Monthly reconciliation — is what this project published still there, and is what it says about the world still true?
---

**Who runs it:** the owner of this project, whoever that is — this routine binds no personal
account and reads nothing outside the repos already on the machine. If you are setting it up for
someone else's project, it is theirs to run, not yours.

Monthly freshness sweep for this project. Run it locally: several of these checks read private
repos and the local disk, which a remote runner cannot reach.

This is the one question no build and no test suite asks. A test proves the code does what it
says. This asks whether the sentences are still true, which is a different failure: nobody touched
the text, the world moved, and it lies now (`docs/failure-modes.md` §4).

## The checks

```bash
cd <this project> && npm run check
```

That runs the freshness sweep, the workspace map check, the fleet check and the pack check. Then,
separately, the memory check:

```bash
node scripts/check-memory.mjs
```

Read each one's output rather than its exit code alone: several of them report findings and still
exit zero, because a dead link is information, not a crash.

## What each finding means

- **A dead link or a host that stopped answering.** Fix it or remove it. A link the owner published
  and that now 404s costs them credibility with whoever clicked it.
- **A `mustNotServe` failure is an incident, not drift.** It means something private is being served
  publicly. Stop the sweep and deal with that first.
- **The workspace map disagreeing with the disk** (`check-workspace`): a repo listed and not cloned,
  a remote that is not the one declared, an `origin` still pointing at the template. That last one
  pushes this project's content into someone else's repo, so treat it as urgent.
- **An instance behind the kit, or not wired** (`check-fleet`): say so to the owner and offer the
  `update-kit` skill. An instance that is not wired will never announce an update to its own owner,
  so it only gets one by being told.
- **A memory asserting something no longer true** (`check-memory`): a `✗` is a dead fact — correct
  it and keep a trace of what it claimed, because a correction with no trace gets lost. A `▲` is a
  judgement call. A memory that is *wrong* costs more than a memory that is missing, so delete it
  rather than leaving it; a memory that is merely old is not wrong.

## Rules

- **Deduce a confirmation from a result, never write it beside the command.** If you did not read
  the output, say you did not read it.
- **Never correct a fact in one area with a fact from another.** Separate lives, separate repos: an
  alert whose two halves come from different worlds is unreadable.
- **Delete a memory only when it is false**, not when it is simply old.
- **Commit what you fix, in the repos concerned, naming the files.** Memories live outside the repo
  and are not committed.

## The report

Short, in the owner's language, in plain words. What was dead and is now fixed, what still needs
their decision and why, and what you dated. **If a check could not run, name it and say why** rather
than passing over it: a sweep that silently skipped half its checks reads exactly like a clean one.
