---
name: freshness
description: "Reconciliation sweep: check that what this project published is still there and that what the repo says about the world is still true. Dead links, hostnames that stopped serving, a site quietly exposing private files, mail that stopped arriving, placeholders nobody filled in. Use when the owner says 'check for dead links', 'is anything broken', 'is everything still up', 'stale stuff', 'run the freshness check', or on a recurring schedule. Not for whether the code is correct — that is the build and the tests."
---

# Freshness

Every other check in a repo asks *is the code right*. This one asks a different question:
**is what we published still there, and is what we wrote about it still true?**

That matters because this failure mode is silent. No file is wrong, no build fails, nothing turns
red. A partner's link rots, a host stops serving, a setting gets changed in a dashboard by someone
who forgot to tell the repo, and the docs go on confidently describing a world that has moved. The
only thing that catches it is going and looking.

Real case that produced this recipe: a project's contact address stopped receiving mail and nobody
noticed **for seven weeks**, in a repo whose stated job was running that organization. No file was
wrong. And on the same account a private site had been publishing its own playbook to the open web
for weeks, while looking perfect.

## Run it

```sh
node scripts/check-freshness.mjs                      # everything
node scripts/check-freshness.mjs --only=links         # just dead links
node scripts/check-freshness.mjs --offline            # no network: placeholders only
node scripts/check-freshness.mjs --json               # for a script or a routine
```

Exit code is 1 when something failed, 0 otherwise, so it works in CI or a cron job unchanged. No
dependencies: Node built-ins only.

## Also check the map

Same rot, one level up: a repo gains a remote, a project is renamed, a new project appears beside
the others and nobody adds its row. `ORGANIGRAM.md` is the one list of repos, and it is prose, so it
drifts silently. One command, part of the same sweep:

```sh
node scripts/check-workspace.mjs
```

It reads that table, then looks at the disk and at what `git remote -v` says, and reports the
disagreements (`ORGANIGRAM.md` ▸ *One map*).

## The four passes

| Pass | Asks |
|---|---|
| `links` | does every external URL in the repo's markdown still resolve? |
| `hosts` | does every hostname the docs claim is live actually serve, with the right status, and **without** leaking what it should not? |
| `mail` | do MX, SPF and DMARC still match what the repo says they are? |
| `stale` | placeholders nobody filled in, and dated rules old enough to be worth re-reading |

`links` and `stale` work with no configuration. `hosts` and `mail` need `freshness.json` at the repo
root, and **that file is the point of the whole recipe**: it is where the repo writes down its claims
about the world so they can be checked. Without it this is just a link checker.

## Writing `freshness.json`

```jsonc
{
  "staleAfterDays": 400,
  "ignoreUrls": ["^https://dash\\.example\\.com"],   // regexes; hosts that refuse bots
  "hosts": [
    { "hostname": "yourdomain.com", "expectStatus": 200,
      // Paths that must NOT be public. This is the check that would have caught a private
      // playbook being served from a repo root.
      "mustNotServe": ["/CLAUDE.md", "/README.md"],
      // A string the LIVE page must carry. Catches the repo being ahead of what is served —
      // a corrected figure never deployed. Pick something that changes when the fact changes.
      "mustContain": ["1 200 clients"] },

    { "hostname": "admin.yourdomain.com", "expectStatus": 302,
      // Needles from INSIDE the app, never the app's name (see the trap below).
      "mustNotContain": ["Stock levels", "Export members"] }
  ],
  "mail": [
    { "domain": "yourdomain.com",
      "mxContains": ["mx.cloudflare.net"],
      "mxMustNotContain": ["oldprovider.com"],       // catches a half-finished migration
      "spfContains": ["include:_spf.mx.cloudflare.net"],
      "requireDmarc": true }
  ]
}
```

**Update this file in the same commit that changes the world.** A config describing last month's
setup does not merely fail to help, it actively reassures you about something that is no longer
true.

## Three traps, all found by getting them wrong

**An access-gated host checked with `expectStatus: 200` passes for the wrong reason.** The gate
answers `302` to a login page; following that redirect yields a perfectly real `200`, so the check
goes green on a host you never verified. Use `expectStatus: 302` **and** `mustNotContain` together.

**The repo being right says nothing about what is served.** On a real project a published figure was
corrected everywhere in the repo, and the live homepage kept showing the old one for six days —
because pushing only publishes if the repo is connected to the host's build pipeline, and it wasn't.
No link check, no status check and no stale-marker sweep can see this: every one of them passes.
`mustContain` is the only guard that catches it. **Declare one for every fact a page publishes and
that you would be embarrassed to serve stale** — a headline count, a price, a date. And when it
fires, the fix is usually to deploy, not to edit.

**`mustNotContain` needles must come from inside the app, not from its name.** An access gate prints
the application's own name on its login page, so `"My Admin Tool"` matches the login page and
reports a leak that is not there. Pick a heading or a control label that only exists once you are
in.

## When it finds something

Fix the world or fix the claim, and say which. A dead partner link is a content fix; a host serving
a file it should not is an incident; an `mxMustNotContain` hit means a migration was left half done.
Then, if the finding was a class of thing rather than a one-off, add the claim to `freshness.json` so
the next sweep catches it without anyone remembering to look.

## Running it on a schedule

A recipe that says "a routine does this" and names no routine is telling a comfortable lie. So name
it here, with whose machine it runs on and when, and update this line whenever that changes:

> **Not scheduled yet in the template.** Set one up on the owner's own machine (a local scheduled
> task, or `cron` calling `node scripts/check-freshness.mjs --json`). It has to be local if the repo
> is private, because a cloud runner cannot reach it.

Monthly is about right. Weekly is noise for a small project; yearly means finding out too late.
