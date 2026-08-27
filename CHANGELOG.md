# Changelog

What changed in the kit, newest first. `update-kit` reads this file to tell the owner what an
upgrade actually brings them, so **write for the owner, not for the developer**: what they can now
do, and what they must do about it, in plain language.

One entry per release. Mark it `MAJOR` when it changes something they will notice or must act on —
a new app, a new file format, a rule that changes how their agent behaves. Everything else is
`MINOR` and gets one line.

---

## 2026-08-27 · MAJOR · Before you deliver, your agent now runs the mistakes it already made

Your project keeps a register of what your agent got wrong (`source/quality/incidents.json`). It was
written at the end of every session and read by nobody at the start of the next, which made it a
diary rather than a safety net. Now there is a command that reads it back: it prints the failure
families a task touches, and first of all everything this project has already got wrong in them,
with whatever guards each one today. Repeating something already in the register is worse than a new
mistake, because it means the register is not working.

There is also a new recipe for analysis work, `docs/complex-tasks.md`: write down what the work is
for and what it must respect before deciding how to do it, hold every plan against that, cut the
task into pieces you can judge one at a time, then run the check above before handing anything over.

**What you need to do:** nothing to install. If your project keeps its incident register under a
translated or non-standard path, the command now finds it on its own, so any local bridge script you
wrote to point it at the right file can be deleted. You can also name the path outright with
`--register=<path>` or the `KIT_REGISTER` environment variable. And when it cannot find a register
at all it now says so loudly instead of reporting "no incidents logged", which is not the same thing.

## 2026-08-27 · MAJOR · Forty-three new rules about how this goes wrong, from a real workshop

`docs/failure-modes.md` grew by more than half, from the cumulative error register of a project
running this kit on files where every published figure was there to decide something. The one that
opens the destructive family: a safeguard must not depend on the thing it protects against, and that
check comes before the first line of code rather than after three days of verification. It came from
an archive built to survive the loss of an account, verified for days, and stored in cloud storage
whose login was that same account.

Also new, each paid for once already: no search proves an absence, so calibrate an empty result
against a case you know should appear; a summary never founds a conclusion, quote the clause; a
correction is checked against the authority, never against a second document of the kind that
misled; "nothing to do" and "nothing seen" return the same value and only one is good news.

**What you need to do:** nothing. Your agent reads this file before acting on real data or letting a
figure leave the repo.

## 2026-08-27 · MINOR · Knowing which projects are on the current kit, and who still works in them

`node scripts/check-fleet.mjs` lists every project beside this one that runs the kit: how far behind
the template each is, whether it is wired to announce its own updates, and who last pushed to it. It
exists because a project installed before the update notifier existed can never announce that the
notifier exists, so it stays silent and nothing goes red. It also flags collaborators whose commits
carry an unroutable author address, which makes real work look like no work at all.

**What you need to do:** if you onboarded someone before this update, ask them to check that
`git config user.email` matches their GitHub account. Otherwise their commits are credited to nobody
and they will look inactive when they are not. New installs now set this during setup.

## 2026-08-27 · MAJOR · A journal: the repo now remembers what happened, not only what was decided

Decisions had a file, tasks had files, facts had files — a plain event had none. "The printer
delivered", "the grant answer arrived", "the site was down an hour" now get one dated line with a
provenance in `source/journal.md`, newest first. The rule that keeps it healthy: the journal takes
the line that says it happened; the detail goes to the file that owns it. A note typed into the
to-do app's bubble that turns out to be news ends up here too, and the reread before an annual
review stops being an archaeology dig.

Came from a live project's board, who wanted one place to say that something happened without
deciding where it belongs.

**What you need to do:** nothing to install. The first time something worth remembering happens,
your agent will put the line in `source/journal.md`; replace the TODO row when it appears.

## 2026-08-27 · MAJOR · Kit news reaches you on its own now

Until today, an improvement to the kit only reached you if you thought to ask for it — which is
backwards, since you cannot ask about what you do not know exists. Now every session quietly checks
the template on startup, and when the kit has news your agent opens with it: what changed, what it
brings you, and the offer to pull it in. You say yes or no; nothing is ever applied on its own, and
the same news is not repeated more than once a week.

**What you need to do:** nothing. The check installs itself with this update and stays silent when
there is nothing to say.

## 2026-08-27 · MAJOR · A note bubble on the to-do app: jot anything, the agent files it

The to-do app now carries a floating ✎ bubble. Type anything into it — a number heard in a call,
news from the field, an idea, a correction — and it lands in your repo's inbox
(`source/inbox/notes/`) as one dated file signed with your verified name, committed like every
other edit. On the agent's next pass, the inbox protocol files it where it belongs: a fact into
the fact file, a task into the to-do list, news into the journal. The thought no longer has to
wait for a keyboard.

Born in a live project, where the board wanted one place to say things without deciding where they
go; folded back here the same day.

**What you need to do:** nothing for a one-repo workspace — redeploy the to-do app and the bubble
is there. If your workspace spans several repos, say where notes land with `NOTES_TARGET` in
`apps/todos/wrangler.jsonc` vars: `{ "repo": "you/your-repo", "dir": "source/inbox/notes" }`.

## 2026-08-27 · MAJOR · The to-do app now proves who is asking, instead of trusting a header

The entry below this one moved identity from `ctx.access` to a request header. A field report the
same day showed the header is not proof either: it is a plain string, and nothing in a Worker
distinguishes the copy Access set from one a client typed. Cloudflare's documentation says it in as
many words — validating the header alone is not sufficient, the token and its signature must be
confirmed.

So the to-do app's Worker now verifies the signed token Access attaches to every request (its
signature against your team's public keys, plus the application's audience tag), with `lib/access.mjs`,
a small dependency-free verifier any app behind the gate can reuse. The playbook and the deploy
guide now name the two acceptable shapes: assets binding with the verified token, or no assets
binding and `ctx.access`. The logged-out production check from the entry below still stands — it
proves the gate is closed to strangers; the token check is what makes the identity behind the gate
trustworthy.

**What you need to do:** if the to-do app is deployed, set two vars in `apps/todos/wrangler.jsonc`
after pulling this update — `TEAM_DOMAIN` (https://&lt;your-team&gt;.cloudflareaccess.com) and
`POLICY_AUD` (the Access application's AUD tag, on the app's Overview page in Zero Trust) — then
redeploy. Until both are set the app refuses everyone and says which values are missing.

## 2026-08-27 · MAJOR · The internal-app rule now states its shape, and the check that proves the door is locked

Two corrections to the web-app playbook, both from a live project that applied yesterday's rule to
an app behind Cloudflare Access.

First, "Astro by default" for internal apps now says what it means: static output, no Cloudflare
adapter, and the signed-in identity read from a request header rather than `ctx.access`. Followed
down the standard path, the old wording produced a Worker with Static Assets — a shape where
Cloudflare's own router never hands your code the visitor's identity. An app that refuses to serve
strangers then refuses everyone, or quietly stops checking while the code still reads as if it
does. Local testing shows green either way; only opening the deployed app from a browser that is
not signed in tells the truth. The playbook now covers the whole trap, including the config block
that build tooling can add without any file in your repo declaring it.

Second, the default now states its scope: it decides what you build new, not what you replace. An
internal app that already works and already aggregates several sources is enriched, never migrated
just because the rule names a framework. Two to-do lists make zero to-do lists.

**What you need to do:** if any app of yours sits behind Access, open its URL today from a browser
that is not signed in. A login page or a 403 is right; seeing the app itself is an incident, and
`docs/deploy-cloudflare.md` ▸ *Verify from outside* has the exact command.

## 2026-08-26 · MAJOR · Emails and messages have a house style now

Ask for "an email to the printer" or "a message to Sam about the review" and you get something
written to a rule instead of whatever the model felt like. Two registers, deliberately different:

Inside your organization, the asks come first, in bullets, each with a name and a date. Then one
short paragraph of recap that assumes the reader knows the file, because they do, and if they do not
they can ask their own agent. No enthusiasm, no "hope this helps", no counted summaries. Every
internal message also ends with a line saying an agent drafted it.

Outside, the opposite: one human opening line, the point straight after, and a single clear ask at
the end. Never a caveat about how it was written.

**What you need to do:** open `source/formats/message.md` and fill in two TODOs. The exact wording of
the agent-drafted line, and one short block per person who sends messages drafted here (how they
greet, how they sign, which language to whom, what they refuse). Both take a minute and they are what
makes a draft sound like the person rather than like the kit.

## 2026-08-26 · MINOR · What you build here can be given to someone else

If you build something that would help another organization running the kit — the membership and
donation tooling an association ends up with, say — there is now a shape for handing it over: a
**pack**. A folder that adds skills, scripts and apps, declares what it needs, and asks for the few
values that are yours rather than baking them in.

Nothing to do today. It matters the first time someone says "could I have what you built?".

## 2026-08-26 · MAJOR · Post an update on a to-do, from your phone

You can now write on a task, not just tick it. The update is dated, signed with whoever is logged
in, and lands in the markdown file next to the task — so it reaches whoever reads the repo next,
including your agent.

This is what makes the app worth opening when you are not at a computer. Ticking a box says
something ended; it loses why, and why is usually what you needed later. "Found her on rue de
l'Arbre Sec, poster no longer needed" is worth more in six months than a checked box.

## 2026-08-26 · MINOR · Internal apps have a default now

Anything behind your access gate — an intranet page, a dashboard, a tool for you and a couple of
named people — is built with the same stack from the start, rather than hand-rolled and rewritten
six weeks later. Public pages keep the old judgement call, where plain and static is very often the
right answer.

## 2026-08-26 · MINOR · Upgrades stop hiding, and stop freezing your fixes

Four things a live project ran into on the first real upgrade, all fixed.

**A customisation you made no longer freezes a fix we make later.** When an upgrade sets a file
aside because you had edited it, it now remembers. Every later check tells you when the kit has
changed one of those files, so you decide — instead of never hearing about it again.

**"0 projects found" now says why.** It used to print a bare zero, which reads as "there is nothing
here" when it usually means "I could not read your map". It now names the rows it read and what
each one was missing.

**The upgrade instructions no longer loop.** They told you to run a script that a project older
than the mechanism does not have yet. They now fetch it first.

**A repo that publishes nothing can no longer be deployed by accident.** The placeholder deployment
name is deliberately invalid, so a stray command fails loudly instead of quietly going somewhere.

## 2026-08-26 · MAJOR · To-dos you can tick from your phone

**What it is.** Your `next-steps.md` files become a small web app: tick a box, set a due date,
drag an item to reorder. Every change is a commit on the markdown file, so the list an agent reads
in a terminal and the list you tap on your phone are the same list. No database.

It handles several projects at once, in several repositories, in one app.

**What you must do.** Nothing, unless you want the app. Setting it up needs a GitHub token and a
deploy, which your agent can do for you — ask it to set up the to-dos app.

**What changed in your files.** To-dos now have a standard shape, with an owner, a due date and a
small identifier at the end of the line:

```
- [ ] Chase the printer @sam due:2026-09 #brochure ^k3f9
```

Old lines still work. The identifier is what lets the app change the right line, so **it must never
be edited by hand**, and your agent now knows to patch these files rather than rewrite them.

Due dates keep the precision you chose: a day, a week, or just a month. "Some time in September"
stays that, instead of pretending to a date and then nagging you on the 2nd.

## 2026-08-26 · MINOR · Upgrades no longer overwrite your own work silently

The kit now records which version you last upgraded from, so an upgrade can tell the difference
between "the kit changed this file" and "you changed this file". When both changed, it stops and
shows you, instead of quietly replacing yours.

## 2026-08-26 · MINOR · Your agent argues with you less

Two new rules. A decision written down is treated as settled: your agent should not reopen it, nor
re-add a hedge to a fact you confirmed. And it now has a list of AI writing tics to strip before
anything is published.
