# Routines — the scheduled work, versioned

A **routine** is a scheduled task: a prompt the owner's machine runs on a cron, with nobody watching.
Skills answer "how do I do X when asked"; routines answer "what happens on its own, every month".

## Why they live here and not only in the scheduler

The scheduler keeps its tasks in `~/.claude/scheduled-tasks/`, which is **not a git repo**. A routine
that exists only there:

- does not survive the loss of a machine,
- cannot be handed to anyone else, and
- can rot without a trace. One real case: a routine was retired in favour of a better one, its
  playbook was updated correctly, and its instruction file stayed on disk for two months still
  asserting "there is no connector for this" and driving a browser at a hardcoded account. Something
  invoked it and it read the wrong person's mailbox. A superseded guide is a stale sentence; a
  superseded *automation* is a stale sentence something can still execute.

So the shareable ones are versioned here, and installing one is a deliberate act.

## Offered, never installed on its own

**Setup lists what is available and installs nothing without a yes.** A routine writes a cron entry
on someone's machine and then acts while they are not looking, which is a side effect on their
computer rather than a file in their repo. Say what it would do and how often, then wait. This is the
same rule as an update: never applied silently.

## What belongs here, and what does not

**Here:** work that would serve anyone running this kit, with no account, credential or personal
authorization baked in. The freshness sweep is the type case — every instance benefits, and it only
reads.

**Not here:**

- Anything tied to one person's accounts, mailboxes or standing authorizations. That belongs in
  their own repo, versioned privately.
- Anything specific to one organization's repos and vocabulary. That belongs in *that* organization's
  shared repo, next to the recipes it follows.

The test is the pack test (`source/formats/pack.md`): if you cannot hand it to a stranger running
this kit and have it make sense, it is not a kit routine.

## Retiring one

**Deregister it and delete its file in the same change.** Removing the folder does not deregister the
task, and deregistering leaves the file on disk — each half alone leaves something that looks live.
If the file is worth keeping for its history, cap it with a hard stop at the top saying it is retired
and what replaced it, so anything that reads it stops at the first line.

## The catalogue

| Routine | Cadence | What it does |
|---|---|---|
| [`freshness-sweep`](freshness-sweep/SKILL.md) | monthly | Is what we published still there, and is what we wrote about it still true? Dead links, a repo that went private, an instance drifting behind the kit, memories asserting things that stopped being so. |
