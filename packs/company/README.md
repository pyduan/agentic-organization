# company

Run a company on five repos and an intranet that actually steers it: the pipeline, the accounts and
their projects, the product, the strategy, the decisions, and the decks and documents that go out.
Optional: nothing here runs until the owner asks for it.

## What it sets up

This repo becomes the central one. One command puts four private repos beside it:

| Repo | Holds |
|---|---|
| this repo (central) | the routing, the rules, the brand, the company-wide decisions, the journal, the inbox |
| `customers` | one file per company (or segment) and one per project, from first contact to past customer |
| `strategy` | product, market, business model, legal, finance, the company's own decks and documents |
| `administrative` | people, addresses, accounts, HR, and the access list |
| `intranet` | the site, built from the four others, behind Cloudflare Access |

The intranet arrives with nine working tabs: a dashboard with the pipeline chart and a capacity
timeline, accounts and projects, a filterable pipeline, the product with one page per functional
part, strategy, marketing, the decisions journal, resources, and about. It reads the files at build
time and is a view: a wrong card means a wrong markdown file. What people write on it (a tick, a note
in the bubble) is input the agent files into the repos.

Decks are written in `strategy/decks/` or `customers/decks/` by composing components, with the kit's
deck engine. The intranet builds each one, measures it slide by slide in Chrome, reads its text for AI
tells, and refuses to serve it if it fails, with the reason on the Resources page. Documents work the
same way on real A4 pages.

## The profiles

The profile decides what the pipeline **contains**, which is a bigger difference than it sounds.

| Profile | The pipeline is made of | Bar height | The accounts tab |
|---|---|---|---|
| `b2b-services` | companies | headcount | Customers |
| `b2b-product` | companies | headcount | Customers |
| `b2c-product` | segments of a population | number of people | Partners |

A B2B pipeline is named accounts: five companies, a conversation with someone behind each. A B2C
pipeline is segments: a few thousand people who share a reason to buy, and no conversation with any
of them. Same chart, same components, different entity. In B2C the named accounts still exist: the
installers, clubs and shops, in their own folder. Everything is editable afterwards in
`intranet/config.mjs`; the profile only writes the first state.

## Install

Ask the agent to set up the company, or read `skills/company-setup/SKILL.md`. The command underneath:

```sh
node packs/company/scripts/bootstrap-company.mjs --org <github-org> --name "<Company>" --profile b2b-services
```

`--local-only` writes the four folders without touching GitHub, to look first. It needs `gh` signed
in with the right to create repos in the organization, and Node 22.12 or newer for the intranet.

## What it does not do

- **It does not deploy.** That is one more command, after looking.
- **It does not configure access.** That needs a Cloudflare token and is the kit's
  `scripts/protect-access.mjs`.
- **It invites nobody.** Adding someone to a GitHub organization is a decision, not a step.

## Already decided

Each with its reason in [`DECISIONS.md`](DECISIONS.md):

- The site is a view; no fact is edited there.
- The frontmatter is a contract, checked by `npm run check` before every build against the vocabulary
  in `config.mjs`.
- Decisions are typed and kept apart from what was only noticed.
- Colours are numbered slots validated for colour vision and contrast, in both themes.
- Access is closed by default: the Worker serves nothing until it has verified an identity.
- What is "key" or "main" is written by a person, never computed.
- A deck is composed, not drawn, and a tell refuses it at build.

## Skills

| Skill | Use it for |
|---|---|
| `company-setup` | the five repos, deploy, Access, the first hour of content |
| `knowledge-consolidation` | turning a backlog of mail, transcripts and notes into files; start here after setup |
| `customer-file` | creating or updating a company, segment, partner or project file |
| `meeting-log` | turning one meeting, call or thread into logged facts |
| `prospect-research` | building a company file before a first call |
| `company-decisions` | recording a decision in the right repo, and what waits on a person |
| `workshop` | preparing and running a use-case workshop at a customer |
| `customer-onboarding` | standing the method up at a customer, for a company that sells it |
