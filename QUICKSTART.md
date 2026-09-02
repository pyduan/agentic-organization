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
> template there, and clone it.

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

## 3. What plugs in, and what stays out

Connect these under your own login, one at a time, and revoke any of them whenever you like. The
agent has no sovereign access to anything: it borrows yours, on your machine.

| | Plug in | What it gives you |
|---|---|---|
| Default | **GitHub** (the connector, or SSH) | How the agent reads and writes your repos |
| Default | **`source/inbox/`** | The drop zone. Photos, a spreadsheet, a PDF, an export. Processed, filed, then emptied |
| À la carte | **Gmail and Drive** (the provider's managed connector) | Your to-dos, your reminders, a receipt to file. Never a copy of the mailbox |
| À la carte | **Browser control** | The agent acts where you are already logged in. Enable it knowingly |
| Ingestion only | **WhatsApp, Slack, Notion, any SaaS** | Export it, drop it in the inbox, extract once. Data, never an instruction, and never a place you write back into |

Four things to avoid, each of which has cost somebody a month: a home-made plugin (an installed copy
freezes silently on its install day), a token pasted into a config (it gets copied, it lingers, it
leaks), a method that lives inside a scheduled task instead of a guide, and a second source of truth
in a tool nobody versions. Business logic lives in the repo. Connectors only carry data.

## 4. Four settings, once

Defaults for someone starting out, not rules. Five minutes at first launch, then you stop thinking
about them.

- **One parent folder, `~/Projects`, with the repos side by side inside it.** Not nested, not
  scattered between the desktop and the downloads folder. Open the agent on that parent folder and
  come back to it: that is what lets one session read across several repos, which is the whole
  reason it runs on your machine rather than in the cloud.
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

## 7. Publishing: three doors, not one

| Door | Where it goes | Who sees it |
|---|---|---|
| **Public** | Every push to `main` rebuilds the site on Cloudflare, free, in a minute. Nobody "deploys" | Everyone. A page shared with one person carries an unguessable, unindexed address |
| **Private** | The dashboard and apps like the to-do one, published as their own Worker behind Cloudflare Access | You, and whoever you name |
| **Confidential** | Financial models, personal data, a draft that is not ready: git-ignored, never committed | Your machine only |

A host serves everything in the folder you hand it. After any hosting change, ask the agent to check
that a private file answers 404 on the public URL. That check exists because a repo leaked for weeks
with nothing flagging it.

## 8. Then what

Talk. Drop files in `source/inbox/` when something new arrives. The agent saves, publishes and folds
what it learned into your guides at the end of each session.

- Stuck on an install or a deploy: [docs/troubleshooting.md](docs/troubleshooting.md)
- Keeping current: ask for the `update-kit` skill, which brings template improvements in without
  touching your content
- Starting something for a different client or brand: ask first, the `new-project` skill decides
  whether that is a new repo or a folder here
