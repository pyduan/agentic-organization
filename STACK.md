# Stack

<!-- TEMPLATE: the setup skill walks this table with the owner first, one row at a time, before
     anything else (.claude/skills/setup/SKILL.md ▸ 1). Each row ends approved or changed, with the
     date and who said yes in the last column. Delete this comment once every row is settled. -->

What runs on what, and what would replace it. Read it before proposing any change to the
infrastructure, and never infer this organization's setup from another project's: the stack next
door is a different stack. The money side of a row (plans, seats, invoices) lives with whoever holds
the accounts, not here.

The *Way out* column is the point of the file. A brick nobody knows how to leave is a brick nobody
chose. The *Approved* column says who chose it and when (`2026-10-30 @sam`): a row without one is a
proposal, and *to decide* means a dated `#decide` line waits on someone. A row that changes later
gets a new date and handle, and the reason goes in `source/decisions.md`.

| Role | What we use | State | Way out | Approved |
|---|---|---|---|---|
| Source of truth | Git, a private repository on GitHub | in place | any Git host, same model | |
| Operator | Claude Code, on the repositories cloned locally | in place | any agent that reads a repository | |
| Private pages (the intranet first) | Cloudflare Access in front of a Worker, `apps/dashboard` | TODO | Access on a hostname once a domain arrives; any host with a sign-in gate | |
| Website | Cloudflare Workers, built from `site/` | TODO | any static host | |
| Domain and DNS | TODO | | | |
| Mail | TODO | | | |
| Accounts in the organization's name | TODO (two administrators each) | | | |

## What does not exist yet

The useful half of the file: what is missing reads better here than in a conversation, where it is
gone by the next session.

## An organization answer is not a personal one with the names changed

The same person often runs personal projects on neighbouring stacks, sometimes with the same
vendors. "It is free and already set up over there" is the argument that puts the organization's
mail or files in someone's personal account, where they stay when that person leaves. An address
that survives the person, a scope the organization's admin can manage, and a service someone other
than its creator can administer are requirements here. Paying for a seat is often the right answer.
