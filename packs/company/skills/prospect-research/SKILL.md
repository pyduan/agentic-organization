---
name: prospect-research
description: "Build a company file before a first call, from public sources, with honest gaps and the questions the call must answer. Use when the owner says 'I have a call with X', 'look up this prospect', 'who are they', 'prepare my meeting with X', or a new lead arrives with no file in customers. Company pack only; for a sourced fact about the world, use the research skill."
---

# Prospect research

Build the file before the first call, so the call is spent on their problem rather than on facts a
search would have given us. The file is a `customer-file` with `status: lead` or `prospect`.

## What to find

In this order, stopping when the next fact stops mattering:

- **What they make or sell**, in their own words, from their own site.
- **Size**: headcount and revenue, with the year and the source. Public filings and the company's
  own site are usable. A directory aggregator is not, unless nothing else exists, and then say so.
- **Structure**: group, subsidiaries, sites. A group is often a holding with operating companies,
  and the buyer usually sits in one of them.
- **The tools they already run**, if findable. Job postings are the reliable source.
- **Who decides**: the person who owns the problem, the one who signs, anyone with a veto.
- **Why they are on our list**: who introduced us, what was said, what they are expected to want.

## What to write

Fill the frontmatter and `## Summary`. Leave `unknown` everywhere you did not find something: the
call fills the gaps, so a file with honest gaps is more useful than one with plausible numbers.
Anything inferred goes under `## Open questions` as a question. "Assumed the subsidiary buys on its
own budget. Confirm." is worth more than a confident sentence that falls over in the meeting.

A figure worth citing beyond this account (a market size, a benchmark) goes through the `research`
skill into `source/facts/` of the central repo, with its source.

## Before the call

Three things in the file, and they are what the call is for:

- the hypothesis on the problem they have that we solve;
- the first thing we would propose, and what it changes for them;
- the question we cannot answer from outside.
