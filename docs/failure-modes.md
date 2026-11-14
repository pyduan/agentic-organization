# How this goes wrong

Seven families of mistake, distilled from the incident registers of projects running this kit. Each
rule is one claim and a test you can run by hand. A ⛨ names the mechanism that refuses the mistake
today; a rule without one has you as its only check. The case behind each rule is in
[failure-cases.md](failure-cases.md), under the same id.

Read the families a task touches before acting on real data, before a figure or a claim leaves the
repo, and before building a tool. `node scripts/preflight.mjs --task "…"` picks the rules a task
touches and prints this project's own past misses beside them. The register files every entry under
these seven names (`lib/register.mjs`), so both keep one vocabulary.

The mechanisms: `node .claude/hooks/turn-check.mjs --list` prints the checks a turn has to pass
(`turn-check:<name>` below), `.claude/hooks/send-guard.mjs` holds a message until a person says yes,
and the `check-*` scripts run in `npm run check`. When one blocks, do the check or say exactly what
you did and did not look at.

## Most broken

Computed, never written here: `node scripts/preflight.mjs --broken` ranks the mistakes this project
repeated, from the `repeat_of` links in its register, and every preflight prints the top of it. A
repeat says a rule did not hold; when you fix one, ask what would refuse it before adding a sentence
([failure-cases.md ▸ About this page](failure-cases.md#about-this-page)).

## 1 · Acting before looking

**The mechanism.** The reasoning is fine; the corpus was never opened.

- <a id="absence"></a>**Something that seems missing was searched for badly until a calibrated
  search says otherwise, and no search proves an absence.** Test: a case you know exists shows up in
  the same query, the answer names the dates and folders the search covers, a filtered sweep says
  what it left out, and *missing* is written with how you checked. ⛨ turn-check:absence
- <a id="search-by-question"></a>**Search by question, not by topic or correspondent.** Test: the
  search reached where the answer would be filed (the folder named for the document, a call's notes
  and transcript), not only the mail with the other party.
- <a id="search-bounds"></a>**Bound a search by the question, never by convenience.** Test: the
  query ran again without its cap or filter, case-insensitive, with a figure in digits and in words,
  by probable author and by the period of the facts, through the thread's attachments; signed texts
  and working documents are reported apart.
- <a id="successor"></a>**Look for a document's successor before commenting on it, and for a
  screen's newest approved version before templating it.** Test: a search on its name plus
  *amendment*, *new*, *v2*, *replaces* (for a screen, its later commits and approvals) ran first.
- <a id="search-dont-offer"></a>**Do not offer to search. Search.** Test: the turn that could say
  "I can look" is the turn that looked; a proposal only when the search is long or the choice theirs.
- <a id="inventory"></a>**Inventory before you build anything that moves, deletes or transforms
  files.** Test: a listing of what exists, what is duplicated, what is already elsewhere and what
  takes the space comes before the tool's first line.
- <a id="measure-constraint"></a>**Measure the constraint before designing around it.** Test: the
  design note quotes the measured value and the command that produced it.
- <a id="provider-settings"></a>**Open the third party's own settings before designing around
  them, read what is greyed out, and turn a constraint that decides the design into a check.** Test:
  the note names the screen read, and breaking the constraint fails a build.
- <a id="own-files-first"></a>**Never ask a third party, or the owner, what your own files
  answer.** Canonical: `source/formats/message.md` ▸ *Every ask passes two tests*. Test: each question
  survived a search of the repo, the project folder and the thread.
- <a id="retrieving-not-reading"></a>**Retrieving is not reading, and a count someone will decide
  on is made by opening each item.** Test: before *missing* or *to request*, what the project already
  holds on the subject was opened (the owner's working files and undownloaded attachments included);
  items not opened are given as candidates.
- <a id="quote-clause"></a>**A summary never founds a conclusion: quote the clause, verify the
  article that carries the conclusion first, quote a closed list whole, and write out two
  near-identical acronyms.** Test: the conclusion sits beside the exact words of the primary text.
- <a id="read-to-end"></a>**Read to the end of the list and of the thread, and join each message
  of a group thread to its author.** Test: the answer cited is the last word on it in the thread, and
  each quoted sentence has a named author or says the name is missing. ⛨ turn-check:partial
- <a id="correction-authority"></a>**A correction is checked against the authority, never against
  a second document of the same kind, and a correction that removes is checked hardest.** Test: the
  fix cites the deed, register or primary text; a removed fact has a source that refutes it, not one
  that omits it.
- <a id="name-document"></a>**Name a document by what it is, not by what carried it, and say which
  version you kept.** Test: its type (resolution, deed, invoice) and version are named, and why the
  others are set aside.
- <a id="obstacles-by-nature"></a>**Enumerate obstacles by nature before publishing a date.** Test:
  the answer says which of legal, tax, contractual and economic were examined; with one missing it
  is an order of magnitude and says so.
- <a id="third-party-procedure"></a>**Before carrying out a procedure a third party fixed, reopen
  their text and tick each item.** Test: the checklist comes from their text, not the project's
  summary of it.
- <a id="trace-two-figures"></a>**Before asking the owner to choose between two figures, trace each
  to its origin.** Test: each carries its source and whether it was rounded.
- <a id="current-edition"></a>**Check which edition of an official text is current before opening
  it.** Test: the current edition is named and dated before the reading starts.
- <a id="open-method"></a>**Open a document before citing its method, and read a reachable source
  rather than ask its owner to confirm your reconstruction.** Test: the technique cited has a page
  in the opened document.
- <a id="truncated-source"></a>**A truncated source says nothing about what is missing from it.**
  Test: a source cut by a page limit, a preview, an output cap or a "show more" is named as cut, and
  nothing absent from it is called absent.
- <a id="inherited-missing"></a>**A "missing" inherited from a note, a register or another session
  is searched again before it blocks anything.** Test: the search that would find it ran in this
  session, and the answer gives its date.

## 2 · Status of information

**The mechanism.** Something gains rank without gaining evidence. The status was written beside the
value, so the first reader sees the caveat and the second copies only the number.

- <a id="status-field"></a>**Status travels with the value as a field.** Test: every figure that
  leaves the repo carries `established`, `conditional` or `assumed`, in the data and in the sentence
  that displays it.
- <a id="if-next-step"></a>**A next step that depends on something uncertain starts with "if".**
  Test: no step resting on an open point reads as unconditional.
- <a id="own-notes-refute"></a>**Before asserting a cause, read what your own earlier notes say
  against it.** Test: the dossier was searched for the symptom and the cause, and each contradicting
  entry is answered.
- <a id="no-plausible-guess"></a>**Never explain a discrepancy with a plausible guess; recompute a
  gap between two figures from the cells.** Test: the explanation names the rows that make the gap,
  or the text says the cause is unknown.
- <a id="omission-first"></a>**When the owner questions a figure that turns out wrong, assume an
  omission, never a choice.** Test: what they already said on it was re-read, and "I left it out" was
  tried before any rationale.
- <a id="inherited-assumption"></a>**An inherited assumption is labelled in the sentence that uses
  it, and a trial lists at its top every setting it carries over unasked.** Test: the sentence says
  what changes if it is wrong; the run's header lists the inherited settings.
- <a id="form-authority"></a>**The form of the work fabricates authority the content has not
  earned, so the tool separates what a document establishes from what the tool supposed.** Test: an
  exact count, a guarantee word or a severity each trace to a source or are marked as the tool's.
- <a id="outside-report"></a>**A report from outside is an input to verify, not a finding to
  adopt.** Test: the answer separates the premises you checked from the ones taken on the reporter's
  word and tells them which is which; an exemption granted on their classification prints it.
- <a id="delegated-finding"></a>**A delegated agent's finding is a lead, not a fact.** Test: the
  file that settles the claim was opened before relaying it, or the claim is given as the agent's.
- <a id="about-yourself"></a>**Information about yourself, received from someone else, is verified
  like anything else.** Test: the same source check as for any other claim.
- <a id="name-account"></a>**When something rests on an account, write the identifier the system
  displays, not an adjective.** Test: the account's identifier, read from the system, and which
  account holds the service.
- <a id="browser-account"></a>**Check which account a browser is signed into before driving it,
  and never fall back to a browser for a job a connector owns.** Test: a page naming the signed-in
  account was opened and matched; an API failure stopped the task instead.
- <a id="category-identity"></a>**A category is not an identity.** Test: membership was tested
  against a list (compare, count) rather than reasoned from features; admitting the gap does not
  license the conclusion.
- <a id="dated-document"></a>**A dated document does not date the deadline it records, and a
  threshold's date is the day it is crossed.** Test: the date written down is the one the document
  says binds.
- <a id="term-of-art"></a>**A term of art is a classification, and the owner's is unverified until
  checked against its definition.** Test: the definition is cited from a source, and a wrong term
  comes back with the right one, the distinction and what it changes.
- <a id="ok-not-decision"></a>**An "ok" on a direction is not a decision on a result, and a
  decision carrying an order or an amount is read back in one line before it is written.** Test: the
  record quotes the owner's words and what they covered; on law, tax or a calculation it cites the
  text, never the owner. See `AGENTS.md` ▸ *A recorded decision is closed*.
- <a id="condition-travels"></a>**A condition travels with what it conditions.** Test: every
  copied block keeps its "if".
- <a id="claim-withdrawal"></a>**Withdrawing a claim needs the same evidence as making it.** Test:
  the primary source was opened before the retraction; the owner is the authority on the facts of
  their affairs, not on a rule of law.
- <a id="one-report-person"></a>**One report about a person is a data point, not a trait.** Test: a
  sentence about how someone behaves cites more than one occurrence, or says "once, on <date>".
- <a id="meeting-summary"></a>**An AI meeting summary is a lead: attribute by content, not by
  speaker label, and check ranges and figures against the transcript.** Test: each attributed
  statement and figure has its transcript passage.

## 3 · Producing and reading figures

**The mechanism.** The number is wrong, or right and misread, or right and measuring something else.

- <a id="one-producer"></a>**One place produces a number and every other place points at it; a bug
  fixed in one view is fixed wherever the quantity is computed.** Test: a grep for the quantity finds
  one computation, and the fix lists where it searched.
- <a id="provenance-precision"></a>**Provenance is not precision.** Test: the document cited had
  that figure as its subject.
- <a id="reconstruction"></a>**A reconstruction verifies something only if it predicts more values
  than it has free parameters.** Test: count both.
- <a id="independent-check"></a>**A check that reuses the logic or the assumption it checks cannot
  see its errors: check by another path.** Test: the verification used another program, session or
  decomposition, and read each case as the end reader will.
- <a id="threshold-derived"></a>**The first measured point that shows an effect is not the
  threshold.** Test: the boundary was derived, then confirmed by measurement.
- <a id="measuring-tool"></a>**Ask what your measuring tool measures.** Test: the gain is stated in
  the unit that binds.
- <a id="owner-model-purpose"></a>**Before declaring an error in something the owner built,
  establish what it was trying to establish.** Test: its purpose was read or asked first.
- <a id="frame-of-reference"></a>**A figure without its frame is worse than a wrong one.** Test:
  date, scope and who it applies to sit beside it.
- <a id="subtract-contents"></a>**Before subtracting two amounts, say what each one contains.**
  Test: at the line that concludes, both contents are named, and a cost is compared to a cost.
- <a id="figure-sentence"></a>**Keep a figure with the sentence that says what it is, and let one
  expression name one amount in a page.** Test: following the amounts step by step, no expression
  changes meaning, a ratio compares like with like, and the heading agrees with its caveats.
- <a id="log-line"></a>**Before counting a machine log, establish what one line represents.** Test:
  the key that makes two lines the same fact is named.
- <a id="app-index"></a>**Count what an application holds through the index it trusts, and publish
  no gap you cannot explain.** Test: the count comes from the application's index or API, not the
  files on disk.
- <a id="comparison-direction"></a>**The direction of a comparison lives in the argument order.**
  Test: the output names both sides, and an announced loss agrees with an independent quantity.
- <a id="adjustment-base"></a>**An adjustment carries its base, because the base decides the
  sign.** Test: applied to the known series, every result is still possible.
- <a id="balance-sheet"></a>**Write the balance sheet before and after ascribing an effect to an
  operation.** Test: a neutral operation shows its effect in tax or income, never in the net.
- <a id="indicator-conclusion"></a>**Before citing an indicator, name the conclusion it will invite
  and check that conclusion; measure a fix by what would change if it worked.** Test: the indicator
  answers the question asked (who detects, how fast, whether the mechanism recurs), never a count of
  categories.
- <a id="no-balancing-line"></a>**A breakdown has no balancing line.** Test: the lines fall on the
  total, or the gap is shown.
- <a id="decompose-total"></a>**Decompose a total before calling a difference an error.** Test: each
  side is broken into terms that measure the same thing.
- <a id="reconcile-subtraction"></a>**"They reconcile" is a subtraction, done and read.** Test: the
  gap is printed. ⛨ turn-check:concordance
- <a id="exact-equality"></a>**An exact equality between two scenarios is suspect until
  explained.** Test: look for one input counted twice.
- <a id="extreme-result"></a>**An extreme result, a total that a decision did not move, or a
  universal claim about people stops you before it is written.** Test: the neighbouring rows were
  checked, the total moved, the named list was counted.
- <a id="two-readings"></a>**Two readings are not a trend.** Test: three points or more, or the
  forecast says it rests on two.
- <a id="counterfactual"></a>**A counterfactual is labelled every time it appears, and a figure
  shown then invalidated is corrected out loud.** Test: every occurrence carries the label.
- <a id="pass-not-measure"></a>**A pass is not a measurement.** Test: "passed, unmeasured", with the
  case that was measured named, unless a margin was measured.

## 4 · Silent expiry

**The mechanism.** The sentence was true when written. Nobody touched it. It is false now.

- <a id="number-in-prose"></a>**Never write in prose a number, or anything that depends on an order
  (a rank, a maximum, "the main one"), that the machine already knows.** Test: it is computed at
  display time, or the sentence stays true when the number changes.
- <a id="sweep-fallen-fact"></a>**When a fact falls, sweep every occurrence of it, and a rule the
  owner states as "everywhere" becomes a check in the generator the same day.** Test: a grep across
  every repo, app, summary and decision that rested on it; outputs already delivered swept; a
  rounding step stays under a tenth of the smallest line it rounds.
- <a id="retire-routine"></a>**Retiring a routine deletes or caps its instruction file in the same
  change.** Canonical: `routines/README.md` ▸ *Retiring one*. Test: the deregistration and the file
  change sit in one commit.
- <a id="screen-decisions"></a>**Screen the decisions, not only the numbers.** Test: when a commit
  changes a fact file, `source/decisions.md` and the open `#decide` lines are grepped for that fact's
  terms and each hit is re-read.
- <a id="repo-not-app"></a>**The repo is not the app.** Test: "up to date" is read on the deployed
  page.
- <a id="pipeline-exists"></a>**Verify the publishing pipeline exists before trusting it; a
  one-line assertion in a guide is not evidence.** Test: the deploy source or the live URL was read,
  and a pipeline that can fail silently gets a string the live page must contain.
- <a id="reread-deliverable"></a>**Re-read a long deliverable whole before handing it over:
  written across more than one turn, or longer than one screen.** Test: a whole re-read that stops on
  any passage asking for something already obtained, claiming ignorance, or quoting a figure from
  elsewhere.
- <a id="claim-withdrawn"></a>**A claim you withdrew as wrong stays withdrawn in every project.**
  Test: what produced it is fixed, and a search of the other projects finds no copy.
- <a id="retired-file"></a>**A retired file does not know it is retired, and its contents read as
  instructions.** Test: a destination a file names is checked against `AGENTS.md` and
  `source/decisions.md` before following it; a working folder is cleared to the trash or a dated
  quarantine with an index, never `rm`.
- <a id="design-not-fact"></a>**A design is not a fact until it ships.** Test: the guide cites the
  merged file, the host or the run, not the plan.
- <a id="look-once"></a>**Look at the deployed thing once; never poll it.** Test: wait on the build
  log, load the URL once with a cache-buster, and load a page you did not touch before debugging.
- <a id="sweep-short-word"></a>**To sweep, grep the shortest distinctive word, never the phrase, and
  record a retired route's wording.** Test: the old wording is in
  `source/quality/retired-claims.json`. ⛨ check-retired
- <a id="short-lived-artifact"></a>**An artifact that expires soon does not earn the sweep, and
  saying so is the decision.** Test: the declined sweep is written down with its reason.
- <a id="generated-needs-generator"></a>**A file labelled "generated" needs a generator, a checker
  alone is half a fix, and a literal among extracted fields is the one value nobody verifies.** Test:
  one command rebuilds it with each row's own date, and CI runs it where no judgement is needed.
- <a id="follow-up-looking"></a>**"Follow up if nothing arrives" is closed by looking, not by its
  date.** Test: their messages since the day you wrote were searched. ⛨ turn-check:silence
- <a id="contact-dated"></a>**A contact found in mail is dated.** Test: the message date was read,
  and the same role searched in the last twelve months.
- <a id="signed-online-filed"></a>**A document signed online is filed the day it is signed.** Test:
  the document itself, not the platform's link, is in the repo that day.
- <a id="register-then-live"></a>**A register or a file about the world is read, then the live
  source is checked.** Test: the answer says which part came from the file and which from the
  source, with the date of the file's last pass.

## 5 · Actions on files and the machine

**The mechanism.** Acting on real data through an unverified model of the system. This is the family
that destroys things, so it is split by the moment each rule applies.

### Before you build

- <a id="safeguard-axis"></a>**A safeguard must not depend on the thing it protects against, and
  that is checked before the first line of code.** Test: two lists, what it protects against and
  what it needs to work, with nothing in both.
- <a id="ships-inside"></a>**A mechanism that ships inside the thing it monitors cannot reach the
  installations that predate it.** Test: name what reaches them; when it is a person, say so.
- <a id="own-clock"></a>**A guard runs on its own clock, never on the activity of the person it
  protects.** Test: what does it do if nobody touches the machine for a day?
- <a id="seen-effect"></a>**Nothing is in place until it has been seen to produce its effect once.**
  Test: it fired for real once; an access rule is read back from the application's policy list and a
  listed person gets through.
- <a id="alert-where-looked"></a>**An alert is read where people look, says once that things are
  back to normal, and a scheduler's "succeeded" means only that the session ended.** Canonical:
  `routines/README.md` ▸ *A routine that fails quietly*. Test: a separate check reads the artefact
  after the scheduled time.
- <a id="program-in-repo"></a>**A program that produces a delivered document lives in the repo from
  the first delivery.** Test: it is committed and pushed before the turn ends, scratch worktrees
  included. ⛨ session-end
- <a id="system-value"></a>**Before founding a rule on a system value, prove the program can obtain
  it in the conditions it will run in.** Test: it ran under the scheduler; when the value is closed
  off, the rule uses another lever.
- <a id="probe"></a>**Probe the system rather than assuming it, and know a probe is read-only before
  running it.** Test: a permission is read at its source before any hypothesis, and the command is
  not a shim that installs on first call.
- <a id="second-hypothesis"></a>**Stop at the first explanation that fits and you spend the day on
  variants of it.** Test: a second hypothesis is written down with the observation that separates
  the two, before acting; when two identical runs differ, the difference is the cause.
- <a id="one-parser"></a>**A check and the code that renders or loads the file share one parser.**
  Test: the check imports the renderer's parsing, and a generated file is loaded by the service that
  will read it.
- <a id="gate-runnable"></a>**A gate the author cannot run fails everyone, and a gate refuses the
  item at fault, not the whole publication.** Test: the deploy's rules run in the author's checks and
  in CI.
- <a id="build-is-write"></a>**A build is a write.** Test: `git status` after the build, and what you
  did not mean to touch is reverted before the commit.
- <a id="coverage-expires"></a>**A safeguard's coverage is a claim that expires.** Test: the list it
  covers is derived again from the folder today, and the check is fed one thing it must reject.

### Before you destroy

- <a id="device-accounts"></a>**Accounts that control devices, mail or backups are not automated
  without the owner's consent for that account.** Test: the stake (what stops, what can lock out) was
  stated and a yes given for that one account.
- <a id="privacy-boundary"></a>**What crosses a privacy boundary is checked before it crosses,
  comments included.** Test: mask by what may show, sample the output for names, and copy only what
  `git ls-files` lists. ⛨ check-leaks
- <a id="api-guarantee"></a>**A safety guarantee from someone else's API is a claim.** Test: one
  item, then a small batch, then the real state checked independently, before bulk.
- <a id="first-push"></a>**A repo that has never had a remote has never been audited, and the first
  push cannot be taken back.** Test: the `ignored` pass, the tracked files and the history read for
  secrets, then a private remote verified by an unauthenticated fetch, and a fresh clone that works.
- <a id="untested-comment"></a>**Never document an untested assumption as if it were verified.**
  Test: a reassuring comment names the run that proved it.
- <a id="rename-aside"></a>**A destructive option renames aside; it does not delete.** Test: the
  file and its index move to a timestamped name, and deletion is a separate act behind an explicit
  flag.
- <a id="destination-backup"></a>**Every destination keeps a backup.** Test: an option that removes
  the safety net is out, and a blocked safe route is understood rather than bypassed.
- <a id="copy-everything"></a>**When the source is about to disappear and space allows, copy
  everything and sort later.** Test: the copy is complete before any sorting.
- <a id="delete-forward"></a>**Never delete forward through an indexed collection, and verify a
  cleanup by recounting.** Test: the final count is read from the result, not from the operations
  requested.
- <a id="restore-reference"></a>**Never restore a file you do not own with a command that takes a
  reference state.** Test: the undo writes back exactly the bytes read before acting.
- <a id="integrity-source"></a>**A proof of integrity is worth something only if its source predates
  the damage.** Test: the reference's timestamp is older than the damage.
- <a id="rescue-untracked"></a>**A rescue that saves only what the tool knows about is not a
  rescue.** Test: `git status --porcelain` with untracked files, counted and shown, then each saved
  explicitly and the tree re-read.
- <a id="throwaway-remote"></a>**A condition that stops a publish is tested on a throwaway copy with
  a local remote.** Test: a clone whose origin is a local bare repo; a throwaway branch made from
  `origin/main` tracks it, so its upstream is unset before any push.

### While it runs

- <a id="empty-check"></a>**A check that examined nothing returns no verdict: "nothing to do" and
  "nothing seen" produce the same value.** Test: a favourable verdict needs no anomaly and at least
  one item checked; a zero where the population is known stops the program by name; a check that
  runs only in a sub-case says it is silent in the others. ⛨ turn-check:empty-check
- <a id="write-rename"></a>**Write shared state beside and rename it into place, and enumerate the
  scheduled jobs installed before adding one.** Test: the write is a rename; disabling a job removed
  its install file.
- <a id="lock-owner"></a>**A lock belongs to the program doing the work, and a generator two
  launchers can start takes one.** Test: the lock holds the worker's process id; an alert is tested
  in a mode that cannot reach the owner.
- <a id="instrument-bound"></a>**When you optimise one quantity, instrument the resource that bounds
  the problem.** Test: the gain is reported with that resource's figure; housekeeping runs on a
  counter.
- <a id="destination-each-write"></a>**A destination that can disappear is checked before every
  write.** Test: the mount point is checked per file, and its loss stops the job with a distinct
  code.
- <a id="shared-resource"></a>**Measure a shared resource before consuming it, and give it back.**
  Test: a job holding a live service stopped has a time limit and was timed on a short input.
- <a id="calendar-local"></a>**Calendar dates are local.** Test: one shared function returns today
  in the owner's timezone.
- <a id="ignore-with-output"></a>**A program that writes into a versioned folder extends the ignore
  list in the same change.** Test: the pattern covers the output, and untracked files are listed with
  their weight before any wide staging.
- <a id="ignore-after-fact"></a>**An ignore rule added after the fact protects nothing, and reads as
  though it does.** Test: tracked files are checked against the rules; an exposed credential is
  changed, not hidden. ⛨ check-freshness:ignored
- <a id="single-keyword"></a>**A single name or keyword is never a matching criterion, and matching
  stays inside the entity's own sources.** Test: the false-positive rate was measured on the real
  corpus.
- <a id="both-answers"></a>**A check you have never seen say no checks nothing, nor one you have
  never seen say yes.** Test: both answers were exercised once; a pattern was tested for what it lets
  through.
- <a id="scheduler-path"></a>**Test a scheduled job through exactly what the scheduler runs.** Test:
  the dry run starts from the job's own entry script.
- <a id="read-back"></a>**A write is verified by reading the result back, by another path than the
  write, and a generated file is checked for its content.** Test: the file is re-read after writing;
  template delimiters are searched in the output; a machine format passes its own parser; text put in
  a web form goes in through `insertText` and is read back from the field before any irreversible
  click. See [independent-check](#independent-check).
- <a id="generator-twice"></a>**A generator that reads its own previous output is run twice before
  it is called done.** Test: the second run changes nothing.
- <a id="open-document"></a>**A document the owner has open is not updated until the application
  holding it reloads it.** Test: what they just did is read from the application, not the file.
- <a id="desktop-apps"></a>**The owner's desktop apps are driven around them, never over them.**
  Test: the front app is checked in a separate command first, and a dialog or a refused screen access
  belonging to someone else is left alone.
- <a id="visual-everywhere"></a>**A global visual change is verified everywhere, by measurement.**
  Test: every element is measured, not the component you suspect. ⛨ check-contrast
- <a id="suspect-instrument"></a>**When a check disagrees with something that just worked, suspect
  the instrument first.** Test: the result is reproduced a second way; each scripted substitution
  matched exactly once and its output was read; nothing reassuring prints unconditionally.
- <a id="exit-code"></a>**A test suite's verdict is its exit code, and the publish and the commit
  depend on it.** Test: the exit code is read with no pipe in between, the steps are chained, and the
  message is held against the diff's file list. ⛨ turn-check:failed
- <a id="exemption"></a>**An exemption is held to the rule written above it, and a check is never
  switched off without doing its job yourself.** Test: each exemption is read against its criterion
  when the list is touched.

## 6 · Handover and the relationship

**The mechanism.** The work is right and arrives in a form, a place or a vocabulary that makes it
useless, or it spends the owner's time on something that was yours to do.

- <a id="you-draft"></a>**A message leaves only on a person's yes to that message.** Canonical:
  `source/formats/message.md` ▸ *Three rules*. Test: the yes covers this text on this channel.
  ⛨ send-guard
- <a id="app-not-document"></a>**The deliverable is the app, not a document.** Test: the
  information is reachable in its place in the app.
- <a id="decision-reraised"></a>**Recording a decision is not acting on it.** Canonical:
  `source/formats/todo.md` ▸ *Two tags that get re-raised*. Test: a decision waiting on the owner
  carries `#decide` and a date. ⛨ open-decisions
- <a id="decision-as-data"></a>**A decision that changes a computed status becomes data in the same
  change.** Test: the rule sits where the tool reads it, one row per period with its threshold, date
  and source; the build fails on a value that is neither yes nor no, and on a yes with no threshold.
- <a id="only-they-can"></a>**Only ask the owner to do what only they can do: a signature, a
  payment, a credential or a second factor, a decision listed under `source/decisions.md` ▸ *Only a
  person settles*, a physical act.** Test: each request to them falls in one of those.
- <a id="talking-out"></a>**Talking the owner out of an action is an action, and needs the evidence
  the action would have needed.** Test: the advice against cites what was checked.
- <a id="delegated-judgement"></a>**Never hand back a judgement they delegated.** Test: the criterion
  is in code and the next step is triggered by you.
- <a id="no-jargon"></a>**Rigour is not jargon.** Test: any term absent from the owner's own
  messages and from the voice guide's *Notation* is defined in the sentence at first use.
- <a id="definite-article"></a>**Never designate with a definite article something the owner has
  not been shown.** Test: "the ten documents" were shown to them.
- <a id="next-steps-today"></a>**Next steps are actionable today, by someone named.** Test: every
  line has an owner and can start today; a wait goes on a date, an imposed step is a date to verify.
- <a id="reconcile-questions"></a>**Reconcile open questions with what has been learned since.**
  Test: a question is shown as open only after a search, and closed with its answer and source.
- <a id="wrong-answer-visible"></a>**A wrong answer you gave, once corrected, stays visible with its
  correction.** Test: the correction sits beside the struck answer.
- <a id="settings-screen"></a>**A settings screen at a provider is never handed to the owner**
  (`AGENTS.md` ▸ *You run all the git*). Test: the path that avoids the screen was looked for first.
- <a id="problem-behind-instruction"></a>**Check an instruction against the problem that caused it,
  and say so when the work leaves that problem standing.** Canonical: `docs/complex-tasks.md` ▸ *A*.
  Test: the handover says whether the original problem is solved, and which sense of an everyday
  word with a technical meaning (*backup*, *move*, *archive*) was applied.
- <a id="alert-exception"></a>**An alert never prescribes an irreversible action without the
  condition under which it does not apply.** Test: the exception is in the same breath, a reason not
  to follow the tool lives in the repo, and an instruction naming an operation says what to do when
  its state does not hold.
- <a id="chain-ends"></a>**A chain verified through the middle covers neither end.** Test: the
  gesture was made from the screen, or the server log shows the request.
- <a id="absolute-number"></a>**Never quote an absolute number without its total or its share.**
  Canonical: `source/brand/voice.md` ▸ *Rules*. Test: the total or share is in the same sentence.
- <a id="project-has-app"></a>**Never tell the owner a project has no app.** Test: name what is
  missing (a simulator, a timeline) instead.
- <a id="one-question"></a>**Ask before building when the wrong reading of a short brief costs more
  than one round of rework; otherwise state your reading in one line and proceed.** Test: a request
  that names two surfaces, two levels or a model ("like that one") gets either the question or the
  one line, and a correction to a record rests on a fact the owner stated.
- <a id="decision-question"></a>**A decision expected from the owner is written with its question,
  its options and what each one changes.** Test: they can answer without asking which question.
- <a id="every-route"></a>**Under a constraint the owner set, list every route that respects it
  before recommending one.** Test: the routes are listed.
- <a id="template-blanks"></a>**Every blank in a template for someone else says what goes in it.**
  Test: no blank is bare dots.
- <a id="procedure-how"></a>**When a third party names a procedure, present it at once with its
  how.** Test: the form and the address reach the owner with the steps.
- <a id="name-from-login"></a>**Never complete a person's name from a login, a handle or an
  address.** Test: the full name has a source, or the identifier is written.
- <a id="private-link"></a>**A link to a private repository reads as broken to anyone not signed
  in, and a cost on your side is never moved onto the recipient as a choice.** Test: the message says
  access is needed, or carries the document.
- <a id="flattened-signatures"></a>**A document signed on screen leaves with its signatures
  flattened into the page.** Test: the file opened in a second reader shows the signatures.
- <a id="message-id"></a>**Find a scripted message by an id it carries, and check a send in the
  sent log.** Test: the id is in the message and "sent" is read from the sent folder.
- <a id="field-interface"></a>**A field another tool parses is an interface, and moving or
  archiving a shared file is a rename for its readers.** Test: every program and check that finds it
  by its text was searched before the rename, both forms accepted for one transition, and a pipeline
  names a missing source at its start.
- <a id="wait-has-end"></a>**A decision that waits on a third party carries the date it stops
  waiting, and silence past that date is the answer.** Test: the line has a `due:` and `#revisit`, so
  `scripts/open-decisions.mjs` raises it. ⛨ open-decisions
- <a id="tasks-destination"></a>**"Add my tasks" goes where the person keeps their own tasks, and a
  yes to pushing is not a yes to the destination.** Test: the destination is the one they use; with
  two plausible places, ask.

## 7 · Parallel sessions

**The mechanism.** Several sessions on the same repos at once. None of these errors exist in a
single session, and they get likelier exactly when work goes well.

- <a id="commit-named"></a>**Commit only the files you touched, named one by one.** Test: no
  `git add -A`.
- <a id="staged-belongs"></a>**A file left staged belongs to whoever commits next.** Test: stage
  right before committing; `git checkout <ref> -- <file>` counts as staging.
- <a id="read-staged-diff"></a>**Reading the staged diff is the guard, not staging by path.** Test:
  the body of `git diff --cached`, unfiltered, was read before the commit; a move lands in one commit.
- <a id="head-moves"></a>**`HEAD` can move between the reading and the commit.** Test: commit from
  your own worktree, and `git log -2` before the push shows the parent you started from.
- <a id="stash-shared"></a>**The stash is shared too.** Test: no stash in a shared checkout.
- <a id="branch-switch"></a>**Another session can switch the branch under you.** Test:
  `git branch --show-current` before each staging, and the push output read.
- <a id="ownership-history"></a>**Ownership comes from a file's history, not its location.** Test:
  `git log` on the file before editing outside your scope, and the owning session told.
- <a id="one-subject"></a>**One subject, one session; a second source becomes the check.** Test:
  untracked files and running sessions were looked at before a bulk write.
- <a id="claim-note"></a>**Claim a shared file before editing it, in `SESSIONS.md` at the repo
  root.** Test: one line (these files, this session, until pushed), added before the edit and removed
  by the commit that pushes them, after `git fetch` and `gh pr list --search <file>` found no
  neighbour on it.
- <a id="shared-consumers"></a>**After changing anything shared (tokens, a stylesheet, a helper),
  check every consumer.** Test: the token was grepped across the repos `ORGANIGRAM.md` lists, and the
  hits are listed in the handover.
- <a id="one-door"></a>**One door per subject.** Test: one page per subject, built by one session.
- <a id="reread-inputs"></a>**A source of truth compiled at session start is already stale.** Test:
  the inputs are re-read right before writing and before asking the owner anything.
- <a id="scope-confidential"></a>**A session's scope is a confidentiality boundary.** Test: the
  recipient session was confirmed by a message carrying no content.
- <a id="publish-working-tree"></a>**Publishing deploys the working tree, not the last commit.**
  Test: `git status` is clean of others' work before publishing a change you did not write.
- <a id="sent-today"></a>**Before writing a message for the owner, read what left their mailbox
  today.** Test: the sent folder for the day was read.
- <a id="repair-shared"></a>**Before repairing a shared tool or file, list the running sessions and
  read the one on that subject.** Test: no other session holds the repair.
- <a id="byte-serialisation"></a>**Rewrite a shared file only with a serialisation that reproduces
  the committed version byte for byte.** Test: the diff's size matches the change.
- <a id="resume-read"></a>**On resuming a matter, read the decisions and the files changed since
  your last turn there, and check a parallel session's message against the day's decisions.** Test:
  `git log` since your last commit on the matter was read before reasoning.
