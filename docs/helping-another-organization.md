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
   automates, a person's own mail through the browser. For the day to day, set up the agents'
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

## After the day, the same day

1. **The guide for their next person**, written from the transcript read in full: what is installed,
   what the workshop taught, the next steps with names, the joining prompt. Attribute actions by
   what was said, not by whose account was on the call: a borrowed laptop puts every action under
   the wrong name.
2. **The kit learns, without them.** Every method the day surfaced goes into the kit (its quick
   start, its troubleshooting, its changelog) with no name, no client and no figure of theirs.
3. **A document you made for them is an example, never a cadence you promise.** Showing a weekly
   report you drafted once commits them to nothing, and the guide says so.
