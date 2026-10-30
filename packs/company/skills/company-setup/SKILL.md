---
name: company-setup
description: "Set a company up across five repos with an intranet that runs it: this repo as the central one, plus customers, strategy, administrative and intranet beside it, a pipeline of named accounts (B2B) or population segments (B2C), product and strategy pages, a decisions journal, and composed decks. Use when the owner says 'set up the company', 'I want a CRM / a pipeline / an intranet for my company', 'track our customers and prospects', 'one repo per area', or installs the company pack. Not for a single client project (projects skill) or a separate site (new-project skill)."
---

# Company setup

The company pack turns this repo into the central repo of a company and puts four repos beside it.
Read `packs/company/README.md` first for what it builds, and `packs/company/DECISIONS.md` before
proposing to change how it works.

## Decide that this is the right shape

Most organizations need one repo (`docs/one-repo-or-several.md`). This shape earns its cost when the
areas have **different readers**: a cofounder who reads the pipeline and not the payroll, a sales
hire who must not see `administrative`, a contractor who only sees `intranet`. Repo access is the
only access control GitHub has, so the split follows who may read what. If everyone reads
everything, the `projects` skill in this one repo does the job with less ceremony; say so before
creating anything.

| Repo | Holds |
|---|---|
| this repo (central) | the routing, the rules, the brand, the company-wide decisions (`source/decisions.md`), the journal, the inbox |
| `customers` | one file per company or segment, one per project, from first contact to past customer |
| `strategy` | product, market, business model, legal, finance, the company's decks and documents |
| `administrative` | people, addresses, accounts, HR; the access list |
| `intranet` | the site, built from the four others, behind Cloudflare Access |

## Ask, then bootstrap

Three answers, from the owner:

- **The GitHub organization** that will hold the repos. It belongs to the company, never to a person,
  with two administrators.
- **The company's name**, as it writes it.
- **The profile**, which decides what the pipeline is made of. `b2b-services` and `b2b-product` track
  named companies, bar height is headcount; `b2c-product` tracks segments of a population, bar height
  is how many people, and named accounts become partners (installers, clubs, shops). Ask how they
  sell, not which word they prefer: the entity differs, not only the label.

Then:

```sh
node packs/company/scripts/bootstrap-company.mjs --org <github-org> --name "<Company>" --profile <b2b-services|b2b-product|b2c-product>
```

`--local-only` writes the four folders and touches nothing on GitHub, to look first. `--dest <folder>`
puts them elsewhere than the folder holding this repo, which is the default and the right place:
the repos sit side by side, under the same path on every machine of the company.

The script creates the four private repos, fills the placeholders, copies the deck and document
engine and the checks from this repo into `intranet/` (tracked by `intranet/vendor/`, so
`npm run vendor:pull` there refreshes them after a kit update), and adds `ONBOARDING.md` and
`GLOSSARY.md` here when they are absent. It does not deploy, does not configure Access, and invites
nobody: each of those is a decision (`packs/company/DECISIONS.md`).

Then add the four rows to `ORGANIGRAM.md` ▸ *Repos in this organization*, Kind `satellite`, with who
may read each one. This repo stays `router`.

## The site, locally

```sh
cd ../intranet && npm install && npm run dev
```

`http://localhost:4321`. The example content is invented, says so at the top of each file, and is
there so the pages have something to show while the real files are written.

## The first hour of content

In this order, because each one feeds the next:

1. `administrative/people/`: one file per person, and `emails.md`, which says who signs in with
   which address; `intranet/access.txt` is that column, the list Access applies.
2. `strategy/product/positioning.md`: the one-liner, what we have that alternatives do not, the
   ideal customer.
3. `customers/`: one file per company in B2B, one per segment and one per partner in B2C (the
   `customer-file` skill). A backlog of mail and transcripts goes through `knowledge-consolidation`.
4. `source/decisions.md` here for what binds the whole company, and each repo's `DECISIONS.md` with
   its `## To decide` section, which feeds the dashboard (`company-decisions`).

`npm run check` in `intranet/` before every commit. It reads the frontmatter of every file in the
four repos and catches what the build does not, including the YAML trap of a bare `": "` in an
unquoted value, which builds cleanly and shows `[object Object]` on the card.

## Deploy

A Cloudflare account in the company's name and `wrangler` signed in.

```sh
cd intranet
npx wrangler kv namespace create TODOS      # put the id in wrangler.jsonc
npm run deploy
```

The Worker then answers 503 and serves nothing until Access is in front of it. That is intended.

## Close the door

Cloudflare Access, attached to the Worker itself, so no domain is needed. The kit's script, copied into `intranet/scripts/`, does it,
with an API token (wrangler's own login reads Access and cannot write it; the token's permissions
are in the header of `scripts/protect-access.mjs`). Export it for the command only, never into a file:

```sh
cd intranet
export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…
node scripts/protect-access.mjs --worker=<worker> --emails=access.txt --write-vars=wrangler.jsonc
npm run deploy
```

`--write-vars` fills `TEAM_DOMAIN` and `POLICY_AUD`, which the Worker checks on every request: if the
Access application is ever deleted or detached, the site locks instead of opening. Then open the
address from a browser where nobody is signed in: a code screen is right, a page is an incident.

A one-time code is single use, and a second tab or a mail scanner following the link burns it. If
every address is on Google, pass `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and the code
disappears from the path.

## Deploy from GitHub, without a terminal

`intranet/.github/workflows/deploy.yml` deploys on a button (Actions ▸ Deploy the intranet). It needs
`REPOS_TOKEN` (read access to the four other repos) and `CLOUDFLARE_API_TOKEN`, an account token
limited to *Workers Scripts: Edit*, with an expiry. The token goes straight into the secrets, never
through the screen or the conversation:

```sh
gh secret set CLOUDFLARE_API_TOKEN -R <org>/intranet
gh variable set CLOUDFLARE_ACCOUNT_ID -R <org>/intranet -b "<account id>"
gh variable set INTRANET_URL -R <org>/intranet -b "https://<worker>.<subdomain>.workers.dev"
```

The order of the workflow is a guard too: install and build run the code of dependencies and
content, so they run with no credential on the machine, and the token appears only in the step that
uploads what is already built. A `build` command added to `wrangler.jsonc` would run with the token
in reach; it belongs in the build step. With `INTRANET_URL`, the last step checks from outside that an
anonymous visitor is refused, so a deploy that opened the door fails red. If the Worker was
connected to the repo through Workers Builds, disconnect it: it would deploy on every push without
the four other repos.

**The note bubble** files each note into `source/inbox/notes/` here, with a GitHub token limited to
this repo, *Contents: Read and write*, with an expiry, created at
https://github.com/settings/personal-access-tokens/new and stored with
`npx wrangler secret put NOTES_TOKEN` in `intranet/`. Without it the bubble shows and says it is not
connected. The token belongs to whoever created it and stops with their account.

## What remains

- **Before the first invitation, set the organization's base permission to "No permission".** By
  default every member reads every repo, so the first person invited for one repo also reads
  `administrative`. Grant per repo or per team, as `ORGANIGRAM.md` says, and read it back:
  `gh api orgs/<org> --jq .default_repository_permission` must answer `none`.
- Add the people to the organization (`gh auth refresh -h github.com -s admin:org` first).
- Remove the example content.
- Fill `STACK.md` as the setup goes: each account and service its row, each token its line in
  `administrative/accounts.md` (which one, its permissions, whose, when it expires; never the value).
- Removing someone from the access list stops their next sign-in, not their open session: revoke it
  too (Zero Trust ▸ Users).
- If the company works for two parties who must not learn of each other, write their names in
  `.leak-terms` in the folder holding the repos, on each machine that builds: `npm run check` then
  refuses a deck, a document or an outside page that names them.
- On each machine, "check my setup" (the `check-setup` skill).

## Every session: what waits on a person

```sh
node packs/company/scripts/open-decisions.mjs
```

lists the `## To decide` bullets of every company repo's `DECISIONS.md` with how long each has
waited, the `Revisit on YYYY-MM-DD` lines whose day has passed, and the notes in
`source/inbox/notes/` nobody has filed. Put them in front of the person who decides; writing one down
again is not raising it. The owner may add it as a SessionStart hook in the workspace folder's
`.claude/settings.json`, next to the kit's; `install-workspace.mjs` keeps hooks it did not write.

## When it sticks

**Commits signed with the computer's name.** git never knew who you are: set `user.name` and
`user.email` once per machine (the GitHub noreply address works). Past commits keep their author.

**The first `wrangler deploy` asks to register a workers.dev subdomain**, and in a workflow nobody can
answer. One API call with an account token does it; the name is the account's for good, so choose it
with the company:

```sh
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/<account>/workers/subdomain" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"subdomain":"<name>"}'
```

**A moved or deleted page still answers.** Cloudflare's cache keeps an address for a few days. Load it
with `?cb=<random>` to see what the site really serves.

**Port already in use.** Another session probably runs `npm run dev`. Open the address it serves; never
stop a process you did not start.

## Updates

After a kit update, `npm run vendor:pull` in `intranet/` brings the shared engine and checks to the
kit's version, and `npm run vendor:verify` (part of `npm run check`) says when a copy drifted. The
four repos' other files are the company's own from the day they are created: nothing replays the
bootstrap over them. A template improvement worth having is applied by hand, from the pack's
`templates/`, the day someone wants it.
