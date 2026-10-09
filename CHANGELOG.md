# Changelog

What changed in the kit, newest first. `update-kit` reads this file to tell the owner what an
upgrade actually brings them, so **write for the owner, not for the developer**: what they can now
do, and what they must do about it, in plain language.

One entry per release. Mark it `MAJOR` when it changes something they will notice or must act on —
a new app, a new file format, a rule that changes how their agent behaves. Everything else is
`MINOR` and gets one line.

---

## 2026-10-09 · MINOR · Sessions working side by side announce the files they take

When two or more sessions work on the same app, the one about to change a shared file now tells the
other first and says when it is done, and the other pulls before touching it again. And when two
sessions find themselves on the same job, they stop and split it instead of doing it twice. This is
how three sessions built an organization's intranet together for a full day without overwriting
each other.

**What to do:** nothing.

## 2026-10-09 · MINOR · The end-of-session check stops asking about another session's work

When several sessions work in the same copy of your repos, the check that stops a session from
ending with unsaved work used to fire on whatever was unsaved, whoever had written it. On one
afternoon four sessions were stopped seventeen times between them, nearly always over a neighbour's
files, and each time the agent had to explain that they were not its own. The check now reads what
the session itself did and asks only about that. When it cannot tell, it asks about everything, as
before.

**What to do:** nothing.

## 2026-10-09 · MINOR · A choice your agent made for you waits for your yes before it counts as settled

Your agent treats what is written in `source/decisions.md` as settled and does not reopen it. That
was also true of choices it had made itself, on your behalf, during setup: a default, an assumption,
a design call. Those now go in marked "(proposed)", with a line asking you to confirm, and they only
become settled once you have said yes or corrected them.

**What to do:** nothing. If your setup is recent, you can ask your agent which entries in
`source/decisions.md` it wrote without you.

## 2026-10-09 · MINOR · A private app can deploy itself on every push with no dashboard screen

`docs/deploy-cloudflare.md` now describes a second way to keep a private app deployed: a GitHub
Actions workflow in your repo instead of connecting the repo to Cloudflare in its dashboard, with a
deploy token that can do nothing else and a last step that fails if the app ever answers a stranger.
Your agent can set it all up from the command line. Three entries in `docs/troubleshooting.md` cover
what came up on the way: an account's first deploy asking a question nobody can answer, an app that
reads thousands of files from GitHub on the free plan, and reading PDFs and scans on a Mac without
installing anything.

**What to do:** nothing. Your existing deploys keep working as they are.

## 2026-10-09 · MINOR · When a step can only be yours, you get one link, and your agent checks it took

Some steps only you can take: creating a GitHub token, changing who can read your organization's
repos. Your agent now hands them over as one link to the exact setting, with what to choose there,
and then reads the setting back rather than taking "done" for an answer: on a live setup, a
permission reported changed was still unchanged twice, because its confirmation window had been
closed rather than confirmed. Anything still waiting on you at the end of a setup becomes a
`#decide` line that is raised at the start of every session until it is settled, instead of a
paragraph at the bottom of a chat. Two security defaults come with it: before inviting anyone to a
GitHub organization, the setup sets its base permission to "No permission", since GitHub otherwise
lets every member read every repo, restricted ones included; and where one repo is restricted, an
app's GitHub token is a fine-grained one that leaves it out, never a copy of your own.

**What to do:** if your organization has a restricted repo and has already invited people, ask your
agent to check the organization's base permission. Nothing else.

## 2026-10-09 · MAJOR · The guards now follow you into the folder that holds your repos

The kit tells you to open your agent on the folder that holds all your repos side by side, and that
is still right. But the guards that live in your main repo (asking you before a message leaves in
your name, checking a turn's claims, the end-of-session check) load only in the folder the agent was
opened on, so in that parent folder none of them ran, and nothing said so. An organization set up
from the kit found out and had to build a copy for the parent folder by hand. The kit now ships it:
`node scripts/install-workspace.mjs` writes a `CLAUDE.md` and a `.claude/settings.json` into the
parent folder that send the agent to your main repo's rules and run its guards. A session opened
there also pulls every repo at the start, names any repo it could not update, and checks every repo
for unsaved work at the end. It also warns when git does not know who you are on that machine, since
commits then go out under the computer's name.

**What to do:** if you open your agent on the folder that holds your repos, ask it once to run
`node <your main repo>/scripts/install-workspace.mjs`, then open a new session there: its first line
should read "Workspace: … repo(s) up to date." If that folder already has a `CLAUDE.md` or
`.claude/settings.json` you made yourself, the script stops and shows you; nothing is overwritten.

## 2026-10-09 · MINOR · Putting a page behind Access accepts the newer kind of Cloudflare token

Cloudflare now issues API tokens that belong to the account rather than to a person, and
`scripts/protect-access.mjs` refused them as invalid although they had every permission needed: it
only asked Cloudflare whether the token was a personal one. It now checks both, so either kind works.

**What to do:** nothing. If your agent ever told you a freshly made token "was refused", it was this.

## 2026-10-09 · MINOR · A commit no longer carries away what another session staged

When two sessions work in the same copy of a repo, whatever one of them has staged waits in an area
both share, and a plain commit from the other takes it along under the wrong message. It happened on
a live project the day two sessions set up an organization side by side: nine files of one session's
work left inside the other's commit, caught only because the agent read what the commit contained
before publishing it. Your agent now commits with `git commit --only`, naming every file it touched,
and the end-of-session reminder says the same.

**What to do:** nothing.

## 2026-10-06 · MINOR · The contrast check no longer fails a title for a glow in the far corner

A deck with a soft coloured glow in one corner had every small title on its light slides reported
as too faint, because the check counted the glow as if it covered the whole slide. It now measures
the pixels actually painted under the words whenever a gradient or a background photograph is
involved, so those false alarms are gone and text over a photograph is measured too instead of being
left for you to check by eye.

**What to do:** nothing. If your agent darkened a colour last week only to satisfy the check, it can
rerun it and see whether the change was needed.

## 2026-10-05 · MINOR · A deck's text is measured for contrast before it ships

A deck went live with its four headline figures dark green on a green ground, invisible, after its
dominant colour was inverted; a full sweep then found thirty more texts too faint to read. `node
scripts/check-contrast.mjs <deck>` now measures every text on every slide, hidden ones included,
against the accessibility thresholds, using the Chrome already on your machine. The new-deck and
publish recipes run it before a deck is shown or published.

**What to do:** nothing. If you want to know where your existing decks stand, ask your agent to run
it on each; expect small grey captions and coloured headings on light grounds to show up.

## 2026-10-05 · MINOR · Opening a private page to someone outside no longer needs a provider screen

`node scripts/protect-access.mjs --worker=<name> --emails=<file>` puts a Worker behind Cloudflare
Access from the command line: the people on the list each receive a one-time code by email, and
removing a line then rerunning revokes them. It is now the default for anything private and for
giving a page to someone outside your organization; a secret link is a dated fallback to replace as
soon as possible. The recipe is in `source/formats/webapp.md`, and the dashboard setup in
`docs/deploy-cloudflare.md` uses it instead of the dashboard screen.

**What to do:** nothing for pages already protected. The next time your agent opens a page to someone
new, it will ask you for a Cloudflare API token once (the permissions are listed at the top of the
script), and keep the list of addresses as a file in your repo.

## 2026-10-05 · MAJOR · Two hooks now hold the two rules your agent kept breaking

Projects running the kit logged the same mistakes again and again after the rule against each was
written, and one owner's register counted thirty-seven repeats. Two of them now meet the harness
instead of a sentence.

**Sending.** Any message that would leave in your name, by mail, chat or a script, now stops and asks
you first, showing the exact call. On a live project a mail went out while its owner was still
correcting the draft, and in another session a "yes, prepare it" was taken as "yes, send it". You
approve the one message you asked for; anything else waits. A channel that only ever reaches you (an
alert your own script mails you) can be exempted in `.claude/send-guard.json`.

**Ending a turn.** Before your agent hands back an answer, a check reads what that turn actually did.
It refuses to let the answer say something is missing when nothing was searched, that someone never
replied when the mailbox was not opened, that something was verified when nothing ran, that something
was sent or published when the last command failed, or to lean on a document it read only in part. It
blocks once, so a false alarm costs one second look and never a loop. Replayed on a few hundred real
turns before shipping, it would have stopped about one in fifty.

The failure guide also gained some thirty rules drawn from the registers sent in this month, among
them: an "ok" on a direction is not a decision; a check that examined nothing returns no verdict; a
breakdown has no balancing line; before writing a message for you, your agent reads what left your
mailbox today.

**What to do:** nothing, unless your `.claude/settings.json` carries edits of your own, in which case
`kit-sync` will list it for you to merge by hand: the two hooks are one `PreToolUse` entry and one
more line under `Stop`. If you send yourself automatic alerts from a script, add that script to
`.claude/send-guard.json` so it is not held. For stricter checks on statements of law, copy
`source/quality/turn-checks.example.json` to `.claude/turn-checks.json`.

## 2026-10-05 · MINOR · check-fleet measures your projects against what the kit published

`check-fleet` measured each project against whatever the template clone on that machine had checked
out, so a clone nobody had pulled in weeks, or one with local commits, gave every project a wrong
age. It now measures against the template's origin and says when it cannot. It also stopped taking a
repo whose name merely starts with the kit's (`agentic-organization-pro`, say) for the kit itself.

**What to do:** nothing.

## 2026-10-05 · MAJOR · Where a repo sits on your machine is no longer written in ORGANIGRAM.md

The repo table used to carry a *Local folder* column, a path on one machine in a file everyone
shares. On a project several people push to, the map said one folder while a collaborator kept the
repo under another name, and every tool told him a repo he worked in daily was not cloned. The tools
now find each repo by its `origin` among the repos beside this one. A layout nothing could guess is
recorded once per machine, outside every repo, with
`node scripts/check-workspace.mjs --at=<owner>/<repo>=<path>`.

Two smaller changes in the same check: a kit project of another organization sitting beside yours is
now mentioned rather than flagged (the warning asked you to add other people's repos to your map),
and a neighbour whose `CLAUDE.md` points at your repo but has no row still is.

**What to do:** nothing breaks. A map that still has the *Local folder* column keeps working, and
`check-workspace` says when the column describes another machine; drop it when convenient. If a
repo you use is not beside this one, have your agent record where it is with `--at`.

## 2026-10-05 · MINOR · kit-sync no longer says the kit changed your files when it has not

`kit-sync status` listed every file it keeps as yours under "the kit has changed them since",
whether or not the kit had moved, because a file you customised always differs from the kit's. An
owner read that heading on a day the kit had not changed and concluded updates were waiting. It now
records which version of the kit each of those files was last reconciled with, uses the heading only
when the kit really changed one, and keeps saying so after an `apply` moves your baseline, until you
mark the file reconciled (`node scripts/kit-sync.mjs reconciled <file>`). Files kept as yours before
this change are listed once as "never reconciled against a known version of the kit".

**What to do:** nothing. The next `apply` rewrites `.kit-sync` in the new form.

## 2026-10-05 · MAJOR · An error report no longer drops the entries your agent filed under a family of its own

Two faults in `scripts/error-report.mjs`, both reported from projects running the kit. The `--email`
form, the one meant to be sent, crashed every time. And an incident filed under any family other
than the seven (`domain-accuracy`, `delivery`, `voice`…) vanished from the report's table and from
its register while still counting in the total: one project's report showed six of its sixteen
entries, and nothing said so. Both are fixed, and the report now finds a register kept under a
translated path, as `preflight` already did. `preflight` had the same blind spot and now prints an
off-schema entry whatever the task.

The register is now checked. `node scripts/check-register.mjs`, also part of `npm run check`, lists
every entry whose family, severity, guard or detector the schema does not allow. The families stay
at seven so that registers can be compared across projects; the finer word your agent wanted goes in
a new `tags` field.

**What to do:** have your agent run `node scripts/check-register.mjs` and refile each entry it lists
under the nearest of the seven families, keeping its own word in `tags`. Until then those entries
appear in the report under *Outside the seven families*. Two lines were also added to `.gitignore`,
so the end-of-session check stops reporting `.claude/settings.local.json` and `error-report.md` as
unsaved work on every turn.

## 2026-09-14 · MINOR · A decision your board takes now has to reach the tool, not just the minutes

One line added to the failure register. On a live project, a general assembly voted that any payment
above a threshold counted as the annual membership fee. Two days later the dashboard still filed
fifty-four of those people under "gave without joining" — anyone preparing a mailing would have
chased members as defaulters. The decision was recorded correctly, in the right document, and
changed nothing about what people actually look at.

**What to do:** nothing. When a decision changes who or what the tool counts, your agent will now
put the rule where the tool reads it — a row per period with its threshold, its date and its source
— rather than only in the record of the meeting, and make the build refuse an ambiguous value.

## 2026-09-13 · MINOR · Your agent now opens a provider's settings before designing around them

One line added to the failure register, paid for on a live project. A membership form was about to
get a whole discipline built around it — a new form every year, a rule about which link to
circulate, a reminder not to send last year's. Opening the payment provider's back office showed
the validity period was a rolling year **and locked**, because payments were attached to it. There
was never a yearly form to get wrong. The same four minutes surfaced two other limits no
documentation mentions, both of which changed what the public page had to say in words.

**What to do:** nothing. Your agent reads the register before any task with several moving parts,
and will now look at a provider's real configuration — including the greyed-out parts — before
building around it.

## 2026-09-10 · MAJOR · Your memory sweep could report a perfect green without opening a single file

`check-memory.mjs` takes a `--side=` flag to pick which side of your machine it sweeps. If that name
matched nothing, it printed `✓ 0 mémoire(s) balayée(s)` and exited 0. A monthly scheduled sweep here
asked for `--side=personnel` where the folder is called `personal`, and got a flawless green report
every run, for weeks, having read nothing at all. A check that checked nothing now says so loudly
and exits 1, listing the side names it can actually see.

**What to do:** if you run this script on a schedule with a `--side=` flag, run it once by hand. If
it was pointing at a name that does not exist, the greens you have been getting were empty, and the
memories underneath have never been swept.

Same day, same shape: the `#decide` reminder added on 2026-09-04 was **inert** on any project
onboarded before the to-do parser moved from `scripts/lib/` to `lib/`. It imported the new path, the
import failed, and a catch meant to keep a reminder from breaking your session ate the error. The
script exited 0 and printed nothing, which looks exactly like having no decisions waiting. Found on
a live project. It now tries both locations, and if it still cannot read your lists it says so on
stderr instead of going quiet.

Two false alarms are gone as well, both of which taught you to stop reading the output. A memory
dated in prose ("mesuré le 25 août 2026") was reported as having no date, because only ISO dates
counted; five of six flags here were memories that did carry a date. And a memory that deliberately
records a path being **renamed** was flagged for containing a dead path, though the guard for
exactly that case already existed and only lacked the word.

## 2026-09-04 · MAJOR · Your agent now re-raises the decisions it is waiting on you for

Three things, and the first one is the reason for the other two.

**A decision written down is not a decision made.** On one workshop, a decision that turned on
access to an entire archive and a password keyring was written up properly — options, cost,
deadline — in a "decisions to take" section. For eight days several sessions worked that same
dossier, produced reports, answered questions, and never reopened it. The owner had to raise it
herself: *you forgot to remind me, you have to make me settle this.* Recording had been taken for
acting, and the failure is invisible by construction: nothing breaks, and each new session finds the
point already written and reads that as handled.

So two tags in your to-do files now get put back in front of you instead of sitting there. `#decide`
marks something that waits only on a decision from you, and it is raised **every session** until you
tick it. `#revisit` marks a hypothesis, or a choice you were forced into by circumstances, and it is
raised once its date passes — because when the thing that forced your hand goes away, nothing else in
the repo will tell you to look again. It prints nothing when there is nothing, and it deliberately
ignores every other overdue item, however late: a reminder that lists everything is one you stop
reading, and then the decision is invisible again for a new reason. A `#decide` with no date is
reported as "the one nobody has to face", which is exactly the shape that lasted eight days.

**Your error report was leading with the figure that misleads.** It opened on the biggest family of
mistakes. An owner asked whether her register was worth resending; she was told the count had risen
but the families were the same, concluded that nothing had been fixed, and was wrong — the share she
was catching herself had fallen and the biggest family was nearly gone. A family is a wide bucket: it
cannot disappear, so its size says nothing about whether corrections work. The report now opens on
the two figures that answer that question — how much you are still catching yourself, with the trend
across the register's two halves, and how many mistakes landed in a family that **already** had a
real guard, which is the only figure that says a fix failed rather than that a category is popular.

**And the fleet check stopped telling you to do the wrong thing.** Its notice used to end "run the
update-kit skill in each", which is an instruction, not an observation: at one in the morning a
session obeyed it literally and installed the framework into ten repos designed to carry none of it.
It now states the exception in the same breath and never prescribes an action across several repos.
`Kind` in your `ORGANIGRAM.md` also gained a third value, `standalone`, for a repo that carries the
framework and syncs from the template on its own — typically one you share with other people, which
is neither your core repo nor a thin one to be stripped. Linked git worktrees are no longer counted
as separate instances either.

**What you need to do:** nothing is renamed and nothing breaks. Two minutes if you want the new
behaviour: put `#decide` on the lines in your to-do files that are actually waiting on *you*, with a
date, and `#revisit` plus a date on any figure or choice you know rests on an assumption. Then check
the `Kind` column in `ORGANIGRAM.md` — if you share a repo with other people, `standalone` is
probably the word you want. If you have a calculator or model built on a spreadsheet you still edit
by hand, say so: `lib/provenance.mjs` now records which file and which version each figure came from
and refuses to compute when the document underneath has moved, and that tool predates it.

## 2026-09-03 · MAJOR · What else is instructing your agent, and a clean start

The kit assumes one source of truth: this repo. Everything installed outside it and still loaded on
every session breaks that assumption quietly, and you cannot see any of it. A user-level `CLAUDE.md`
written for something else, plugins and skills installed months ago and frozen at that day's version,
MCP servers declared globally, scheduled tasks nobody remembers registering. Nothing announces itself
and nothing conflicts loudly: you just get an agent that ignores an instruction it plainly reads.
Found on a real first onboarding, where a newcomer's very first session behaved unlike everyone
else's, for exactly this reason.

`node scripts/check-conflicts.mjs` looks and says what it found. `--park` moves the safe ones aside
into a dated folder with a `RESTORE.md` saying how to put them back. It never deletes, and it never
touches a scheduled task or a settings file that also holds your preferences: those are reported with
enough detail to decide, and left alone.

The install scripts now run it while you are still sitting there, and hand whatever is left to your
first session. They also stop silently reusing a folder that already exists at the path you chose,
which is how a half-finished earlier attempt becomes the project: they offer a clean start and rename
the old folder aside. And the macOS script no longer eats its own questions when run the documented
`curl … | bash` way, which made it race to the end answering itself.

**What you need to do:** run `node scripts/check-conflicts.mjs` once, or just ask your agent "what
else is instructing you". If it lists a plugin or a global skill from an earlier experiment, let it
park them; if it lists a scheduled task you do not recognise, read the line before deciding.

## 2026-09-03 · MINOR · Your history is imported once; a connected mailbox is optional

`SETUP.md` now says how the past gets in: the first session sweeps what predates the kit (the
`fact-finding` recipe: agree the structure, decide which facts matter, sweep, record), and after that
each session ingests what its task needs through the connectors and the inbox. Keeping Gmail
permanently connected to the agent is therefore a personal comfort, not a piece of the system.

**What you need to do:** nothing. If you had connected your mailbox only because you thought the kit
needed it, you may disconnect it; nothing stops working.

## 2026-09-02 · MINOR · A one-page quick start to hand someone

`QUICKSTART.md`, at the root: the four accounts to create, the paste that installs everything, the
table of what plugs in and what deliberately stays out, the four settings worth making once (where
the repos live, auto mode, the model, and spending effort per task rather than switching model), a
first use case that is real work rather than a demo page, and the three publishing doors. It
exists because `SETUP.md` is written for the person doing the setup, and what people actually needed was one page to send ahead of it.

**What you need to do:** nothing, unless you onboard someone. Then send them that page rather than
writing your own summary, since yours cannot be corrected once it is sent.

## 2026-09-01 · MAJOR · Tools that were quietly flattering you, and a rule about spreadsheets

Four things this release stops your agent from getting wrong, all four found by people running this
kit on real files rather than by any test here.

**The error report was making your project look better than it is.** It prints how many of the
mistakes it has logged now have a real guard rather than a written rule, and that number is the whole
point of keeping the register. It was counted wrong: entries guarded only by a rule fell into neither
column, and two kinds of guard the register had grown were not recognised at all and simply vanished
from every total. On this repo's own register the report claimed one guarded and none unguarded, over
six. It now refuses to print any of those figures unless they add up to the total, and the same fix
went to the count of mistakes a person had to catch, which was reading 2 of 6 where the truth was 5.

**The fleet check was arguing with the kit's own architecture guide.** If your organization has grown
past one repo, `docs/one-repo-or-several.md` tells you to build a router holding the method plus thin
repos holding their own material. The fleet check then treated every one of those thin repos as a
broken instance and told the owner to install the framework in each. On one organization that was ten
repos flagged forever, unresolvable without wrecking the structure. It now reads a `Kind` column in
your `ORGANIGRAM.md` repo table (`router` or `satellite`), asks of a satellite only what a satellite
can have, and says out loud when it is guessing because the column is missing.

**A new check asks whether your `.gitignore` is telling the truth.** An ignore rule only ever applies
to files git is not already tracking, so adding one for `*.xlsx` to a repo that has been committing
spreadsheets for months changes nothing whatsoever, and the rule then sits there looking like a
promise. An owner had four files of a financial model tracked under a rule forbidding exactly them.
`node scripts/check-freshness.mjs` now names the rule and the files that contradict it, and says the
two things that are easy to get wrong when fixing it: taking a file out of git keeps it on your disk,
and it does not remove it from history that is already pushed, so a password that was in there has to
be changed rather than hidden.

**And a new rule about any tool built on a spreadsheet you maintain by hand.** Two failures on the
same evening, on a model carrying decisions nobody wants to get wrong. The agent re-implemented a contractual
formula instead of reading the owner's workbook, froze the terms it could not establish, called the
result "the contractual envelope" and then flagged two of her own scenarios as contractually
impossible, at blocking severity. Separately, it read a stale duplicate of her spreadsheet, reported
six errors that existed in neither of her files, and when she opened the right one and the checks went
green, congratulated her for having fixed them. She had fixed nothing.

The position the kit now takes is that **the tool is the source of truth and the spreadsheet is an
input**, because a spreadsheet can be copied and a copy is indistinguishable from the original. That
makes the import the dangerous part, so: every document read is recorded by path, hash and date, and
a mismatch stops the tool rather than warning it; an export is never a source and its age is compared
to the original's; nothing may conclude that a problem was fixed without comparing before and after
on the same file; a check's severity can never exceed the weakest status of its inputs, so a check fed
by an untraceable figure cannot be blocking; and no message may say "the contract", "the law" or
"guaranteed" without printing the clause. Your own hypotheses are not errors, and a low scenario is
meant to be low.

**What you need to do:** two minutes. Open `ORGANIGRAM.md` and add a `Kind` column to the repo table,
with `router` for anything holding the framework and `satellite` for a repo that only holds its own
material. If you have one repo, write `router` and forget it. Then ask your agent to run the freshness
check once, because the `.gitignore` question has never been asked before and the answer is per-repo.
If you have a calculator or model built on a spreadsheet you still edit by hand, say so: that tool
predates every rule in the last paragraph and wants a pass to add the provenance and the refusals.

## 2026-09-01 · MAJOR · Your team files now track what you owe people, not just what was said

If you use the `team` skill, it kept two kinds of file: who someone is, and what was said in each
1:1. Neither answers the questions you actually get asked six months later. What did they ask me for,
and did I ever deliver it? What did I tell them, and did it land? What is open on their job, their
goals, their performance? Each of those now has its own register per person, dated, so that ageing is
visible: a request for regular feedback, asked for by name and still unserved after two conversations,
reads as five weeks rather than as a line in an old note.

Two other things changed, and both came from real damage. **A meeting your reports are not in decides
things about them** — a scope, a job description, a performance plan, the end of a trial period — and
none of it shows up in their 1:1, so a picture built only from 1:1s is missing the half where the
decision was made. Your agent will now ask which of your recurring meetings has that character and
read it too, keeping only the part about people. And **a directive decided in a room the person was
not in does not exist yet**: it is now recorded as undelivered, because the alternative is that four
of them arrive at once, in writing, and land as an indictment.

There is also a harder line on what may be written at all. A gitignored folder is backed up, synced
and re-read by later sessions, so local is not private: nothing about a person's health goes in a file,
and neither do pay figures. The work fact is what a manager needs (an accommodation exists and what it
requires; a pay conversation is open and who owns it), and the medical fact belongs to the doctor.
Finally, if you ask for something like a "PIP" or a "warning", your agent will look the term up
against your own jurisdiction before drafting: in several of them a performance shortfall is
explicitly not misconduct, and writing a goals plan and a disciplinary step into one document damages
both.

One more fix, and it is the one that would have bitten you silently. Your agent used to look for your
one-to-ones by their title, so a sync called anything else was invisible, and it would then tell you a
person had no one-to-ones at all. It now identifies meetings by **who was in them**, which is the line
every auto-notes tool puts in its header: two people is a one-to-one whatever the meeting was called.
On the dossier that produced this, six syncs with one report had been invisible for six months, under
names like "Weekly catch-up" and "<project> prep".

There is also a new file per person, `feedback.md`, and it is the one to look at first. It records the
feedback each person was given: by whom, when, in what setting, how it landed, and whether it was
actually said to them at all. On the team that produced this, that last column was the finding: half
the appreciations had been formed in the person's absence, one criticism had been given to a colleague
rather than to the person, a relayed compliment turned out to be false and was denied, and two solid
pieces of praise had never reached anyone. If more than one person gives feedback on your team, your
agent will also propose sharing that part of the files between you while keeping the raw 1:1 notes
private, since feedback one of you gives is worth nothing if the next one does not know it was given.

**What you need to do:** nothing, and nothing you have is renamed. The new files appear the next time
you sync your team. If you sit in a leadership or partners' meeting where people are discussed, tell
your agent which one it is: that is the one thing it cannot find on its own.

## 2026-08-31 · MAJOR · Your agent now offers to build the tool instead of answering the question again

If you keep coming back to the same subject — where you stand on a tax position, what the retirement
picture looks like, whether the runway holds — and the answer is a figure assembled from several
places, your agent will now stop answering and offer to build you a small tool for it. It should say
what the tool would hold, what it would check, and what it would cost to make.

The reason is that a good answer feels like the end of the conversation, so a subject that deserved
its own tool stays a conversation forever: the same arithmetic redone by hand each time, from
whatever that session happened to remember, with no two answers computed the same way. Each one
looks right. You would not know an app was an option, so nobody was ever going to ask for it, and
waiting to be asked was the same as deciding there would not be one.

What those tools must now do is the part that matters. Every figure traces back to a sourced entry,
totals are recomputed as they are displayed rather than stored, and when a projection stops
reconciling with what it was built from, it refuses to show you the chart and shows you the two
numbers and the gap instead. A rule written down is re-read by someone who already believes it; a
rule inside the recomputation gets to say no.

**What you need to do:** nothing. If your agent offers to build something and you would rather it
just answered, say so — but ask it what the tool would have checked before you decide.

## 2026-08-31 · MAJOR · The fleet check was giving wrong numbers, and said "wired" without knowing

If you have ever run `check-fleet` from your own project rather than from the kit, every "N template
commits behind" it showed you was wrong. It read the template's position from whichever repo it was
started in, so the figure was really your own commits since you last took an update: plausible,
moving the right way, and growing the harder you worked. On this machine the same scan said one
project was 12 commits behind from the kit and 189 from inside the project. A project already up to
date came out as "cannot compare" rather than fine. It is fixed: the template is now found by its
address wherever it sits, and when there is no copy of it on the machine the scan says so instead of
printing a number.

Two other things it was telling you without knowing. "news: wired" only meant the line was present
in your settings; it never meant the update notice had run. Someone ran a month of sessions being
told he was wired, on a machine with no Node, where that notice fails silently by design. It now
leaves a trace each time it runs, and the scan reports what it finds rather than what was intended —
so expect "no receipt yet" on your projects until each has pulled this and opened one session. And
the scan now tells you when the copy on your disk is behind its own origin, before any verdict it
draws from it: a clone four weeks old made a perfectly healthy project look broken.

It also stopped needing a copy of the kit sitting beside your projects, which most machines running
one do not have. Each project is now measured against the `template` remote it already syncs
against, so the figure exists for the person who actually needs it rather than only for whoever
keeps the kit checked out.

**What you need to do:** nothing, beyond re-running the check if a number from it worried you. If
you were told a project was not wired, look again after it has pulled this.

## 2026-08-28 · MAJOR · Your agent checks the words you use, and teaches you the ones it corrects

When you use a term that has a definition behind it — legal, tax, contractual, medical, technical —
your agent now checks it is the right one before building anything on it, instead of adopting your
wording and carrying on. When it is the wrong one, it tells you which term is right, why the two
differ, and what changes because of it, so you come away knowing the distinction rather than having
been quietly corrected. You are the one who will use the word in a meeting where it is not there.

The neighbouring word is the dangerous one: two terms that sound interchangeable can describe
completely different arrangements, and once the wrong one is in a file, everything written from it
is consistent and wrong, which is why re-reading never catches it. This came from someone running
this kit who found a whole file built on the wrong one of two legal terms.

**What you need to do:** nothing. Expect your agent to query a word now and then. If there is a
subject where you already know the vocabulary better than it does, say so and it will stop.

## 2026-08-28 · MINOR · An update you posted from your phone shows that it went

Post an update on an item and the list now marks that item, and keeps the mark after you close the
tab. If the list you are looking at is a step behind what is in the file — a page rebuilt at the
last deploy, a refresh that failed — your update is shown anyway, with a note saying so, instead of
vanishing until the next deploy and leaving you wondering whether it left. Nothing is marked before
the repository confirms it, so the mark never claims something that did not happen.

**What you need to do:** nothing. Redeploy the to-do app when convenient.

## 2026-08-28 · MAJOR · The to-do app stops losing edits, and stops lying about them

Three faults found by comparing the kit's app with an intranet built on it, all of
them silent, all of them fixed.

**An edit that failed to save is no longer thrown away.** When the network dropped or
GitHub refused, the queue discarded the batch: the screen kept showing the tick you
made, the file never got it, and only a reload revealed the gap. The edits now stay
queued, retry on their own, and the app keeps saying "unsaved" until they land.

**A change the server refused now says so on screen.** Ticking an item someone else
had already deleted looked like it worked. Refusals appear under the header instead.

**A tick made at half past midnight, or in a tab left open overnight, gets today's
date.** It used to take the UTC day, computed when the page loaded — so an evening in
Paris was dated yesterday, and a tab open since Monday dated everything Monday.

The Worker also checks a batch before applying any of it (a cap on size, the shape of
each id and date), and refuses the whole batch rather than half-applying something
that did not come from the app.

**What you need to do:** nothing. Redeploy the to-do app when convenient.

## 2026-08-27 · MINOR · The preflight check no longer calls a register it cannot read "empty"

Found the first time a project hand-started its incident register from the schema example: the
example shows one entry, so the file came out as a bare list rather than wrapped in
`{ "version": 1, "incidents": [ … ] }`. The check parsed it, found nothing where it looked, and
announced the register was empty — over two entries that were sitting right there. That is the same
confusion between "read it, nothing in it" and "could not read it" that the register's own first
entry is about, one level further down. There is now a fourth answer that names the shape problem
and says the entries exist but are invisible to the run.

**What you need to do:** nothing, unless a preflight run tells you your register's shape is
unrecognised — in which case wrap your entries as the schema shows and they come back.

## 2026-08-27 · MAJOR · Two sessions at once no longer lose each other's work in the index

If you ever have two Claude sessions open on the same project, this one matters. Git's staging area
is shared between them, so a file one session prepared but had not yet saved gets swept into the
next commit the other session makes, landing under a message about something completely different.
It happened here today: two framework files were published inside commits about two unrelated
people. The rule your agent now follows is to prepare and save in one step, never to leave work
sitting half-saved.

The upgrade guide also warns that a first-time adoption installs every framework file your project
does not already have, not only the ones you never edited. On a project that has drifted from the
kit's shape that can mean a second hosting config, or a module your own rules do not allow. Your
agent is now told to read that list and delete what does not belong before saving, and deletions
stick.

**What you need to do:** nothing to install. If you work in more than one session at a time, expect
your agent to save its own work sooner rather than leaving it staged.

## 2026-08-28 · MAJOR · The scheduled work is versioned now, and offered rather than imposed

Anything your agent runs on a schedule lived only in the scheduler's own folder, which is not a git
repo. So a routine did not survive a machine being lost, could not be handed to anyone, and could
rot invisibly: one real case sat two months past its retirement still telling an agent to open a
browser at an account that was no longer the right one, and read the wrong mailbox when something
invoked it.

Shareable routines now live in `routines/`, versioned with everything else. The first is the monthly
freshness sweep, which asks the question nothing else asks: is what you published still there, and
is what your repo says about the world still true. Setup lists what is available and installs
nothing without your yes, because a routine writes a schedule on your machine and then acts while
nobody is watching.

**What you need to do:** nothing, unless you already run scheduled tasks. If you do, two things are
worth a look. Anything tied to one person's mailbox or accounts should stay in their own repo rather
than move here. And when you retire a routine, deregister it **and** delete its file in the same
change: removing the folder alone leaves the scheduler holding an entry, and deregistering alone
leaves runnable instructions on disk. Either half on its own leaves something that still looks live.

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

**What you need to do:** nothing. Your agent reads this file on its own before acting on real data
or letting a figure leave the repo.

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
after pulling this update — `TEAM_DOMAIN` (`https://<your-team>.cloudflareaccess.com`) and
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
