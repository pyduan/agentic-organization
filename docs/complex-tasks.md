# Running a complex task

For analysis work, and for anything with several moving parts where being wrong costs something.

`fact-finding` is the recipe for *what do we actually know*. This is the recipe for *why are we
doing this, and how do I know I have not repeated a mistake that was already paid for once*. Four
moves, in order, and the failure at every one of them is the same failure: starting at the
deliverable.

## A · The objectives and the constraints, before any plan

Write down what the work is for before deciding how to do it.

**Objectives**: what decision changes because of this, who reads the result, what has to be true for
it to be worth anything. **Constraints**: what it must respect. Money, time, data that must not
move, people who must not be contacted, a legal or contractual limit, a promise already made.

**Ask rather than assume.** Ambiguity resolved silently is a choice made on the owner's behalf and
not reported. If two readings of the request lead to materially different work, that is a question,
and it is far cheaper before the work than after it. Routine judgement calls stay yours; a fork that
changes the deliverable is theirs.

What this prevents is not a wrong answer. It is a right answer to the wrong question. A real case:
a machine's disk was full, and the instruction was to move a large folder to cloud storage. The work
copied everything faithfully and freed not one byte. The reason for the instruction was written,
dated and quantified at the top of the same file. Nobody said the original problem was still
standing, and the owner found out three days later from a passing sentence.

Where it lives: for tracked work, the charter in `projects/<slug>/`. Otherwise, the top of the
working note. It has to sit somewhere a later session will read, because a later session did not
hear the conversation.

## B · Every plan checked back against them

A plan gets held against the objectives before it runs, not after it has produced something.

Put them side by side and go line by line: which objective does this step serve, and which
constraint could it break. **A step that serves no objective comes out**, and that is usually the
step hardest to drop, because work that serves nothing is often the most satisfying to do. The
best-executed analysis in one incident register was withdrawn at the end because no decision
depended on its result. Every safeguard had checked that the number was true. Not one of them
checked that it was useful.

Then check again at handover. A deliverable written over several hours freezes what was known at the
moment each sentence was typed, so its opening paragraph knows less than its closing one. Three
signals mean re-read a passage before it goes: it asks for something already obtained, it claims
ignorance, or it quotes a figure that came from somewhere else.

## C · Subdivide, because the owner may not be technical

A complex task handed back whole makes the owner the integrator, and integrating it was the job.
Cut it up before starting, and say which parts are running now and which are waiting, on what.

A subtask is cut properly when it has all four of these:

- **One question** it answers, written as a question.
- **One output** someone can judge without holding the rest of the task in their head.
- **The guide that governs it**, from the routing table in `CLAUDE.md`. A subtask that writes words
  answers to `voice.md`; one that touches a to-do answers to `todo.md`; one that publishes a figure
  answers to `source/facts/`. Different subtasks of the same task obey different registers, and that
  is the point of splitting them.
- **Its own checks**, from D below. The families that apply to a calculation are not the ones that
  apply to a deploy.

Name them in the owner's vocabulary, never the system's. They open a thing to find out where a
subject stands, not to find out which folder holds what. "This file has no app" was heard as "there
is nothing here for this", and it was perfectly exact in the technical sense.

## D · Preflight: run the known failures as a test suite

Before delivering anything where being wrong costs something, run both lists:

```bash
node scripts/preflight.mjs --task "check the price adjustment and publish it"
```

It prints the general families from `docs/failure-modes.md` that the task touches, and every
incident this project has already logged in those families from `source/quality/incidents.json`,
each with what now guards it. Name the families directly (`node scripts/preflight.mjs numbers
destructive`) when you already know which ones apply, and add `--full` for the whole rule rather
than its claim.

The project's own incidents print first, and they are the reason the command exists. The general
list is what every project running this kit has learned. The register is what **this owner** has
already paid for once. Repeating one of those is worse than making a new mistake, because it says
the register is not working.

Two rules about running it:

- **Anything you cannot tick goes in the handover.** An unticked check, reported, costs a sentence.
  The same check quietly skipped costs whatever the number was going to be used for.
- **An entry whose guard is `none` means you are the check.** Read those slowly. The register keeps
  that column honest on purpose rather than dressing a rule up as a safeguard.

Then close the loop. A mistake found this way, or found by the owner, gets logged the same day with
the `feedback` skill. A register that only grows when someone remembers to write in it stops being a
test suite inside a week, and the command above goes quiet exactly when it should be loudest.

## Why the order

Each move exists because the one before it failed somewhere. Plans get checked against objectives
because plans that were never checked produced faithful work on the wrong problem. Tasks get
subdivided because a task delivered whole gets judged whole, and an owner who cannot judge it either
accepts all of it or none of it. The preflight exists because the incident register was being
written and never read, which made it a diary.

Skipping straight to the deliverable is not faster. It moves the cost from before the work to after
it, where it is paid by the owner instead of by you.
