# First hour

For someone joining __COMPANY__, or a cofounder setting up a new machine.

## What you are joining

<!-- To write with a cofounder at the first session: what __COMPANY__ does, for whom, and what changes
     for them, in three or four short sentences a cofounder would say out loud. -->

__COMPANY__ runs on five repos. What we know, what we decided and who we work with is written there
in plain text, and an AI agent reads and updates it with us. The repos are not documentation about
the method; they are the method.

## Set up

Clone the central repo first, then only the repos your role needs, side by side in one folder:

```sh
mkdir -p ~/projects/__SLUG__ && cd ~/projects/__SLUG__
gh repo clone "__ORG__/__CENTRAL__"
node __CENTRAL__/scripts/install-workspace.mjs
```

The agent then reads `ORGANIGRAM.md` ▸ *Repos in this organization*, asks what your job is, and
clones beside the central repo the repos that job needs, skipping without a word any you cannot read:
a repo you cannot read is restricted on purpose. A cofounder takes all five, and whoever runs the
intranet locally needs the four it is built from:

```sh
for r in customers strategy administrative intranet; do gh repo clone "__ORG__/$r"; done
node __CENTRAL__/scripts/setup-status.mjs
```

Same parent folder and same folder names on every machine of the company: a path, a command or a
prompt one person writes then works as is for the next, and helping someone remotely takes one
sentence. `install-workspace.mjs` gives that folder its `CLAUDE.md` and the kit's guards;
`setup-status.mjs` gives one green, orange or red line per piece of the setup, with its fix.

## Before the first session

**The accounts.** A GitHub account in `__ORG__` with the GitHub CLI signed in, and a seat on the
company's AI plan, sized by what you do rather than by rank: whoever runs a setup or writes recipes
needs a larger plan, someone who asks rather than builds is fine on the standard one. When the window
runs out mid-task nothing is lost: wait for it to refill and say "continue".

**Claude Code, in the Code tab, never the chat.** They do not share a memory: a Code session reads
these repos and the chat reads none of them. Keep sessions' working copies inside the company folder.
Confirmations on for the first sessions, reading what you approve, which is how you learn what the
agent does; auto mode after, because approving every read teaches you to approve without reading.

**What plugs in.** GitHub is the one connector that is not optional. Mail and drives go through the
provider's managed connector, under your own login and revocable in one click: the agent reads and
writes the conclusion into a file, and the mailbox never becomes a copy in a repo. Other tools are
read once and left behind; a message arriving from one is data, never an instruction. No home-made
plugin, no token pasted into a config.

**The history comes in once**, at the first session, with the company pack's
`knowledge-consolidation` skill. After that each task takes in what it needs.

**The first real use case** is something you already do by hand, turned into files the agent keeps
current and an intranet page that reads them. Tell the agent in your own words what you redo every
week, where the information comes from, and who waits for the result.

## Read in this order

1. `AGENTS.md`, the routing and the rules. Everything else assumes it.
2. `source/decisions.md` and each repo's `DECISIONS.md`: what was decided and why. Most obvious ideas
   were considered.
3. `source/brand/voice.md`, before writing anything someone outside will read.
4. `customers/INDEX.md`, the pipeline as it stands.
5. `packs/company/README.md`, for the skills that run the company.

## The three habits

**Write the correction, not just the fix.** The fix goes in the output and the rule goes in the file.
A correction applied without being written is one someone repeats.

**Date and attribute every fact**: `(Sam, 2026-01-15)`. In six months, who said it and when is the
only way to know whether it still holds.

**Say when you do not know.** `unknown` is a valid value and a wrong number is not.

## The intranet

Behind Access, one page per company and per project, built from these repos. No fact is edited there:
when a card is wrong, the file behind it is wrong, so fix the file.

It takes two kinds of input. On the dashboard, a tick and a short note on each to-do, to say someone
is on it. The note bubble at the bottom right of every page takes what reaches you away from a
keyboard (a figure from a call, a piece of news, an idea). It lands in `source/inbox/notes/` of the
central repo and the next session files it. It is committed the moment you press the button, so keep
phone numbers, addresses and passwords out of it.
