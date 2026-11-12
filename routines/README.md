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

**The one exception is a written policy from the organization's leadership.** When the repositories
are meant to be the source of truth for everyone, a head of the organization can decide that a few
routines run for every person, so that nobody's view drifts: a morning import of their mail and
files, a briefing they mail to themselves. The decision is a file in the shared repository (who
decided, the date, which routines, why), cited by the install prompts and by each person's setup
page, so each person can see why it runs without asking them. The policy never widens what a
routine may do. Its limits stay written in the routine and enforced by the hooks when nobody is
attending: sources read-only, mail only to oneself, nothing pushed to a restricted repository and
no personal data anywhere without the person's yes in a session they attend.

The policy is `source/organization-policy.json` ▸ `policy` (an example: `source/organization-policy.example.json`).
At each session start, `scripts/workspace-sync.mjs` records on the machine what the policy names and
tells the agent what to install, in an attended session only (`lib/local-migrations.mjs`). Install each
scheduled task with `CLAUDE_CODE_SESSION_ATTENDED=0` in its environment, so the send guard refuses
rather than asks; without it the guard asks, which stalls the run rather than letting anything
through. Read the first run's report to see which happened.

## A routine is thin. The method lives in its recipe.

**A routine carries five things and nothing else:**

1. **Who runs it** — a named person, or a named service account. Whoever it is today, written down.
2. **How often** it runs.
3. **Which identity** it runs as — whose account, whose credentials, whose authorization.
4. **Where** it reads and writes: the repos, the folders, the mailbox.
5. **Which guide to follow**, named, in order.

**Everything else belongs to the guide it points at**: the method, the screening criteria, the
output format, the filters, the judgement. A routine that explains *how* to do the work has
absorbed a guide, and now there are two copies of the method that will disagree by next month.

**The test, and it is the whole point:** you must be able to follow the guide by hand, without the
routine, and get the same work. And you must be able to change the method without touching a
schedule. If either fails, the routine is too fat — move the substance into the guide and leave the
routine with the cron, the identity, the paths and the pointer.

This is what lets the method be iterated on its own, invoked manually when someone asks for it
today rather than next month, and reused by a second routine at a different cadence.

## Who runs it, and what to ask someone else

**Every routine names who runs it**, as a person or a service account, as it stands today. Not a
role, not "the team": a name. It is the first line of the file, and it is what lets anyone ask "who
would notice if this stopped?" and get an answer.

**If the person considering it is not that person, do not install it as it stands. Ask them:**

> This routine is written for <name> and shaped around their accounts, their repos and their
> working week. Do you want your own copy, personalised to yours — or did you mean to run theirs?

A yes means a **new routine**, named for them, carrying their identity and their paths, pointing at
the same guide. Not a second installation of someone else's.

The reason is the second field. A routine binds an identity, and installing someone else's unchanged
means running their assumptions with your credentials. That is precisely how a sweep scoped to one
mailbox ends up reading another: nothing announced whose routine it was, so nobody asked whether it
was theirs to run.

Two cases where the answer is genuinely "run theirs, unchanged":

- It runs as a **service account** rather than a person, and they are taking over hosting it.
- It is a **kit routine** with no identity baked in, like the freshness sweep, where "who runs it"
  is just whoever owns the project.

Both are worth saying out loud rather than assuming.

## Not every recurring thing is a schedule

A guide can be triggered three ways, and only one of them is a routine:

- **By the clock** — that is a routine, and it lives here.
- **By someone asking** — no routine at all; the guide is enough.
- **By an event**: a person joins, a client signs, a project opens. Also no routine. The trigger
  belongs in the guide's own first lines ("run this when a new teammate joins"), because a calendar
  cannot know when it happened.

**A task that happens once per person, per client or per project is not a one-off.** It recurs; only
its trigger is an event rather than a date. Onboarding is the type case — setting up access,
importing someone's history, walking them through the first session — and it earns a proper guide
for the same reason anything recurring does: the second time, nobody remembers what the first time
involved.

## What belongs here, and what does not

**Here:** work that would serve anyone running this kit, with no account, credential or personal
authorization baked in. The freshness sweep is the type case — every instance benefits, and it only
reads.

**Not here:**

- Anything tied to one person's accounts, mailboxes or standing authorizations. That belongs in
  their own repo, versioned privately.
- Anything specific to one organization's repos and vocabulary. That belongs in *that* organization's
  shared repo, next to the guides it follows.

**The rule that settles where a routine lives: it goes with the work it serves, unless it is bound
to one person's credentials or authorization — then it goes with that person.** A sweep that reads
one human's mailbox lives in that human's repo even when everything it writes is company work,
because the day they leave, the routine leaves with them. A routine running as a *service* account
is not personal: nobody's departure breaks it, so it lives with the work.

The test is the pack test (`source/formats/pack.md`): if you cannot hand it to a stranger running
this kit and have it make sense, it is not a kit routine.

## A routine that fails quietly

A scheduled job that fails stays silent unless something makes it loud. The shapes to watch:

- **A job whose only output is a pull request** fails by producing no pull request, which looks
  exactly like a quiet week. Give it a run log or a line in a report that says it ran.
- **A degraded success is worse than a failure**: a run that skipped half its sources and said "done"
  is trusted. Make the run count what it read and say what it skipped. A run whose source has been
  moved or archived stops at its start and names what is missing (`docs/failure-modes.md` ▸ *A field
  another tool parses is an interface*).
- **The scheduler's "succeeded" means the session ended**, not that the work was done: five weekly
  sends were missed, four of them marked successful. A check of its own reads the artefact (the
  message in the sent folder, the file and its date) after the scheduled time, and says so when it
  is missing.
- **An alert goes where someone looks, and announces the return to normal once.** One written to a
  file nobody opens is not an alert; one that repeats "still fine" every run stops being read.
- **A routine writes where someone merges from.** A cloud run starts on a branch of its own, and one
  that commits its work there delivers nothing: thirty such branches piled up over six weeks, filing
  the same notes again each morning, while `main` kept facts the owner had corrected. A routine
  pushes to `main`, or its output names the branch it stopped on.
- **On an unprotected `main`, red is advisory**: it blocks nothing, so somebody has to look, and
  after a push that is the session that pushed. Read the run for your commit, and fix a red cause in
  the same session, never by loosening or skipping the check; most owners never open the CI page, so
  a red they have to notice is a red nobody fixes. Before fixing a red `main` you did not cause,
  check the open pull requests and the other sessions: someone may already be on it, and two fixes
  collide.

## Retiring one

**Deregister it and delete its file in the same change.** Removing the folder does not deregister the
task, and deregistering leaves the file on disk — each half alone leaves something that looks live.
If the file is worth keeping for its history, cap it with a hard stop at the top saying it is retired
and what replaced it, so anything that reads it stops at the first line.

## The catalogue

| Routine | Cadence | What it does |
|---|---|---|
| [`morning-import`](morning-import/SKILL.md) | every working morning | What arrived in the person's own mailbox and files goes into the repositories, read-only on the sources, by the backfill's method. |
| [`self-briefing`](self-briefing/SKILL.md) | every working morning | Each person mails themselves their day: priority work, what to unblock first, the countdown to the next deadline. |
| [`freshness-sweep`](freshness-sweep/SKILL.md) | monthly | Is what we published still there, and is what we wrote about it still true? Dead links, a repo that went private, an instance drifting behind the kit, memories asserting things that stopped being so. |
