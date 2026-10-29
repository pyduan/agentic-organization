# Stack

<!-- TEMPLATE: the setup skill walks this table with the owner first, one row at a time, before
     anything else (.claude/skills/setup/SKILL.md ▸ 1). Each row ends approved or changed, with the
     date and who said yes in the last column. Each row starts from the defaults listed below. Delete this comment once every
     row is settled. -->

What runs on what, and what would replace it. Read it before proposing any change to the
infrastructure, and never infer this organization's setup from another project's: the stack next
door is a different stack. The money side of a row (plans, seats, invoices) lives with whoever holds
the accounts, not here.

The *Way out* column is the point of the file. A brick nobody knows how to leave is a brick nobody
chose. The *Approved* column says who chose it and when (`2026-10-30 @sam`): a row without one is a
proposal, and *to decide* means a dated `#decide` line waits on someone. A row that changes later
gets a new date and handle, and the reason goes in `source/decisions.md`.

| Role | What we use | State | Way out | Approved |
|---|---|---|---|---|
| Source of truth: knowledge, skills, data | Git, a private repository on GitHub | in place | any Git host, same model | |
| Operator | Claude Code, on the repositories cloned locally | in place | any agent that reads `AGENTS.md` and the skills | |
| Private pages (the intranet first) | Cloudflare Access in front of a Worker, `apps/dashboard` | TODO | Access on a hostname once a domain arrives; any host with a sign-in gate | |
| Website | Cloudflare Workers, rebuilt from `site/` on every push | TODO | any static host with a build on push | |
| Records and documents (the default store) | Markdown and JSON files in the Git repository: the repo is the store, every change a commit (`source/formats/webapp.md` ▸ *State without a database*) | in place | any Git host | |
| Relational data, when files are not enough | Cloudflare D1 (SQLite), read and written only by a Worker | TODO | any SQLite or Postgres; D1 exports to SQL | |
| Large files and uploads | Cloudflare R2, private by default, served through a Worker | TODO | any S3-compatible bucket | |
| Identity and access | Cloudflare Access in front of every private page, roles in the app, denied by default (`webapp.md` ▸ *Access and identity*) | TODO | any identity-aware proxy or the provider's sign-in | |
| Scheduled pipelines | GitHub Actions on a schedule, committing their result (default) | TODO | any CI with a cron | |
| Secrets and keys | Worker secrets and the git-ignored `private/` folder, never a committed file | TODO | the other provider's secret store | |
| Domain and DNS | TODO | | | |
| Mail | TODO | | | |
| Accounts in the organization's name | TODO (two administrators each) | | | |

## The defaults the setup starts from

Each row above starts from one of these, and moves away from it only for a reason written in the
row. The rule underneath all of them: things stay as light as possible, so the organization can run
them without an engineer and leave any of them without a migration.

**A code agent for everyone, Claude Code by default.** Non-technical people included, because the
agent works in the repository. It reads the rules, edits the files on the machine and runs the
scripts, and every correction becomes a rule the next session reads. A chat window or an
assistant inside office software sees one conversation or one file at a time, and what it learns
ends with the window. Claude Code is the default because it is the one this kit is tested on every
day, with the guards and hooks that come with it. *Way out:* the manual is `AGENTS.md` and the
skills are plain files, which other code agents read too; the repository is the brain, the harness
is replaceable (`FEATURES.md` ▸ *The agent's manual is `AGENTS.md`*). Test another harness on one
real task before switching a team to it.

**Knowledge, skills and data in Git.** Facts, rules, recipes, to-do lists and the small data files
an app reads are plain text in the repository: versioned, reviewed, and readable by any agent.
They are the same kind of thing, what the organization knows and how it works, which is why they
live together. *Way out:* any Git host (`FEATURES.md` ▸ *One repository is the source of
truth*).

**Files in object storage.** Archives, scans, recordings, exports and datasets go to a private
bucket, by default Cloudflare R2 in the organization's Cloudflare account. It speaks the S3 API,
charges nothing to read files back out, and stores 10 GB a month for free (read on 2026-10-29,
[R2 pricing](https://developers.cloudflare.com/r2/pricing/)). The repository keeps what
was extracted from a file and where the file is. Git keeps every version of every file in every
clone, so a folder of PDFs makes every clone heavy, and a file that must be erased stays in the
history. What a page, a deck or a document displays (a logo, a photo, a chart) stays in the
repository beside it (`source/brand/assets/`), and what must not leave the machine stays
git-ignored. *Way out:* any S3-compatible store; the addresses change, the files do not.

**A relational database only for state.** Accounts, sessions, permissions and the records many
people write at once belong in a database. Raw knowledge never does: in a database it is invisible
to the agent, unversioned and out of review. Before a database, the repository is often enough as
the store (`source/formats/webapp.md` ▸ *State without a database*); when it is not, the default is
D1, in the same Cloudflare account (`source/formats/webapp.md` ▸ *When an app needs a real
backend*). *Way out:* D1 is SQLite, so its data exports to any SQL database.

**A static front, with the logic in the back office.** An app is a static page built with React
(`source/formats/webapp.md` ▸ *Shape*), holding as little logic as possible. The intelligence sits
in back-office pipelines that read the sources, analyse them and write the files the front reads.
They are scripts in the repository, versioned and testable, which the agent can run and fix. A
pipeline with no judgement in it runs on a schedule in CI (GitHub Actions by default) and commits
its result; one that needs the agent's judgement is a routine (`routines/README.md`). *Way out:* the
front is files any static host serves, and the pipelines are scripts any CI runs.

**A build on every push.** The host rebuilds the site and the apps from the repository on every
push, so nobody deploys by hand. Cloudflare Workers is the default: free for static sites, with the
domain, the private pages, R2 and D1 in one account the organization owns. Vercel, Netlify or
GitHub Pages work the same way (`docs/deploy-cloudflare.md` ▸ *Why Cloudflare (and how
to swap it)*). If the organization already has a build platform, use it. *Way out:* repoint the
domain and set one build command.

**When a project needs more than this,** write the requirements before the choice: what it must do,
for whom, under which constraints (`docs/complex-tasks.md`), then the brick that meets them, as a
row here with its reason and its way out. A choice that skips the requirements is a habit from the
last project.

## On another provider

The roles in the table do not change when the organization already runs elsewhere; the bricks do,
and the row says so. Typical equivalents, to propose rather than impose:

| Role | Cloudflare default | Elsewhere |
|---|---|---|
| Pages and apps | Workers | Vercel, Netlify, AWS Amplify or Lambda, Google Cloud Run, Azure Static Web Apps |
| Relational data | D1 | Postgres (Supabase, Neon, AWS RDS, Cloud SQL, Azure Database) |
| Files | R2 | AWS S3, Google Cloud Storage, Azure Blob Storage |
| Identity and access | Access | Google Workspace or Microsoft Entra sign-in, AWS Cognito, Auth0, an identity-aware proxy |
| Secrets | Worker secrets | AWS Secrets Manager, Google Secret Manager, Azure Key Vault, Vercel environment variables |

Git on a hosted service stays the source of truth whatever the provider: that is what lets a person
and an agent edit the same records.

## What does not exist yet

The useful half of the file: what is missing reads better here than in a conversation, where it is
gone by the next session.

## An organization answer is not a personal one with the names changed

The same person often runs personal projects on neighbouring stacks, sometimes with the same
vendors. "It is free and already set up over there" is the argument that puts the organization's
mail or files in someone's personal account, where they stay when that person leaves. An address
that survives the person, a scope the organization's admin can manage, and a service someone other
than its creator can administer are requirements here. Paying for a seat is often the right answer.
