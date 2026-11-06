---
name: backfill
description: "A person's history brought into the repositories once, so they become the source of truth for that person's work instead of their files and mailbox. Use when someone joins, when a session start says the backfill is to do or in progress, or when the owner says 'do my backfill', 'import my history', 'catch up my files'."
---

# Backfill

Once per person, the repositories take over from their files and exchanges: the latest real data, the
history with its sources, the templates of what they produce, the rules their files apply. After it,
the morning import keeps them current (`routines/morning-import/SKILL.md`).

**It starts on its own** when a session start says so (`lib/local-migrations.mjs` ▸ `pending`): under a
written leadership policy, without asking; otherwise offered in one sentence. Never in a scheduled
task. Its state lives on the machine, `.claude/machine.local.json` ▸ `backfill`
(`to-do`, `in-progress` with the last batch, `done`), so it resumes rather than restarts.

## Filling the template

Fill the brackets from what the repositories already know, and ask only for what they do not: their
role and unit (`ORGANIGRAM.md`), their unit's repository and their restricted one if any, their
priority subjects (their projects, the to-dos that wait on them), the start date (the policy's, else
the start of the current quarter), and their local folders (asked once, recorded on the machine).

> Do my backfill: I want the repositories to become the source of truth for my work, instead of my
> files and my exchanges. Sources, read-only: my mailbox (received and sent) and my drive since
> <start date>, then on this machine the folders <paths>, the most important first. Check first that
> this scope is approved in `CONNECTORS.md`; otherwise propose the row. My subjects first:
> <priority subjects>; count the noise and skip it. …

The rest of the method is below; the template only names the person's own values.

## What to extract

The latest real data; the history (who, what, when, with its source); the templates of the documents
they produce, emptied of names and amounts; the rules their files apply. In the formats the
repository already describes; a missing file is created in that format, never in a new one.

## Where it goes

What the whole organization may read goes to the shared repositories; a confidential subject only to
the restricted repository, checked private first; personal data nowhere; what no rule settles to the
person's list to decide, on this machine.

## Working safely

Stage in the gitignored `local/` first. Attach each line to what exists (a person by name, a document
by its family) rather than creating a duplicate. Check the totals against the person's own files.
List anomalies (an improbable amount, a balance that never moves) without fixing them. Anything
inferred says "to confirm".

## Pushing

Under the policy (`source/organization-policy.json` ▸ `policy.sharedWritesWithoutBatchYes`), the
shared repositories it names are pushed batch by batch without a question, each batch with its trace
and its flags. Everything else (a restricted repository, an anomaly, the list to decide) waits for the
person's yes in the chat, grouped with the next push rather than asked one by one. Never send a
message, never change anything in the mailbox or the drive.

## Leaving a trace

In each repository touched: who ran the backfill, when, on which scope (sources, period, folders), so
the next person or the morning import resumes without rereading.

## Resuming

Read `backfill.batch` on the machine and the traces in the repositories, then continue from the next
batch. When it ends, write `done` with the date, and tell the person what went where,
what waits for them, and what they still need to fill in.
