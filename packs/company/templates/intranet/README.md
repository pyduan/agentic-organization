# intranet

__COMPANY__'s private intranet. A static site, built at build time from the markdown files in
`customers`, `strategy` and `administrative`, and from what the central repo holds about the
company (`source/decisions.md`, `source/journal.md`).

**No fact is entered here.** Every card, every figure, every bullet is read from a file. When
something on the site is wrong, the file behind it is wrong. Fix the file and rebuild. A view you
can edit becomes a second source of truth, and then neither is trusted.

What the site takes is input for the files: a tick and a note on each to-do (kept in KV, signed), and
the note bubble on every page, which commits each note to the central repo's `source/inbox/notes/` for the
agent to file. Nothing on the site reads a note back.

## The pages

**Dashboard** (`/`): the totals, the pipeline as a chart, then the work. Next steps from every
project and every open question across the four repos, both tickable.

**Active customers** (`/customers`): the capacity timeline first, every dated milestone across every
customer on one axis. Then one block per customer with its projects as cards.

**Prospects** (`/prospects`): every company we hold a file on, in one flat grid, filterable by status
and sector. A lead, a prospect and a customer are the same file with a different `status`.

**Journal** (`/journal`): what we learned that changed how we work, and under it every dated contact
across the customer files.

**About** (`/about`): what we do, the cofounders, the people around the company, the decision log and
the key resources.

Company pages are `/customers/<company>` and project pages are `/customers/<company>/<project>`,
nested because a project only means anything inside its customer. Both use the same shell, with the
same sections in the same order, so two pages are comparable.

## It needs the other repos

The build reads `../__CENTRAL__`, `../customers`, `../strategy` and `../administrative`. Clone them
side by side:

```bash
cd ~/projects/__SLUG__
for r in __CENTRAL__ customers strategy administrative intranet; do
  gh repo clone "__ORG__/$r"
done
```

A missing repo fails the build with the command to fix it, rather than quietly dropping a tab.

## Decks

`strategy/decks/` and `customers/decks/` hold one folder per deck, a `deck.mdx` composed from the
components in `scripts/deck/`. `npm run decks` builds each into `public/decks/<slug>/`, served at
`/decks/<slug>/` behind the same access as everything else, and lists them on the Resources page. A
deck with an error, a tell (`scripts/check-ai-tics.mjs`) or a layout defect measured in Chrome is
refused, not served, and the page shows why. The build itself never fails over a deck. The method is
`__CENTRAL__/source/formats/deck.md`.

The engine in `scripts/deck/` and `scripts/doc/`, and the shared checks, are the kit's, copied from
the central repo and listed in `vendor/__CENTRAL__.json`. After a kit update in the central repo,
`npm run vendor:pull` brings them here; `npm run check` fails if one was edited here (fix it in the
central repo instead). Only `scripts/deck/paths.mjs`, `scripts/deck/intranet.mjs` and
`scripts/doc/build.mjs` are this repo's own: they know where the company's repos are.

## Documents

A proposal, a one-pager, minutes: `strategy/documents/<slug>/document.md` or
`customers/documents/<slug>/document.md`, built into real A4 pages at `/documents/<slug>/` and to a
PDF with `npm run doc -- <slug> --pdf`. A document with a defect is not served, like a deck. The
format is `__CENTRAL__/source/formats/document.md`.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run check      # the markdown the site is built from, every Access-gated Worker runs before its
                   # files, no name from .leak-terms in what leaves, the code shared with another repo
npm run decks      # builds the decks into public/decks/, refuses what fails a check
npm run build      # check, decks, documents, then build
npm test           # the deck and document engines, the worker, the checks, the tics self-test
npm run deploy     # check, build, then wrangler deploy
```

`npm run check` is the one worth knowing. The frontmatter is a typed contract, and the failure it
exists for is silent: a `key_facts` bullet containing `": "` is read by YAML as a map, builds
cleanly, and renders as `[object Object]` on the card.

## Access

Cloudflare Access, with a one-time code sent by email. You enter your address, you get a code, you
are in for 24 hours. No password to share, and a record of who signed in.

Access is attached to the **Worker itself** rather than to a hostname, so it covers the workers.dev
URL and anything else the Worker answers on. That matters here: attaching Access to a hostname needs
a domain in the account, and the company may not have a domain yet.

The allowed addresses are in `access.txt`, one per line, mirrored from
`administrative/people/emails.md` ▸ *Signs in with*. That file is the only home for the list. `worker.js` does
not repeat it, because a list in two places is a list that disagrees with itself.

`worker.js` verifies the Access assertion on every request: signature against the team key set,
issuer, expiry, and that the `aud` is this application. On a normal day that verification is
redundant, since Access refuses unauthenticated requests before the Worker runs. It is there so that
deleting or detaching the Access application produces a locked site rather than a public one.

### Setting it up

Once, by whoever owns the Cloudflare account:

```bash
export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…   # see the header of scripts/protect-access.mjs
node scripts/protect-access.mjs --worker=__WORKER__ --emails=access.txt --write-vars=wrangler.jsonc
npm run deploy
```

wrangler's OAuth token reads Access and cannot write it, which is why this needs a token of its own.
`--write-vars` fills `TEAM_DOMAIN` and `POLICY_AUD` in `wrangler.jsonc`; until both are there the
Worker serves nothing. The script is idempotent: rerun it to change the list. Removing an address stops that person's next
sign-in, **not the session already open**: revoke it too (Zero Trust ▸ Users ▸ the person ▸ revoke
sessions, or the Access API's `revoke_user`) and read back that no active session remains. Do the same
when someone used another person's mailbox or device: with a one-time code, whoever reads the inbox
is that identity. One person per address.

## A page for someone outside

A partner, an accountant, a customer who should read one page and nothing else: never the intranet,
whose list opens everything. Each such page is its own Worker, with its own Access application and
its own list, built from `outside/_template/`:

```bash
cp -R outside/_template outside/<page>
# outside/<page>/wrangler.jsonc: "name" becomes __WORKER__-<page>
# outside/<page>/access.txt: their address, and the cofounders who follow the page
# outside/<page>/public/: the page itself
npx wrangler deploy --config outside/<page>/wrangler.jsonc
node scripts/protect-access.mjs --worker=__WORKER__-<page> --emails=outside/<page>/access.txt \
  --write-vars=outside/<page>/wrangler.jsonc
npx wrangler deploy --config outside/<page>/wrangler.jsonc
```

The first deploy creates the Worker, which serves nothing until the script has written its two Access
values. Each address signs in with a one-time code; remove a line and rerun to stop the next sign-in,
then revoke the open session as above. The person,
the page and the end date go in `administrative/people/emails.md` ▸ Outside access, and a change to
any access list is shown to a cofounder before it is applied.

A secret link (a long token in the address) is the fallback, never an equal option: it can be
forwarded and identifies nobody. If a constraint forces one, it is a decision with `Revisit on
YYYY-MM-DD` naming the constraint (`__CENTRAL__/packs/company/skills/company-decisions/SKILL.md`), with an expiry, and it is
replaced by Access when the constraint lifts.

What an outsider writes goes to a store the page's Worker reads (a KV namespace), never into git:
nothing exposed to someone outside holds a token that can commit.

## The note bubble

Every page carries a note bubble at the bottom right, rendered hidden and shown by `worker.js`, so it
appears only where its endpoint exists. `POST /api/notes` commits each note as one file in
`__CENTRAL__/source/inbox/notes/`, dated with the author's own day and signed with the verified address, and
the agent files it from there ([`__CENTRAL__/source/inbox/README.md`](https://github.com/__ORG__/__CENTRAL__/blob/main/source/inbox/README.md)).

It writes with `NOTES_TOKEN`, a GitHub token limited to the central repo's contents, created once at
https://github.com/settings/personal-access-tokens/new (owner: the organization; repository: only
`__CENTRAL__`; Contents: Read and write; an expiry date) and stored without passing through a
conversation:

```bash
npx wrangler secret put NOTES_TOKEN
```

Without it the bubble answers that it is not plugged in. The token belongs to the person who made it
and stops with their account or at its expiry; the bubble then says the same thing.

## Where it runs

On a generic `workers.dev` subdomain, on a founder's personal Cloudflare account, deliberately. A young company often has
no name and therefore no domain, and no company asset should sit under a subdomain belonging to one
cofounder. Nothing has to be renamed when the real domain arrives.

## The design

The system is [`__CENTRAL__/source/brand/design.md`](https://github.com/__ORG__/__CENTRAL__/blob/main/source/brand/design.md).
`src/styles/tokens.css` is a copy of that repo's `source/brand/tokens.css`: change the colour there first,
then copy it across. A new colour does not start in this repo.

## The words

Every label is in `src/lib/i18n.mjs`, in one language, English as shipped. A company that works in
another language translates that file and writes its markdown in the same language
([`DECISIONS.md`](DECISIONS.md)).

## The code

`src/lib/content.mjs` is the only file that touches the filesystem. It reads, and it never corrects,
completes or infers: a missing field stays missing and renders as `unknown`.

`src/components/` holds one card used for both companies and projects, because both files have the
same shape. Adding a field to the markdown template adds it everywhere at once, which is the point
of templating the file and the view together.
