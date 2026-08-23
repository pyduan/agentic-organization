# How this goes wrong

Seven families of mistake, distilled from a real project's incident register: a few dozen errors
logged over two days of intense work, on a file that mattered, by an AI following this kit. They are
not exotic. Most of them are sound reasoning applied to a corpus nobody opened.

Read this before acting on real data, before a figure or a claim leaves the repo, and whenever you
are about to build a tool. The `reflect` skill uses the same seven names when it logs an incident
(`source/quality/README.md`), so the families here and the register there stay one vocabulary.

Two findings about the *shape* of these errors, before the list:

- **In that register, more than half were caught by the owner, not by the AI.** Those were the ones
  visible from their screen. Every rule below exists so the next one is caught earlier, and the
  share the owner has to catch is the number that matters.
- **Three families cannot be caught by any check.** For those, the parade is a rule about how you
  write, not a test you can run. They are marked below. Do not dress a rule up as a safeguard: the
  register's most honest column is the one that says *nothing guards this yet*.

## 1 · Acting before looking

**The mechanism.** The reasoning is fine; the corpus was never opened. It takes four shapes: asking
a question whose answer sits in a folder named after it; commenting on a document without checking
whether a later one replaced it; writing a tool to move files before inventorying what is there;
designing rules to save a resource nobody measured. In each case the missing gesture cost seconds
and its absence cost hours, and once, files.

- **When something seems missing, the default hypothesis is "I searched badly", never "it does not
  exist".** Absence of evidence in what you happened to read is not evidence of absence.
- **Search by question, not by topic.** A corpus chosen because it is "about" the subject will miss
  the folder named for the exact document.
- **Never comment on a document without looking for its successor**: search its name plus
  *amendment*, *new*, *v2*, *replaces*. That is part of reading it, not a finishing touch.
- **Do not offer to search. Search.** "I can look through your files if you like" asks the owner to
  price a cost they cannot see. Do it in the same turn, then report. It only becomes a proposal if it
  is genuinely long or depends on a choice that is theirs.
- **Inventory before you build.** Before writing anything that moves, deletes or transforms files:
  list what exists, what is duplicated, what is already elsewhere, and what is actually taking the
  space. Machinery built blind acts on files whose status nobody established.
- **Measure the constraint before designing around it.** Elaborate exclusion rules to save space
  that was never scarce is work that looks careful and is not.
- **Never ask a third party for something your own files answer.** A question in a letter to a
  lawyer, an accountant or a partner costs money and dilutes the real questions.

## 2 · Status of information *(no check can catch this)*

**The mechanism.** Something gains rank without gaining evidence. A "to verify" becomes a fact by
being quoted; a possibility becomes a plan; an inherited assumption becomes a foundation. The status
was written *beside* the value, in a comment or a parenthesis, so the first reader sees the caveat
and the second copies only the number.

- **Status travels with the value or it does not exist.** Make it a field, not a remark: every
  figure that leaves this repo carries `established` / `conditional` / `assumed`, in the data
  structure and in the sentence that displays it.
- **A next step that depends on something uncertain starts with "if".**
- **Never explain a discrepancy with a plausible guess.** Trace it to its cause, or write that you
  do not know. A guess left in the file becomes the reason, and it makes a sound calculation look
  suspect.
- **An assumption inherited from earlier work arrives without its status.** When you build on
  something you did not establish, say so in the same sentence, with what it changes if it is wrong.
- **Information about yourself, received from someone else, is verified like anything else.**

## 3 · Producing and reading figures

**The mechanism.** The number is wrong, or right and misread, or right and measuring something else.

- **One place produces a number; every other place points at it.** A reference points to where the
  figure is computed and tested, never to another display of it. Copying is the cheapest gesture at
  writing time and the most expensive at the first correction.
- **Provenance is not precision.** A genuine document can mention a figure in passing. Before using
  it, ask whether the document *had that figure as its subject*.
- **A reconstruction only verifies something if it predicts more values than it consumes free
  parameters.** Solving for the unknown that makes the answer come out is not a check, however
  satisfying the arithmetic looks.
- **The first measured point that shows an effect is not the threshold.** Derive the boundary, then
  use measurement to confirm the derivation.
- **Ask what your measuring tool measures.** A size, a count, a quota can each be reported in a unit
  that is not the one that binds. Before announcing a gain, verify it on the quantity that matters.
- **Before declaring an error in something the owner built, establish what it was trying to
  establish.** A model answering a different question than yours is not a broken model, and they
  usually had a reason. Ask for it.
- **A figure without its frame of reference is worse than a wrong one**, because nothing looks
  incorrect and nothing can be corrected: give the date, the scope, and who it applies to.

## 4 · Silent expiry *(no check can catch most of this)*

**The mechanism.** The sentence was true when written. Nobody touched it. It is false now. This
family is invisible to every other kind of check, because at the moment of writing nothing was
wrong.

- **Never write in prose a number the machine already knows.** Count it at display time, or phrase
  the sentence so it stays true without the number.
- **When a fact falls, sweep every occurrence of it** — every repo, every app, every summary, every
  decision that rested on it — not only the file where you noticed. Correcting the analysis in front
  of you and stopping there leaves the stale version reading like current information elsewhere.
- **Screen the decisions too, not just the numbers.** A decision cites its consequence, not the fact
  behind it, so no keyword search finds it. The owner keeps being asked to arbitrate something that
  no longer exists. Re-read open decisions against anything that changed today.
- **The repo is not the app.** Having fixed a file says nothing about what the deployed page shows.
  To claim something is up to date, look at the thing itself.
- **Re-read a long deliverable whole before handing it over.** Written over hours, its opening
  paragraph knows less than its closing one. Three signals mean re-check a passage: it asks for
  something already obtained, it claims ignorance, or it quotes a figure from elsewhere.
- **A retracted claim stays retracted across every project.** Corrections are remembered where they
  were made; the person you are talking to is the same person in all of them. Fix the thing that
  produced the claim, rather than commenting on it.

## 5 · Actions on files and the machine

**The mechanism.** Acting on real data through an unverified model of the system. This is the family
that destroys things, and the one where the AI's confidence is least earned.

- **A safety guarantee from someone else's API is a claim.** Test it on one item, then in a small
  batch, before acting in bulk, and verify the real state independently afterwards — never trust the
  tool's own report of success.
- **Never document an untested assumption as if it were verified.** A reassuring comment in a script
  makes the assumption invisible to review, which is worse than not writing it.
- **A destructive option needs an explicit confirmation and a copy taken first.** "Start over" used
  for what was really a resume has thrown away hours of finished work.
- **Every destination keeps a backup.** If an option removes the safety net, that disqualifies it;
  it is not a trade-off to rank against speed. If the safe route is blocked, understand why rather
  than routing around it.
- **When the source is about to disappear and space allows: copy everything, sort later.** Sorting is
  still possible on a complete copy. It is not on a partial one.
- **Measure a shared resource before consuming it, and give it back.** Disk, quota, bandwidth: other
  work, and other sessions, are using the same machine.
- **Probe the system rather than assuming it**, especially for permissions and paths. Three lines of
  probe beats a confident model, and it is the owner who pays for a wrong one.

## 6 · Handover and the relationship

**The mechanism.** The work is right and arrives in a form, a place, or a vocabulary that makes it
useless — or it spends the owner's time on something that was yours to do.

- **The deliverable is the app, not a document.** A standalone note ages the moment a number moves,
  and gets lost. If the information is not reachable in its place in the app, the work is not done.
- **Only ask the owner to do what only they can do.** The cost of a bad instruction is not
  symmetric: you lose a turn, they lose an afternoon. Probe first, then act yourself where you can.
- **Never hand back a judgement they delegated.** "Tell me when the upload is finished" for
  something they cannot observe is a refusal dressed as a question. Put the criterion in code, and
  trigger the next step yourself.
- **Rigour is not jargon.** Define every technical term at first use, in the sentence, and name
  things by what they do. Keep the formal reference after the explanation, as proof, never as the
  explanation.
- **Never designate something with a definite article that the owner has not been shown.** "The ten
  documents" means nothing to a reader who was never shown ten documents.
- **Next steps must be actionable today, by someone named.** Something that cannot be known yet is a
  wait: it belongs on a date. Something a contract or a process already imposes is a date to verify,
  not a task. Filter every line through both tests before showing the list.
- **Reconcile open questions with what has been learned since.** Present a question as open only
  after checking it was not answered elsewhere, and close it *with its answer and source* rather than
  deleting it, so it does not come back next week.
- **A wrong answer you gave, once corrected, stays visible with its correction.** Deleting it costs
  the owner the ability to trust the rest.

## 7 · Parallel sessions

**The mechanism.** Several sessions on the same repos, at the same time. None of these errors exist
in a single session, and they get more likely exactly when work is going well.

- **Commit only the files you touched, named one by one.** A blanket `git add` has carried away
  another session's work in progress.
- **Ownership comes from a file's history, not its location.** Read it before editing something
  outside your own scope, and tell the session that actually owns it.
- **Write down who owns what** when more than one session is running: a two-column note in the repo
  (who decides what, who writes where) is enough, and it has to exist before the collision.
- **After changing anything shared** — tokens, a stylesheet, a helper — check every consumer of it.
- **One door per subject.** Two sessions each building their own complete home page produces two
  pages that will disagree on the same figures by tomorrow.
