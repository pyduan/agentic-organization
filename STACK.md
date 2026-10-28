# Stack

<!-- TEMPLATE: the setup skill fills this in with the owner. One row per brick: what the
     organization uses for it, where it stands, and the way out. Delete this comment once filled. -->

What runs on what, and what would replace it. Read it before proposing any change to the
infrastructure, and never infer this organization's setup from another project's: the stack next
door is a different stack. The money side of a row (plans, seats, invoices) lives with whoever holds
the accounts, not here.

The *Way out* column is the point of the file. A brick nobody knows how to leave is a brick nobody
chose.

| Role | What we use | State | Way out |
|---|---|---|---|
| Source of truth | Git, a private repository on GitHub | in place | any Git host, same model |
| Operator | Claude Code, on the repositories cloned locally | in place | any agent that reads a repository |
| Website | Cloudflare Workers, built from `site/` | TODO | any static host |
| Private pages | Cloudflare Access in front of a Worker | TODO | Access on a hostname once a domain arrives |
| Domain and DNS | TODO | | |
| Mail | TODO | | |
| Accounts in the organization's name | TODO (two administrators each) | | |

## What does not exist yet

The useful half of the file: what is missing reads better here than in a conversation, where it is
gone by the next session.

## An organization answer is not a personal one with the names changed

The same person often runs personal projects on neighbouring stacks, sometimes with the same
vendors. "It is free and already set up over there" is the argument that puts the organization's
mail or files in someone's personal account, where they stay when that person leaves. An address
that survives the person, a scope the organization's admin can manage, and a service someone other
than its creator can administer are requirements here. Paying for a seat is often the right answer.
