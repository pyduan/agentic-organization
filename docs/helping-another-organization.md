# Installing the kit at another organization

You run the kit, and another organization asks you to set them up: a partner, a nonprofit you
advise, a client. This is what installing it well looks like, distilled from several such
installations. The kit itself is written for an owner; this page is for whoever helps one.

**The principle under every step: they own everything.** Their GitHub organization, their accounts,
their repository, their intranet. You keep nothing of theirs, and what their installation teaches
you goes back into the kit the same day, with their name taken out.

## Why a workshop and a repository, rather than training or a prompt library

- **Training people to prompt leaves them where they were.** Each person goes back to an empty chat,
  pastes the context again, and the organization learns nothing at its own scale. A repository holds
  the context, so nobody pastes it, and a correction made once becomes a rule every later session
  reads.
- **A prompt library is a copy.** An improvement stays where it was made. A recipe in a repository is
  run on the organization's own files, and an improvement is a commit everyone gets.
- **The second person does not repeat the setup.** They clone and connect, because the repository
  already carries the rules, the structure and the history.
- **The organization's commitments become the agent's rules.** A published AI policy, a data
  protection line, a review step: written where the agent reads them, they are applied on every
  request instead of remembered.

## Before the day

A workshop stalls on accounts and phones, never on the agent. Everything here exists so the session
is spent installing, structuring and running a first real task.

1. **Track it from the day it is promised**, with where the promise came from. An installation that
   exists only in a call transcript is one nobody follows up.
2. **Read what they already have**: their site (for the leads of a first use case, never to guess
   their processes), their GitHub organization if any (`gh api orgs/<org>`), their DNS (`dig NS` and
   `dig MX`: a zone already on Cloudflare and a Google mail change the intranet's steps), their own
   AI policy, and your own history with them.
3. **Seed their repository** if you can (`docs/seeding.md`): their public facts with sources, their
   published tools verbatim, their workflows as the repository's own recipes, the history-takeover
   table. The workshop then confirms instead of starting from an empty brief.
4. **Send the list with the date, and check it the day before**:
   - a GitHub organization of theirs and an account per person coming. If their organization is
     open source with outside contributors, recommend a dedicated private one for operations: a
     private repository there is read by every member at the default base permission. They decide;
   - a hosting account in the organization's name, with two administrators, one of them present;
   - an AI plan sized by role: whoever runs the setup takes a large seat before the day, since the
     setup is the heaviest session there will be;
   - who receives the second factor of each shared account the first task needs, reachable during
     the session;
   - the material of the first task, in bulk, on the disk, unsorted;
   - the person who owns the first task, in the room;
   - the parent folder, decided once for everyone: `~/Projects/<organization>/` on every machine,
     so a path one person gives works as is for the next.
5. **Write their guide before the day** as a to-do they tick, each step with its advice and the
   mistake it prevents. A step that comes before their agent exists gives a settings path, never a
   prompt to paste.

## The day

1. **Record with their own meeting tool**, and say why: the transcript is the input of the guide you
   write afterwards.
2. **Install with the kit's own paste** (`QUICKSTART.md` ▸ *Install, in one paste*), or, for a
   repository you seeded, with the three prompts below, which keep its order. Never a variant of
   your own: they will update from the kit, so the kit is what they must have run.
3. **The settings, with them**: the Code tab, not the chat; the same parent folder everywhere; the
   microphone allowed for dictation; confirmations on for the first sessions, auto mode after.
4. **The stack and the connectors, then their intranet**, the setup skill's first two steps:
   `STACK.md` and `CONNECTORS.md` walked row by row with the person who decides, each row approved
   or changed with the date and their handle, then the intranet built and published behind Access
   with their addresses. The rest of the day's
   work appears there, and its banner is what they reread once you have left.
5. **Connect what the first task needs, and only what `CONNECTORS.md` approved**, for the scope its
   row says: a history import limited to one person, a date range or a folder, then disconnected.
   A mail connector takes one account per login: a shared mailbox goes on the machine that
   automates, a person's own mail through the browser. If they use Claude on a Team or Enterprise
   account, have the account's owner turn the approved connectors on by default for everyone first
   (`CONNECTORS.md` ▸ *Default connectors*): the next installs then only need each person to sign in. For the day to day, set up the agents'
   inbox that people copy in, rather than mailbox-wide access.
6. **The owner of the task says it to the agent**, end to end, with its exceptions. When they start
   explaining it to you, stop and turn them to the session: retold, it loses the exceptions. If a
   tracking table or a script already does part of it, give it to the agent so the new tool takes
   over its logic.
7. **While the import and the structure run**, show what the system does elsewhere from public
   material. Nothing from your own repositories, nothing from another organization.
8. **Before leaving**: every private page behind Access with their addresses
   (`scripts/protect-access.mjs`), the intranet's tool cards pointing at what was built, a session
   long enough that nobody types a code every morning, and the address opened once from a browser
   where nobody is signed in. A code screen is the right
   answer; a page is an incident.

## The prompts for a seeded repository

Three blocks, pasted in the order below in a Code session (never the chat). They say the same thing
as the kit's install paste, in the same order (the stack and the connectors, then the intranet,
then the seed confirmed, then the first task as a recipe), for a repository that already exists
because you seeded it. Replace what is between angle brackets; keep the rest.

**1. Taking over the repository**, by the person who runs the setup, once the transfer is done:

> Our organization's repository already exists: `<org>/<repo>`, seeded before today from what we
> publish, and now ours. Check what is on my machine (git, Node 22.12 or later, the GitHub CLI,
> Claude Code, whether I am logged into GitHub), install what is missing one step at a time,
> explaining each step and checking it worked, and log me into GitHub with
> `gh auth login --git-protocol ssh --web`. Clone the repository into `~/Projects`, run
> `node ~/Projects/<repo>/scripts/install-workspace.mjs` and
> `node ~/Projects/<repo>/scripts/check-conflicts.mjs`, and park what is safe to park. Then tell
> me to open a new Code session on `~/Projects` and say "set up my organization". That setup
> walks `STACK.md` and `CONNECTORS.md` with me one row at a time and records each yes with the
> date, publishes our intranet behind a sign-in with the addresses I give, and then confirms every
> line of `source/seed.md` with me rather than taking any of it as decided.

**2. The first task**, said by the person who owns it, once the intranet is up and the seed confirmed:

> Here is a task I do by hand: <the task, end to end, with its exceptions>. Run it once with me on
> real material. Use only the connectors `CONNECTORS.md` approves, for the scope their rows give;
> if it needs another, add its row as *to decide* and ask me. Build it as a recipe the repository
> keeps (a skill, its files, and its result on our intranet), not as a one-off answer. Show me what
> you extracted before you write anything, put every correction I make into the recipe before you
> finish, and tell me what the next run will look like. If `source/seed.md` drafted this task,
> start from that draft.

**3. The second person, and everyone after**: the block in `QUICKSTART.md` ▸ *The second person,
and everyone after*, with the repository's name filled in. It is the same for a seeded repository,
because by then the repository carries everything the first session settled.

## A prompt written for one person

Past the first setup, each newcomer gets a prompt written for their role: an assistant, a student,
a partner's team member. A few rules hold for every one of them.

- **Check their access before you hand it over.** List the repositories the prompt names, and check
  each one: is the person a collaborator, or is an invitation pending? Only the owner of a personal
  repository can invite, so a write access is not enough to add someone. If an access is still
  pending, install in two steps (`--tools-only` now, `--join` once it arrives), and write the
  prompt so it skips a missing repository and says so rather than stopping.
- **Ask whose mailbox it is before setting its rules.** The person who owns a mailbox decides who
  may send from it. An assistant's own address is not their principal's.
- **Write every send rule with its limits.** By default the agent drafts and the person sends. An
  exception names who it may write to and about what, says what never goes in, and leaves a dated
  trace where both sides read it. It is recorded in `CONNECTORS.md`.
- **Credentials never pass through the agent.** The person types a password into their own keychain.
  A password that went through a chat or a message must be changed.
- **Write the role's recurring jobs as recipes to build.** List them (for an assistant: their
  principal's fees, notes and decks in their principal's voice, how their principal ranks contacts
  and projects, the calendar). Each recipe is learned from sources, and what is inferred is marked
  for the principal to confirm. When a request says "how I do it", settle whose method it is before
  you write it.
- **Hand over one consolidated prompt.** After each correction, send the whole prompt again with
  the correction folded in, never a section to swap in by hand.

## When the repositories become everyone's source of truth

Once a team works in the repositories daily, the risk changes: each person's view drifts from the
others', because one imported last week and another never did. Learned on a government cabinet of a
dozen people, in this order:

1. **Leadership decides, in writing.** A head of the organization (a chief of staff, a director)
   decides that the repositories are the source of truth and that a few routines run for everyone.
   The decision is a file in the shared repository: who, when, which routines, which writes go
   without a per-batch yes, and why. The install prompts and each person's setup page cite it, so
   nobody wonders why something runs without asking (`routines/README.md` ▸ *Offered, never
   installed on its own*).
2. **The default routines install themselves** at the first session after an update: a morning
   import of the person's mail and files, read-only, and a short briefing each person mails to
   themselves (their priority work, what to unblock first, the countdown to the next deadline and
   the link to the steering page). Both run in auto mode, within limits the hooks enforce when
   nobody is attending: sources read-only, mail only to oneself, nothing pushed to a restricted
   repository.
3. **Each person's backfill starts on its own, once.** The template below, filled from what the
   repositories already know about the person (their unit's repository, their restricted one if
   any, their priority subjects), runs as far as it can alone and keeps its state on the machine, so
   it resumes rather than restarts. Under the policy, writes to the shared repositories go out with
   a trace (who, when, which sources and period) and flags on anomalies and inferred values;
   restricted repositories, anomalies and what no rule settles wait for the person's yes in the
   chat, grouped with the push.
4. **The daily routine takes over** from the backfill.

In the kit: the policy is `source/organization-policy.json` (example beside it), the routines are
`routines/morning-import` and `routines/self-briefing`, the backfill is `.claude/skills/backfill`, and
the session-start sync installs and resumes them through `lib/local-migrations.mjs`. A suggestion's
route and mail come from `scripts/suggestion.mjs`; the tab badges from `apps/dashboard/badges.js`. The
per-unit home is an instance's own view (`apps/intranet-extend/`), since the kit does not know an
organization's units.

**Local settings migrate themselves.** A pull updates what git tracks, never a machine's own
`*.local.json`. So the sync that runs at every session start also runs small migrations, each with
an id recorded once applied, that add a missing key and never overwrite the person's value. That is
how a new rule (an internal mail domain, a new routine) reaches machines already installed without
anyone at them. What a migration cannot settle (a machine whose clone cannot fast-forward) goes on
the steering page, with a manual procedure as the fallback.

**Internal mail is a setup parameter.** The send hook takes the organization's own domain: a message
to an internal address leaves after the person rereads it, or without on their express request; a
message outside always waits.

**Each unit's head shapes their own home.** The intranet home is a visual dashboard per person or
unit (what matters to them, the steering of their activities, their alerts, their most used apps),
held as a small config in the repository and changed by asking their agent. The invitation to
personalise comes as a prompt in their next session, not as a mail.

**Alerts stay rare; news gets a badge.** An alert means very late and very important (on the critical
path and past a set delay), nothing else; assignments, reminders and completed watches are
notifications. Each tab carries a count of what is new for this person since their last visit,
cleared when opened, absent at zero.

**A suggestion to a unit one cannot write to becomes a pull request, doubled by a plain mail.** The
person's agent pushes when they have write access; otherwise it opens a pull request from a fork,
or an issue labelled *suggestion* when the organization does not allow forking private repositories,
or a comment on the intranet. Each one comes with a mail to the unit's head, in plain words: what is
suggested, what triggered it, what it changes, and one link to accept it. The person rereads and
sends it.

**The backfill template** (`.claude/skills/backfill/SKILL.md` holds it with its method), angle
brackets filled from the repositories:

> Do my backfill: I want the repositories to become the source of truth for my work, instead of my
> files and my exchanges. Sources, read-only: my mailbox (received and sent) and my Drive since
> <start date>, then on this machine the folders <paths>, the most important first. Check first that
> this scope is approved in `CONNECTORS.md`; otherwise propose the row. My subjects first:
> <priority subjects>; count the noise and skip it. Extract the latest real data, the history (who,
> what, when, with its source), the templates of the documents I produce (emptied of names and
> amounts) and the rules my files apply, in the formats the repository already describes. What the
> whole organization may read goes to <shared repositories>; <confidential subject> only to
> <restricted repository>, checked private first; personal data nowhere; what no rule settles to my
> list to decide. Stage in a gitignored `local/` folder, attach each line to what exists rather than
> creating a duplicate, check your totals against my files, list anomalies without fixing them,
> and say "to confirm" for anything inferred. Leave a trace in each repository touched (who, when,
> scope). Push the shared repositories as <the policy> says, and show me the rest batch by batch
> before pushing. Send no message and change nothing in the mailbox or the Drive. At the end, tell
> me in a few lines what went where, what waits for me, and what I still need to fill in.

## After the day, the same day

1. **The guide for their next person**, written from the transcript read in full: what is installed,
   what the workshop taught, the next steps with names, the joining prompt. Attribute actions by
   what was said, not by whose account was on the call: a borrowed laptop puts every action under
   the wrong name.
2. **The kit learns, without them.** Every method the day surfaced goes into the kit (its quick
   start, its troubleshooting, its changelog) with no name, no client and no figure of theirs.
3. **A document you made for them is an example, never a cadence you promise.** Showing a weekly
   report you drafted once commits them to nothing, and the guide says so.
