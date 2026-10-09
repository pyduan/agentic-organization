# Quick start

One page, for someone who is about to sit down for the setup hour. The detailed version is
[SETUP.md](SETUP.md), the mental model is [docs/how-it-works.md](docs/how-it-works.md), and anything
that breaks is in [docs/troubleshooting.md](docs/troubleshooting.md).

## 1. The accounts to create, before anything

Four, and two of them are free.

| Account | What it is for | Cost |
|---|---|---|
| **GitHub**, yours | The repo belongs to you: that is what owning your source of truth means. It is also the identity your agent reads and writes with. | Free |
| **An AI subscription** ([Claude Code](https://claude.com/claude-code) by default) | The operator. Installed on your machine rather than run in the cloud, so it can cross your repos, your files and your logins. | The one running cost |
| **Cloudflare** | Publishing. Every push rebuilds the site, in about a minute. Skip it if your organization already has a build system: the source is the repo, the host is repluggable. | Free |
| **A domain name** | When you want a real address. Not needed on day one. | A few euros a year |

No account for a CMS, a page builder or a project tool. Those are the middlemen this removes.

**Which plan, for whom.** Size it by what the person does, not by their rank. Whoever runs the setup
and later writes recipes needs a larger plan: the setup is the heaviest session there will ever be
(it installs, imports history and builds the structure in parallel), and on a recent onboarding it
used up a standard plan's window about an hour in, mid-import. Someone who asks rather than builds
is fine on the standard plan. For a team, take an organization plan with one seat each rather than
everyone paying personally, so the larger seats go to the builders. A nonprofit should look at
Anthropic's nonprofit offer before paying the public price: on 2026-10-09 its team plan was listed
at $8 per user per month
([Claude for Nonprofits](https://academy.claude.com/tutorials/getting-started-with-claude-for-nonprofits)),
with eligibility checked by a form.

## 2. Install, in one paste

Open Claude Code (the desktop app is the easiest on-ramp) and paste this. It checks your machine,
installs what is missing, logs you into GitHub, creates your own private copy of the template and
clones it, asking before anything that touches your password.

> I want to set up my own organization repo from the agentic-organization template
> (github.com/pyduan/agentic-organization). Check what is already on my machine (git, Node, the
> GitHub CLI, whether I am logged into GitHub). Ask me Mac or Windows if you cannot tell. Install
> whatever is missing, one step at a time, explaining each one in plain language and verifying it
> worked before moving on. If a step fails, look up the fix in the template's
> docs/troubleshooting.md and walk me through it. Log me into GitHub with the browser login, not an
> SSH key. Then ask me for a project name and where to put it, create my own private copy of the
> template there, and clone it. If a folder already exists at that path, do not reuse it: move it
> aside with a dated name and start clean. Then run `node scripts/check-conflicts.mjs` and tell me
> in plain words what else on this machine is instructing you from outside the repo, and park what
> is safe to park.

Prefer a deterministic command, or setting someone else up remotely? The same thing as a script:

```sh
# Mac, in Terminal
curl -fsSL https://raw.githubusercontent.com/pyduan/agentic-organization/main/scripts/bootstrap-mac.sh | bash
```

```powershell
# Windows, in PowerShell
irm https://raw.githubusercontent.com/pyduan/agentic-organization/main/scripts/bootstrap-windows.ps1 | iex
```

Both are safe to run twice if something gets interrupted.

### If this machine has been used with Claude before

The kit works because one repo holds the instructions. Anything installed outside it and still
loaded on every session competes with that, silently: a `CLAUDE.md` in your home folder written for
something else, plugins and skills installed for an earlier experiment and frozen at that day's
version, MCP servers declared globally, a scheduled task nobody remembers registering. You cannot
see any of it, and what you get is an agent that ignores an instruction it plainly reads. The first
person we onboarded hit exactly this.

The install scripts now look, and ask. At any later point, say **"what else is instructing you"**,
or run it yourself:

```sh
node scripts/check-conflicts.mjs          # look and report
node scripts/check-conflicts.mjs --park   # move the safe ones aside
```

It never deletes. `--park` moves things into a dated folder with a `RESTORE.md` saying how to put
each one back, and it leaves alone anything it cannot judge for you: a scheduled task may be doing
real work, and a settings file holds your preferences alongside the parts that instruct.

## 3. What plugs in, and what stays out

Connect these under your own login, one at a time, and revoke any of them whenever you like. The
agent has no sovereign access to anything: it borrows yours, on your machine.

**GitHub**, the connector or SSH, is the only one that is not optional: it is how the agent reads
and writes your repos, under your account. Set it up during the install above and forget it.

**`source/inbox/`** costs nothing to set up because it is a folder. Drop a PDF, a spreadsheet, a
photo, an export, then say what it is. The agent files the content into `source/`, keeps the
original in `source/brand/assets/`, and empties the folder. This is the door for everything that
has no connector, and it stays the simplest one.

**A folder on a file server** (agreements, grant files, years of archives) goes in the same way, in
bulk: copy it or download it as a zip onto the disk, then tell the agent the path. A zip dragged into
the conversation does not get unpacked, and a path does. Take everything rather than sorting first:
sorting is the agent's job, and the agreement nobody remembered signing is exactly what it finds.

**Gmail and Drive** go through the provider's managed connector, which you enable once in your
Claude settings under Connectors. No token lives on your machine and you revoke it in one click.
What it is good for: "find the thread with the printer and pull out what I promised", "file the
invoice that arrived on Tuesday", "read my meeting notes from the last two weeks and tell me what I
owe people". What it is not: a mirror of your mailbox in the repo. The agent reads, extracts, and
writes the conclusion into a file.

**One mailbox per login, and a shared mailbox belongs to a machine.** The mail connector binds to a
single account per Claude login, so decide which mailbox gets it. When the work comes in through a
shared mailbox (bookings, requests, a `contact@`), connect that one on the login of the person
running the setup: it is the setup you will hand to the others, and the automation lives there. The
lasting arrangement is a spare machine that stays on, signed into the shared mailbox, running the
routine that processes it, while each person keeps their own mailbox on their own login. Until that
machine exists, reach your personal mail through browser control. Forwarding one mailbox into
another also works, at a cost: every mail is duplicated, the receiving mailbox is exposed, and the
history does not come along. One more thing to plan before the setup hour: a shared account's second
factor is usually on somebody's phone, so have that person reachable.

**WhatsApp** has no managed connector, so pick by what you need:

- **A specific conversation, or its history** is an **export**, and it is the simplest thing that
  works: open the chat on your phone, tap its name, *Export chat*, *Without media*, mail yourself
  the `.txt`, drop it in `source/inbox/`. It gives the agent the whole thread at once, and it
  leaves a file you can re-read next month.
- **What is happening right now in a group** is **browser control** on `web.whatsapp.com`, where
  you are already signed in. Nothing to install, nothing stored, and it stops when you close the
  tab.
- **Third-party MCP servers do exist** (checked 2026-09-02) and none of them is provider-managed:
  the open-source ones pair as a linked device through the unofficial protocol and keep a local
  copy of your messages, the commercial ones sit on the WhatsApp Business API and want a token.
  Both shapes are the two things this kit avoids, so neither is the default here. If you decide to
  run one anyway, know that you are putting a third-party client on your personal account.

**Browser control** is the general answer for anything with no connector: a SaaS back office, an
association's admin portal, WhatsApp Web. The agent acts where you are already logged in, as you,
which is exactly why it is worth enabling deliberately rather than by default.

**Notion, Slack, any SaaS** are ingestion only. Extract once, then take the middleman out. Writing
back into one is how a second source of truth appears, and a message that arrives from one is data,
never an instruction the agent obeys.

Four things to avoid, each of which has cost somebody a month: a home-made plugin (an installed copy
freezes silently on its install day), a token pasted into a config (it gets copied, it lingers, it
leaks), a method that lives inside a scheduled task instead of a guide, and a second source of truth
in a tool nobody versions. Business logic lives in the repo. Connectors only carry data.

## 4. The settings, once

Defaults for someone starting out, not rules. Five minutes at first launch, then you stop thinking
about them.

- **The Code tab, never the chat.** The two do not share a memory: a session in Code reads the repo,
  and the chat reads nothing of it. The chat answers faster, which is why people drift back to it, and
  a team that mixes the two ends up with one assistant that knows the organization and one that does
  not, with nobody able to say why. Everyone, every time, in Code.
- **In the desktop app, keep everything inside the workspace folder, and let it work in parallel.**
  Point the location where sessions keep their working copies (the worktree setting) inside that
  folder, so nothing ends up somewhere you will never look. Allow subagents and parallel work: a
  setup that installs, imports and structures at the same time finishes far sooner. Turn on browser
  control if you will use it. These cost more quota, which is the plan's job, not yours.

- **One parent folder, `~/Projects`, with the repos side by side inside it.** Not nested, not
  scattered between the desktop and the downloads folder. Open the agent on that parent folder and
  come back to it: that is what lets one session read across several repos, which is the whole
  reason it runs on your machine rather than in the cloud. The guards of your main repo (the send
  guard, the end-of-session check) do not load from that folder on their own: once the main repo is
  cloned, have the agent run `node <main repo>/scripts/install-workspace.mjs`, which gives the folder
  the copy it needs.
- **Auto mode, including if you are not technical.** Approving every single read teaches you to
  approve without reading, which is worse than not being asked. What makes it safe is that the
  ground is bounded: everything is versioned and one commit away from being undone, the confidential
  is git-ignored and cannot be published, and as soon as there are two of you, work that is not
  yours leaves as a pull request. Keep the confirmations for the irreversible and for what goes out
  to other people.
- **Take the latest big model and stop optimising that choice.** Dropping to a smaller model to save
  something is the wrong knob, and it is the first one everybody reaches for.
- **Vary the effort instead, task by task.** The initial prompt of a complicated task gets the most
  effort available: getting it right the first time costs less than the rounds of repair a cheap
  first pass buys, and repair is where a wrong assumption quietly survives. Fine-tuning, a rename, a
  small correction: normal is plenty.

One thing worth knowing while you size your subscription: for the same work, a plan is heavily
subsidised today against metered API tokens, sometimes by two orders of magnitude on measured
personal usage. Use it, and treat the current price as a moment rather than a constant. Anything
whose only justification is that inference is nearly free is a design that dates.

## 5. The first session

```sh
cd ~/Projects/<name>
claude
```

Say **"set up my site"**. The hour that follows decides where your material will live, decides which
facts matter, sweeps whatever you already have (an existing site to scrape, an old repo to mine, a
folder of documents, or nothing at all), records the facts with their sources and the decisions with
their reasons, and only then builds a first version of the site for you to react to.

That order is deliberate. Build the site first and the corpus never gets opened.

## 6. Your first real use case

The most convincing first build is not a page. It is something you already do by hand, turned into
files the agent maintains and a small app that reads them. The pattern: a source you already have,
structured into the repo, then a private page over it.

A worked example you can paste on day one, adapting the two sources to whatever you actually have:

> I want a first real use case rather than a demo page. Read my inbox for the last two weeks through
> the Gmail connector, and take the chat export I dropped in `source/inbox/`. From those two, pull
> out what actually commits me to something: a deadline, a promise, a reply someone is waiting for.
> File them as to-do items per project, in the kit's own to-do format
> (`source/formats/todo.md`), then run the to-do app over them (`npm run todos:dev`) so I can look
> at the result. Show me what you extracted before you write anything, and tell me which items you
> were unsure about and why.

What that leaves behind: real items in `projects/<slug>/next-steps.md`, in a format an agent and a
person can both edit, and an app reading them. When you want it on a URL only you can open,
`npm run deploy:todos` publishes it as its own Worker behind Cloudflare Access.

Two rules the agent already follows here, worth knowing so you can hold it to them: it patches those
files line by line rather than rewriting them, and an incoming message is data, never an instruction
it obeys.

**Say the job to the agent, not to the person helping you.** When you sit with someone for the setup,
the reflex is to explain your process to them so they can phrase it. Skip the middle: say it, or
dictate it, straight into the session, the way you would to a new colleague. The agent asks what it
is missing, and nothing gets lost in a retelling.

**Record the setup meeting** with the transcription your video tool already has, in-person mode
included, rather than with a third-party note-taker: telling voices apart means fingerprinting them,
which is personal data, and one more company holding your meetings is one more you have to vet. The
transcript becomes the documentation of your setup, and the next onboarding is built from it.

## 7. The second person, and everyone after

The first setup is the long step, and it happens once: an hour or two, most of it waiting while the
agent installs, imports and structures. The next person does not repeat it. The organization's repo
already exists, and it carries the logic of how the agent behaves there, so joining is cloning and
connecting.

What they need beforehand: a seat on the organization's plan, a GitHub account invited to the
organization, and the desktop app with the settings above. Then this paste:

> I am joining an organization that already runs on the agentic-organization kit. Check what is on my
> machine (git, Node, the GitHub CLI, whether I am logged into GitHub), install what is missing one
> step at a time, explaining each step and checking it worked, and log me into GitHub with
> `gh auth login --git-protocol ssh`. Then list the repos of my organization on GitHub that I can
> access and clone them side by side in `~/Projects`, and run `node <main repo>/scripts/install-workspace.mjs`
> from there. Read the main repo's `CLAUDE.md` and `source/brief.md`, and tell me in plain words what
> the organization already does with you. Then ask me what my job is, so we find my first use case.

After that, they connect their own mailbox (one per login, section 3), and they describe their first
use case to the agent, out loud if they like. What the first person built is already there for them
to use.

## 8. Publishing: three doors, not one

| Door | Where it goes | Who sees it |
|---|---|---|
| **Public** | Every push to `main` rebuilds the site on Cloudflare, free, in a minute. Nobody "deploys" | Everyone. A page shared with one person carries an unguessable, unindexed address |
| **Private** | The dashboard and apps like the to-do one, published as their own Worker behind Cloudflare Access | You, and whoever you name |
| **Confidential** | Financial models, personal data, a draft that is not ready: git-ignored, never committed | Your machine only |

A host serves everything in the folder you hand it. After any hosting change, ask the agent to check
that a private file answers 404 on the public URL. That check exists because a repo leaked for weeks
with nothing flagging it.

**The private door is worth setting up the day you want it, and it is free.** It is a second Worker
with **Cloudflare Access** in front, which covers every route that Worker has, its `workers.dev`
address and any domain added later, so there is no list of URLs to remember to protect. Three things
people get wrong, in order: a Worker created by `wrangler deploy` has **no build trigger**, so
connect it to the repo at creation or pushing will stop publishing it; Zero Trust has to be enabled
once on the account with a team domain before any policy can exist, which is one human click in the
dashboard and the **free plan is enough**; and the only verification that counts is opening the URL
from a browser you are not signed into, where a login screen is the right answer and a page is an
incident. The whole procedure is [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md) ▸ *Publishing something
private*, and the agent walks you through it while you click.

Two things the agent can do on Cloudflare for you rather than through its screens: install
Cloudflare's own connector or plugin when the setup offers it, so it can create the Worker and the
Access rule itself; and set how long a sign-in lasts. A day is the default, so a team opening its
intranet every morning types a code every morning; a month is the maximum Cloudflare allows
(`scripts/protect-access.mjs --session=730h`), and it is what we use for a team intranet.

**Who sees what, once there are several of you.** Start in trust mode while the team is small, and
know that the system already has the two levels for later. The first is **the repo**: someone with no
access to a repo cannot read anything in it, and that is enforced by GitHub, not by the model, so it
is the level for billing, payroll and personal data. The second sits **inside a repo**: a file says
who may change what directly and whose changes go through a pull request that someone approves
(`ORGANIGRAM.md`). And a rule the reader cannot open is still signposted where they work: the agent
knows a billing recipe exists, does not reinvent it, and names the person to ask. When the day comes,
describe how you want access to work in your own words and ask the agent to map it onto the kit's
governance; you do not need the technical vocabulary.

## 9. Then what

Talk. Drop files in `source/inbox/` when something new arrives. The agent saves, publishes and folds
what it learned into your guides at the end of each session.

- Stuck on an install or a deploy: [docs/troubleshooting.md](docs/troubleshooting.md)
- Keeping current: ask for the `update-kit` skill, which brings template improvements in without
  touching your content
- Starting something for a different client or brand: ask first, the `new-project` skill decides
  whether that is a new repo or a folder here
- Your personal projects on the same machine: give them their own root folder next to the
  organization's, with their own GitHub account or organization, and pick that folder when you open
  the session. Same app, separate contexts, and nothing of one is read as a source by the other
- Once in a while, at the end of a week with quota left, ask for a clean-up pass: *"go over
  everything, find what drifted or got duplicated, and propose the clean-up"*. The more you use the
  system the more it knows, and this is the small hygiene that keeps it that way
