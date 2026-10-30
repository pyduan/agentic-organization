# Decisions

The site. Organization-wide decisions live in
[`__CENTRAL__/source/decisions.md`](https://github.com/__ORG__/__CENTRAL__/blob/main/source/decisions.md).

## To decide

Choices waiting on someone. They show on the dashboard: a choice settled here leaves the list there.

- **Example to replace.** What has to be settled, what it blocks, who decides. (raised YYYY-MM-DD)

The sections below are the decisions already taken about this site, with their reasons. They come
with the kit: they explain why there is no form, no database and no domain, and they are worth
reading before undoing one of them.

## The site collects notes, and the agent files them (2026-10-16) · technology

Every page carries a note bubble, like the kit's to-do app. A piece of news, a figure heard in a
meeting, an idea: what someone wants to say away from a keyboard, and what does not survive waiting
for one.

The rule "nothing is entered here" becomes "no fact is changed here". A note is not a fact: the
Worker drops it as it is, signed with the verified address, into the central repo's
`source/inbox/notes/`, one file per note. The next session files what it says in the right file,
dated and attributed, then deletes it in the same commit. Nothing on the site reads a note back, so
it stays a view of the files. The files remain the only source, and the note enters them by the same
path as everything else.

Set aside: keeping notes in KV, where no session reads them, and a form per file, which would have
made the site a second source over the files.

The cost: a GitHub token limited to the central repo (`NOTES_TOKEN`), which belongs to one person,
and a git history that keeps everything typed in the bubble once the button is pressed.

With it, two fixes in the same place. A tick or a note on a to-do now carries the person's own day:
the server's UTC day dated an evening tick to the next morning. And a run of gestures that returns to
where it started (tick then untick, a note rewritten as it was) sends nothing: the page compares the
final state with the last saved one, and the Worker does not write what changes nothing. A save that
fails says so on the line, keeps what was done and offers to retry.

## Deploying is a button on GitHub, not a terminal (2026-09-16) · technology

`.github/workflows/deploy.yml`, triggered by hand from the Actions tab. It does exactly what
`npm run deploy` does on a laptop: it fetches the five repos side by side, because `content.mjs`
reads `..`, builds, and deploys.

Written because the only way to publish went through one laptop, so a fix waited until the person
holding it was in front of it. The first concrete case: the mobile menu was done, reviewed and
pushed, and invisible to everyone because nobody could run the command.

**`workflow_dispatch` only.** Nothing fires on a push. Deploying is part of what a person approves,
and the button is that approval. An automatic trigger on `main` would also publish the access list
and the pipeline without anyone having asked for it that day.

Two secrets, both outside the repo: `CLOUDFLARE_API_TOKEN` for the deploy, and `REPOS_TOKEN` with
read access to the five repos, because the job's `GITHUB_TOKEN` only sees the repo it runs in and
the four others are private.

The run summary shows the deployed commit of each of the five repos, which is the only written answer
today to "which version is live".

## The site is a view, and nothing is entered here (2026-09-16) · technology
Refined on 2026-10-16: no fact is changed here, and the note bubble drops entries the agent files
("The site collects notes", above).

Every page is generated from the other repos' markdown at build time. No form, no database, no admin.

This is the method applied to ourselves. A view people can edit becomes a second source of truth on
the same facts, and then neither is trusted. The cost is that changing anything means editing a file
and pushing, and that is the intended cost.

Every file page names the file it comes from, so the fix is always one read away.

## A generic workers.dev subdomain, not a domain of our own (2026-09-16) · technology
`__WORKER__.<subdomain>.workers.dev`, on a founder's personal Cloudflare account.

The company has no settled name, so no domain. The alternative was a subdomain of a cofounder's
personal domain. Set aside: a company asset living under one cofounder's personal domain is a small
thing that becomes awkward, and it would have needed renaming twice, once for the domain and once for
the name. A generic URL is renamed once.

## Cloudflare Access, attached to the Worker rather than a hostname (2026-09-16) · technology
Signing in is a one-time code sent by mail to one of the named addresses. No shared password.

**Attached to the Worker**, through `destinations: [{"type": "worker"}]`, which covers at once the
workers.dev URL, the preview URLs and any future route. The usual way to configure Access targets a
hostname, and that needs a domain in the Cloudflare account. The company has no domain for want of a
settled name, and putting the site on a cofounder's personal domain to satisfy Access would have
traded a naming problem for an ownership one.

Shipped after a shared password, which was the first version. The password worked, with no identity
per person and no trace of who opened what, on a site that carries the pipeline, the intended equity
split and everyone's addresses.

### The Worker still verifies the assertion

With Access attached to the Worker, an unauthenticated request never reaches the code, so the check
in `worker.js` does nothing on a normal day.

It is there for the abnormal day. If the Access application is deleted, detached or rebuilt pointing
elsewhere, a Worker that blindly trusted Access would start serving everything publicly, silently,
with no error to notice it by. Checking the signature, the issuer, the expiry and `aud` turns that
mistake into a locked site instead.

Checking `aud` matters in particular: an assertion issued for another Access application on the same
account carries a valid signature from the same key. The right key and the wrong door.

### "This code has already been used" is a real defect, not a misreading

Reported several times, on codes that had never been used (a cofounder, 2026-01-15).

A one-time code is invalidated by the request for the next one for the same address. And
`auto_redirect_to_identity` is true, so every arrival on the site requests one without anyone asking:
a second tab, a refresh, a bookmark opened while the first code is still in the inbox, a link preview
generated by a messaging app, a browser prefetch. Each one silently burns the code the person is about
to type, and the page tells them it was already used, which is true and reads as a lie. A 24-hour
session sends everyone through this every day.

Not reproduced from a machine: the account is not reachable from here and the reading above comes
from the configuration `protect-access.mjs` sets, not from a trace. The three fixes are listed under
*To decide* at the top of the file rather than applied, because two of them touch the gate.

Meanwhile: type the digits instead of clicking the link in the mail, and type them in the tab that
asked for them.

### The installer needs a token wrangler does not have

wrangler's OAuth token reads Access and cannot write to it. Found by probing rather than assumed:
`GET access/apps` and `GET access/identity_providers` pass, `POST access/identity_providers` returns
`auth.forbidden`, and `access/organizations` returns a bare authentication error on both verbs.

So `scripts/protect-access.mjs` takes its own API token, and the installation is a one-off action by
the account owner. The script is idempotent and replays identically the day the site moves to a
Cloudflare account in the company's name. It writes `TEAM_DOMAIN` and `POLICY_AUD` into
`wrangler.jsonc` (`--write-vars`), and the Worker serves nothing until both are there.

## The build validates the content before rendering it (2026-09-16) · technology
`scripts/check-content.mjs` runs before every build and every deploy.

Written after a real failure, not as a precaution. A `key_facts` bullet containing `": "` is read by
YAML as a map instead of a string. It builds cleanly, looks normal, and renders as `[object Object]`
on the card, which nobody notices before reading that card. Every rule in the check is a failure the
build does not see.

## To-dos are tickable, and a tick is not an answer (2026-09-16) · technology
Questions come from each repo's `INDEX.md` and next steps from each project file. Neither is edited
here. What is edited is a tick and a note, kept in KV and attributed to the signed-in address.

The separation matters. Answering a question means editing the file where the context lives, and the
line then leaves the list on its own. A tick is a working signal between two people this week.
Letting the site edit the question would have made it a second source of truth over the repos, the
one thing this site must not become.

The ids are a hash of the repo and the question's text, so rewording it clears the tick. A reworded
question is a different question.

## The site speaks one language, the company's, and its labels live in one file (2026-09-16) · business

Every word of the interface is in `src/lib/i18n.mjs`, in one language. The kit ships it in English;
a company whose readers and customers all speak another language translates that one file, and writes
its markdown in the same language, so a card never reads in two.

It was first built bilingual, with a second route tree, a switcher and a table of strings in two
languages. That doubled the routes and the review surface to serve nobody, and it was dropped the
same day. The string table stayed, with one language in it: it is still the file where a word is
changed once instead of on nine pages.

A later version kept the markdown in one language and translated only the interface. It produced
cards that read in two languages, a sentence in one introducing a paragraph in the other, and to-do
lists half of which were reread twice. So the files the site shows are written in the site's language.

What stays English whatever the language is the typed vocabulary `content.mjs` and
`check-content.mjs` read: `status`, `stage`, `sector`, `kind`, a decision's type. `i18n.mjs` is the
only place it gets its label. The structural headings the parser matches on (`## Open questions`,
`## To decide`, `## Journal`) change with the language, in the markdown and in `content.mjs` in the
same commit.

## One to-do list on the dashboard (2026-09-16) · technology

Pending choices and open questions were two `TodoList`s stacked under two headings, looking the same.
They are now one, with a chip per line saying which of the two it is.

Two lists that look identical ask the reader to understand a distinction before they can read
anything, and the distinction does not change what they do: in both cases they open a file. It stays
visible, as a chip, where it costs a glance instead of a section.

The bug that made the duplication costly: the component wires a single `[data-todos]` per page, so
the second list was never tickable. Nobody had noticed, which says a lot about how many people read
that far.

## Google rather than a one-time code, and a one-week session (2026-09-16) · technology

The mailed code was rejected as already used when it had not been. It had: a PIN is single use, and
two things consume one without anyone making a mistake. Asking for a new code invalidates the
previous one, so a second tab is enough. And messaging apps' link scanners follow the mail's link to
check it, which consumes it before it is read.

Two fixes. The session goes from 24 hours to one week, so the sign-in is met seven times less often.
And the identity provider becomes Google when given an OAuth client: every address on the list is
backed by Google (a Gmail address, or a company domain whose mail is hosted by Google), so it is one
click and no more mail.

The one-time code stays configured on the account. It becomes useful again the day access has to be
opened to someone outside, which is the case it is made for.

## Previews are images, not frames (2026-09-16) · technology

Resource cards and the Product header showed the target page in a scaled `<iframe>`. It was cleverer
than needed and did not work: the deck showed blank, with no console error, on a page that sends
neither `X-Frame-Options` nor `frame-ancestors`.

Debugging someone else's slide engine to get a thumbnail is a bad trade, and a preview that works one
time in two is worse than a still image. Most sites we link publish their own preview: we take it,
commit it, and the card shows instantly with no outside request from a page behind Access.

A private repo has no preview: the GitHub endpoint returns a generic grey octopus, which reads as a
broken image. Those get a typographic tile with their name.
