# How this goes wrong

Seven families of mistake, distilled from a real project's incident register: a hundred-odd errors
logged in the first week of an owner using this kit, on files where every figure published was there
to decide something. More than half made a wrong conclusion travel, destroyed data, or cost the
owner real time. They are not exotic. Most of them are sound reasoning applied to a corpus nobody
opened.

Read this before acting on real data, before a figure or a claim leaves the repo, and whenever you
are about to build a tool. The `reflect` skill uses the same seven names when it logs an incident
(`source/quality/README.md`), so the families here and the register there stay one vocabulary.

Three findings about the *shape* of these errors, before the list:

- **A large share were caught by the owner, not by the AI.** Those were the ones visible from their
  screen, and there was no reason they should have been the first to see them. Every rule below
  exists so the next one is caught earlier, and the share the owner has to catch is the number that
  matters.
- **Three mechanisms escape every possible check.** A true sentence going false with nobody touching
  it (§4); a "to verify" gaining authority each time it is requoted without gaining evidence (§2);
  and a genuine document mistaken for a precise one (§3). For those, the parade is a rule about how
  you write, not a test you can run. Do not dress a rule up as a safeguard: the register's most
  honest column is the one that says *nothing guards this yet*.
- **Thoroughness is not coverage, and it disguises the gap.** The starkest incident in that register
  was an archive verified for days — hash by hash, restart, throughput, disk — and parked in cloud
  storage whose login was the very account the archive existed to survive. Every internal axis was
  checked and no external one was. Checking a great deal stood in for checking what mattered, and
  the profusion produced a confidence nothing supported.

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
- **No search can prove an absence — not an index, not a keyword sweep, not a filtered inventory.**
  A search establishes that a term is present; a mechanism can be stipulated without using any of
  the words you looked for. A filtered index answers "is it on my map", never "does it exist": one
  built on a filename whitelist was read for two days as proof that documents were missing, and it
  had never indexed a message body. Before concluding from an empty result, **calibrate the search
  on a case you know should appear.** If your known case does not show up either, the instrument is
  at fault, not the data. To assert an absence, read the whole section and say how you checked.
- **Retrieving is not reading.** A one-page note, downloaded and indexed from the start, sat unread
  while three deliverables said the figure it carried "exists in no document in the file". Before
  writing *missing*, *not found* or *to request*, list what the project already holds on the subject
  and open it — including the owner's own working files. An attachment can also look absent because
  the mail client only downloads it when you open it.
- **A summary never founds a conclusion; quote the clause word for word.** An internal extract
  faithfully summarised a contract article and dropped six words of preamble — the six that reversed
  its meaning. A published date rested on the summary for days. And **verify the article that
  carries the conclusion first**, not the easy ones around it: checking the peripheral links of an
  argument gives false confidence about its central one.
- **Read to the end of the list, and to the end of the thread.** Each item of an enumeration is
  independent and none announces the next, so the sub-point that answers your question is not the
  last word. In a thread, the answer almost always arrives after the question: a dunning notice was
  taken for a quarterly charge and a decade of costs built on it, while the real quarterly figure
  sat two messages further down.
- **A correction is verified against the authority, never against a second document of the same
  kind.** Told a figure was wrong, the fix replaced it with another figure from the same email
  thread rather than opening the deed. The second version was wrong too, and travelled further
  because it now looked verified.
- **Name a document by what it is, not by what carried it.** "The letter" was a board resolution —
  which changes who decides, how often, and what protections apply. Same for versions: a document
  found is not the document. Say which version you kept and why the others are set aside.
- **Enumerate obstacles by nature before publishing a date.** Asked from when the owner could act,
  the file listed what stopped them legally and never opened what dissuaded them economically. The
  answer was exact, complete-looking, and a year early. Legal, tax, contractual, economic: say which
  you instructed and which you did not, and if any is missing the answer is an order of magnitude
  and presents itself as one.

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
- **When something rests on an account, name the account, not an adjective.** "Personal" was written
  into a project's founding rules and recopied from file to file for days. It answered *who owns
  this* and was read as answering *will it survive*. The two are independent, and neither had been
  put to the system. Write the identifier the system displays, and ask the system which account
  holds the service.
- **A category is not an identity.** Metered interface, carrier prefix and signal strength together
  established *a phone hotspot*; they were written up as *this owner's phone*. Where the deciding
  value is unreadable, test membership without displaying it — compare, count, check against a list
  — rather than reasoning in its place. And admitting the gap in the same sentence as the conclusion
  does not license the conclusion; it just makes it look careful.
- **A dated document does not date the deadline it records.** It establishes that the deadline
  exists. Before writing a date down, check on the document itself what that date measures — a diary
  entry for an evening someone attends is not a date that binds. Same trap between a threshold and
  its effects: a deadline whose label says *from*, *threshold* or *beyond* carries the date of
  crossing, and the consequences go in the text of the action.
- **A test suite's verdict is its exit code**, read with no pipe in between, never the presence or
  absence of a pattern in its output. A filter that assumes it knows every failure format needs only
  one new format to turn a failure into silence — and a confirmation written beside the command
  turns that silence into a positive claim.

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
- **Before subtracting two amounts, say what each one contains.** Same unit and a similar order of
  magnitude was enough to make a purchase cost — fees included — get subtracted from a market value,
  and a property that had gained value was reported to its owner as having lost some. A cost
  compares to a cost. Posing the distinction earlier in the message does not protect you from
  dropping it at the line where you conclude.
- **Keep a figure with the sentence that says what it is.** A figure quoted by someone who says they
  do not understand it is not data. And before comparing two things by a ratio, establish what
  distinguishes them other than size — two flats in one building, one to gut and one immaculate. A
  list of caveats underneath does not neutralise a heading that says the opposite; the heading is
  what stays.
- **Anything that depends on an order expires like a count.** Rank, maximum, majority, "the main
  one", "the second most": these read as words rather than numbers, which is why they survive the
  regrouping that makes them false. Compute them at display time, in the same pass as the table
  they will sit next to.
- **Before counting a machine log, establish what one line represents** and by which key two lines
  can mean the same fact. Logs are redundant in ways that are invisible in the file, because every
  line looks perfectly plausible: one response spread over several lines, a resumed session
  recopying its predecessor's events into its own log.
- **To count what an application holds, ask the index it trusts, never the files it leaves on
  disk.** A mail client keeps deleted messages as orphan files: counting them produced an alarming
  gap, published before its cause was established, and an order of magnitude past the real one. Do not
  publish a gap before you can explain it — an unexplained alarming figure costs more than the delay.
- **The direction of a comparison lives in the argument order, and nothing in the output repeats
  it.** Two diffs run minutes apart with the arguments swapped, read with the same grid, produced a
  warning that entries had been destroyed when they were intact, and advice that would have lost the
  ones that really had. When a comparison is going to be reported to someone, name both sides in the
  output. And check an announced loss against an independent quantity first: the file described as
  truncated was the larger of the two.
- **An adjustment carries its base, because the base decides the sign.** Say what you are starting
  from before you say what you are taking out. A clause neutralising an accounting standard was
  written up twice as pushing a figure down through its contractual floor; it does the opposite, and
  the series it applied to were not on that basis at all. Apply the adjustment to the known series
  and check the result is still possible — a reversed sign almost always produces an absurd value
  somewhere, and that takes a minute.
- **Write the balance sheet before and after ascribing an effect to an operation.** Repaying a debt,
  reinvesting, contributing to a company, switching vehicles: these are neutral by construction, so
  their effect lives in tax or income, never in the net. Two striking amounts pointing opposite ways
  are not an alternative.

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
- **Verify the publishing pipeline exists before trusting it.** "Pushing publishes" is a claim about
  infrastructure, and infrastructure claims expire or were never true. On a real project the docs
  said Cloudflare rebuilt on every push; nothing was connected, and a corrected figure sat unpublished
  for six days while every summary reported it live. **A one-line assertion in a guide is not
  evidence.** Check the deployment source, or deploy explicitly and confirm on the live URL. Where a
  pipeline can fail silently, add a machine check that fails loudly — a string the live page must
  contain beats any amount of documentation.
- **Re-read a long deliverable whole before handing it over.** Written over hours, its opening
  paragraph knows less than its closing one. Three signals mean re-check a passage: it asks for
  something already obtained, it claims ignorance, or it quotes a figure from elsewhere.
- **A retracted claim stays retracted across every project.** Corrections are remembered where they
  were made; the person you are talking to is the same person in all of them. Fix the thing that
  produced the claim, rather than commenting on it.

## 5 · Actions on files and the machine

**The mechanism.** Acting on real data through an unverified model of the system. This is the family
that destroys things, and the one where the AI's confidence is least earned. It is also the longest
list here, so it is split by the moment each rule applies.

### Before you build

- **A safeguard must not depend on the thing it protects against. Check that axis before writing a
  line of code.** It is one minute of work and it comes first, not last. An archive built to survive
  the loss of a work account was complete, hash-verified, auto-fed, mirrored to an external drive —
  and stored in cloud storage whose login was that same work account, which also held the password
  keychain and a dozen synced services. It protected against nothing. The owner found it themselves,
  two days later, by asking the common-sense question: *when the account goes, do I lose this too?*
  Ask it of every backup, every recovery path, every alert, every fallback: name what it protects
  against, then list what it needs in order to work, and check the two lists do not intersect.
- **A mechanism that ships inside the thing it monitors cannot reach what it was built for.** The
  kit's own update notifier runs from a `SessionStart` hook registered in a file in the repo. A
  project onboarded before that mechanism existed has neither the hook nor the script, so it never
  announces that an update exists, and it can only start announcing once someone has already done
  the update by hand. One real instance sat a month behind, silently, while its collaborator
  assumed his agent was current. When you roll something out, ask what reaches the installations
  that predate it: usually the answer is a person, and then say so rather than calling it automatic.
- **A guard runs on its own clock, never on the activity of the person it protects.** A watchdog
  hooked to session start and message send looks like a periodic task — both "run by themselves" —
  and covers exactly the hours the owner is at the keyboard, which are the hours that need no cover.
  The test: what does it do if nobody touches the machine for twenty-four hours?
- **Nothing is "in place" until it has been seen to produce its effect once**, measured on its
  result rather than on its installation. A check that rarely fires produces no trace, so nothing
  distinguishes a net that works from an inert one: fire it for real, once. A network ban compared
  the current SSID against a forbidden pattern, and the OS only gives the SSID to programs holding a
  location permission — so the comparison ran against a masking string, matched nothing ever, and
  its silence read as safety.
- **Before founding a rule on a system value, prove the program can obtain it in the conditions it
  will run in** — a scheduled job, not your interactive session. When the value is closed off,
  change lever rather than insist: the list of remembered networks was readable without permission,
  and removing one from it made the ban true by construction.
- **Probe the system rather than assuming it**, especially for permissions and paths. Three lines of
  probe beats a confident model, and it is the owner who pays for a wrong one. Read a permission at
  its source before forming any hypothesis about a denial, and remember that editing an approved
  program can silently revoke the approval the owner just granted it.
- **Stop at the first explanation that fits the symptom and you will spend the day on variants of
  it.** Access denied, therefore permission missing — and hours went into which interpreter to
  authorise, while an identical manual probe was succeeding the whole time. When two supposedly
  identical runs give opposite results, the difference between them is the cause. An observation
  that contradicts your explanation is the lead, not a curiosity to note in the margin.

### Before you destroy

- **A safety guarantee from someone else's API is a claim.** Test it on one item, then in a small
  batch, before acting in bulk, and verify the real state independently afterwards — never trust the
  tool's own report of success.
- **Never document an untested assumption as if it were verified.** A reassuring comment in a script
  makes the assumption invisible to review, which is worse than not writing it.
- **A destructive option renames aside; it does not delete.** "Start over" used for what was really a
  resume has thrown away hours of finished work. Moving the file and its index to a timestamped name
  is instantaneous, costs not one byte since nothing changes disk, and makes the mistake reversible.
  Deleting then happens knowingly, never in the same gesture as a resume. A typed confirmation is
  not the guard here: whoever types YES is whoever just ran the command. Outside a terminal, require
  an explicit flag instead.
- **Every destination keeps a backup.** If an option removes the safety net, that disqualifies it;
  it is not a trade-off to rank against speed. If the safe route is blocked, understand why rather
  than routing around it.
- **When the source is about to disappear and space allows: copy everything, sort later.** Sorting is
  still possible on a complete copy. It is not on a partial one.
- **Never delete forward through an indexed collection** — each removal shifts the ranks below it
  and half your targets survive — and verify a cleanup by recounting the final state, never by
  reading the number of operations you requested.
- **Never restore a file you do not own with a command that takes a reference state.** `git
  checkout`-style restores undo everything unsaved, not what you just did; in a workshop where
  several sessions write in parallel, unsaved is the normal state of work in progress. A dozen lines
  of another session's work went that way. The only safe undo returns exactly the bytes you read
  before acting, and the return path gets tested when it is free, not when you need it.
- **A proof of integrity is only worth anything if its source predates the damage.** Compare a
  mangled file against a mirror synced after the mangling and you are comparing the damage to
  itself. Check the reference's timestamp before you rely on it. Session transcripts keep the full
  text of every write, and are the last resort when nothing else kept a trace.

### While it runs

- **"Nothing to do" and "nothing seen" produce the same value, and only one of them is good news.**
  A backup job denied access to its source got an empty listing rather than an error, reported "up
  to date", and exited zero — and that report was shown to the owner as proof the thing worked.
  Where the population's order of magnitude is known, a zero result is an anomaly that stops the
  program by name. And distrust any indicator that only ever takes one value: it is measuring
  nothing.
- **Write shared state beside and rename it into place.** A rename is atomic, a rewrite is not, and
  an index read halfway through a rewrite looks exactly like an empty index — which reads as *start
  over*. That is how a second archiver re-fetched an entire corpus and filled the disk. Which is
  also why you **enumerate the scheduled jobs already installed before adding one**; disabling a job
  is not enough while its install file remains.
- **A lock belongs to the program doing the work, not to the one that calls it.** A parent that dies
  releases a lock its child is still working under. Put the process id in the lock so an abandoned
  one can be recognised and lifted rather than blocking forever.
- **When you optimise one quantity, instrument the resource that bounds the problem.** Prefetching
  tripled throughput and ate the free disk that was the whole constraint. The gain was measured and
  announced; its cost was not. The same applies to the fix: measure it on the quantity it was meant
  to preserve, and cadence periodic housekeeping on a counter rather than only on a threshold, or it
  reruns every pass and costs more than the work it protects.
- **Measure a shared resource before consuming it, and give it back.** Disk, quota, bandwidth: other
  work, and other sessions, are using the same machine.
- **Calendar dates are local.** Converting to UTC is the ordinary way to get a short date and is
  right everywhere you timestamp an event. Compare against a *calendar* and it is wrong for the
  hours between local midnight and UTC midnight — today's deadline announced for tomorrow. One
  function, in the shared module, returning today in the owner's timezone written out in full.
- **A program that writes a file into a versioned folder extends the ignore list in the same
  change.** Writing the program and declaring its output are two halves of one gesture, and an
  untracked file costs nothing and says nothing right up to the day a blanket `git add` carries it
  into history. Match by pattern, not by exact name, and list untracked files with their weight
  before any wide staging.
- **A single name or keyword is never a matching criterion.** Recognising collaborators by surname
  swept in a press subscription and people from unrelated organisations. Require context, and
  measure the false-positive rate on the real corpus — it was measurable immediately.

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
- **A settings screen at a provider is never handed to the owner.** Three attempts in a row —
  numbered steps, a login page opened in a panel they could not see, then eye-on-screen guidance —
  before anyone looked for the engineering path that avoided the screen entirely. It had been
  available from the first attempt. Either the action is within your reach and you do it, or you
  send them one mail saying precisely what to click and why. Click-by-click guidance is not a
  fallback option.
- **Check an instruction against the problem that caused it, not only against its wording, and say
  so when what you deliver leaves that problem standing.** A disk was full; the work faithfully
  copied everything to the cloud and freed not one byte. Nobody said so, the owner found out three
  days later in passing, and apologised for a misunderstanding that was not hers. When an everyday
  word has a technical sense that changes the outcome, announce which one you are applying.
- **A chain verified through the middle covers neither end.** A feature was checked through the
  compiled module and the remote repo state, both fine — while a layout change had squeezed the
  control the whole feature depends on down to a few pixels wide. Still functional, impossible to
  aim at. A feature is not verified until the gesture has been made from the screen, or the
  server-side log shows the request arriving.
- **Never quote an absolute number without its total or its share.** Free space reported as "only
  N left" was exact, and the owner concluded their disk was full and work impossible. A restrictive
  turn of phrase makes a figure carry a judgement it does not carry; keep them for scarcity you can
  demonstrate. And do not borrow an argument from an anxiety when the real reason is elsewhere.
- **Never tell the owner a project has no app.** For them a project and its app are the same thing,
  so the sentence lands as "there is nothing for this". What can be missing is a purpose-built tool
  — a simulator, a timeline, a set of documents — and that is what to call it.

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
- **A source of truth compiled from the repo as it stood at session start is already stale.** In a
  repo with several hands, the state changes faster than a session reads it: a register meant to
  settle every fact recorded a major document as missing while a neighbouring session had read it
  that morning, and it contradicted several conclusions. Re-read the inputs immediately before
  writing, not once at the beginning. That error happened while building the very tool meant to
  prevent it, which is the clearest sign it is structural rather than careless.
- **A session's scope is a confidentiality boundary, not just a division of labour.** Full details
  of a private transaction were sent to a session that was not on the file, on an identification
  taken second-hand from another session — in a workshop where such attributions had already proved
  wrong several times that day. Confirm the recipient yourself first, with a routing message
  carrying no content at all ("are you the session holding X?"), and never by reusing someone
  else's identification. One message against an irreversible disclosure.
- **Publishing deploys the working tree, not the last commit.** A session ran publish because an
  end-of-session hook asked it to, on a note another session had written, while a third had
  uncommitted server files, an unrun migration and half-written tests on disk. It would have put all
  of that into production. An unconditional instruction in a hook is written for the session that
  just wrote the thing. Before publishing a change you did not write, look at the state of the
  workshop and tell the session that owns it rather than going in its place.
