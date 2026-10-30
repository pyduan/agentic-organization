---
name: workshop
description: "Prepare, run and close a use-case workshop at a customer: a half-day with the people who do the job, ending with at least one working before-and-after on their real files and rules written in the room. Use when the owner says 'we have a workshop with X', 'prepare the session at X', 'how do we run the first day with their team'. For a company that sets the agentic organization up at its customers; delete this skill and customer-onboarding if yours does not. Company pack only."
---

# Workshop

The use-case workshop is the unit of work at the start of an engagement. The shape comes from
sessions a consultancy ran at a manufacturer; the logistics of the day (accounts, recording, Access
before leaving) are the kit's `docs/helping-another-organization.md`.

## Before

- **One trade, one room.** The drawing office, or order entry, or transport. Mixing trades produces
  a workshop about AI in general, which produces nothing.
- **Their files, a week ahead**, unsorted on purpose: PDFs, exports, manuals, the spreadsheet
  everyone uses. Sorting is our job, and their sorting hides what we need.
- **Two or three candidate cases**, chosen with the person who runs the trade. Each needs an input
  they already have and an output they can judge in ten seconds.
- **A before-and-after pair per case**: the file as their tool produces it, and the same file after a
  person corrected it. Ten to fifteen pairs is what makes rules extractable.
- **Machines that work**: git, the agent, access to the file server. About fifteen minutes per
  workstation, done before the room fills up.

## During

1. **Run the case live on their file**, not a slide about it.
2. **Let them correct out loud.** "The dimension is too close to the line." Every correction is a
   candidate rule.
3. **Write the rule in front of them**, in their language, in their repo, and rerun. The loop from a
   spoken correction to a changed output is the whole demonstration.
4. **Ask at what level each correction is true**: every site, this type of project, or only this one.
   Only they can answer, and it is what makes the rule base survive.
5. **Say when you are guessing.** A rule that does not cover the case gets a question in the open
   file, never a silent interpretation.

## After, the same day

Commit the rules written in the room, attributed and dated. A journal entry in the project file
(`meeting-log`), with what was decided and by whom. `## Open questions` as questions. One named next
step with one named owner.

## What kills a workshop

- **A demo instead of their file.** They watch politely and nothing transfers.
- **Governance before output.** Show the loop first; governance is the second hour.
- **The room's most senior person answering for the trade.** The rules live with whoever does the
  work. If that person is not there, reschedule.
- **Leaving without a rule committed.** Enthusiasm and no file is nothing.
