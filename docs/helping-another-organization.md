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
   tools as a pack, the history-takeover table. The workshop then confirms instead of starting from
   an empty brief.
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
2. **Install with the kit's own paste** (`QUICKSTART.md`), or with a setup prompt that adapts it,
   never a variant of your own: they will update from the kit, so the kit is what they must have run.
3. **The settings, with them**: the Code tab, not the chat; the same parent folder everywhere; the
   microphone allowed for dictation; confirmations on for the first sessions, auto mode after.
4. **Connect the mailbox the first task needs.** A mail connector takes one account per login: a
   shared mailbox goes on the machine that automates, a person's own mail through the browser.
5. **The owner of the task says it to the agent**, end to end, with its exceptions. When they start
   explaining it to you, stop and turn them to the session: retold, it loses the exceptions. If a
   tracking table or a script already does part of it, give it to the agent so the new tool takes
   over its logic.
6. **While the import and the structure run**, show what the system does elsewhere from public
   material. Nothing from your own repositories, nothing from another organization.
7. **Before leaving**: their private pages behind Access with their addresses
   (`scripts/protect-access.mjs`), a session long enough that nobody types a code every morning, and
   the address opened once from a browser where nobody is signed in. A code screen is the right
   answer; a page is an incident.

## After the day, the same day

1. **The guide for their next person**, written from the transcript read in full: what is installed,
   what the workshop taught, the next steps with names, the joining prompt. Attribute actions by
   what was said, not by whose account was on the call: a borrowed laptop puts every action under
   the wrong name.
2. **The kit learns, without them.** Every method the day surfaced goes into the kit (its quick
   start, its troubleshooting, its changelog) with no name, no client and no figure of theirs.
3. **A document you made for them is an example, never a cadence you promise.** Showing a weekly
   report you drafted once commits them to nothing, and the guide says so.
