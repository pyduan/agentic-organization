---
name: customer-onboarding
description: "Stand up the agentic organization at a customer, for a company that sells it: the structure installed in the customer's own GitHub organization (a central repo and one repo per unit), the order of operations, who owns the rule base, and what we promise. Use when the owner says 'we are setting this up at X', 'how do we deploy at our client', 'X wants their own'. Delete this skill and workshop if your company does not do this. Company pack only."
---

# Customer onboarding

For a company whose offer is setting the method up at its customers. The day itself (accounts,
seeding, recording, Access before leaving, the guide written after) is the kit's
`docs/helping-another-organization.md` and `docs/seeding.md`; read them first. This skill adds what
an engagement needs on top: the structure, the order, and the promise.

## The structure we install

A GitHub organization owned by the customer, with a central repo and one satellite per unit.

| Repo | Holds |
|---|---|
| the central one (their name for it) | routing, governance, shared recipes, glossary, decisions |
| one per unit | that unit's business rules, its cases, its open questions |

One satellite per unit rather than one repo, because repo access is the only access control that
exists: separating repos is what keeps one unit's know-how inside that unit
(`docs/one-repo-or-several.md` ▸ *the star*). The central repo carries the routing, `ORGANIGRAM.md`
with who validates what, the decisions, and an onboarding page for a non-technical first reader.

## Order of operations

1. **One unit, one use case, one before-and-after.** Nothing else until that works. A unit gets a
   repo when it has a named business owner, a real case with a verifiable input and output, and at
   least one before-and-after pair. Without all three it needs a `workshop`, not a repo.
2. **Write rules in the room**, in the customer's language, with the trade watching.
3. **Name the owner of each rule base**: the person who decides what becomes a shared rule. Without a
   name the rule base stops growing the week we leave.
4. **Set up the accounts.** Agent seats are individual and point at the shared rule base. Their IT
   owns the accounts and the contract; it does not own the rules, and saying so early avoids the
   fight later.
5. **Train a tool referent per unit**, who reviews their unit's changes and is the first recourse.
   This role decides whether the thing survives.
6. **Hand over the intranet** on the customer's own account and domain. Never leave a demo running on
   our infrastructure once the engagement is real.

After the day, every method it surfaced goes back into the kit with no name, no customer and no
figure of theirs.

## The things that go wrong

- **Rules written as scripts.** It works, and it locks the customer in to whoever wrote them. Rules
  are markdown; code only measures and displays.
- **Method written in the agent vendor's configuration format.** Same trap. Three-line adapters only.
- **A demo site left public.** Access goes on before the link leaves the room.
- **No named owner for a rule base.** The best single predictor that the deployment dies.
- **Starting with the hard case.** Start where the rules are known and the output checks in ten
  seconds; the hard case is worked on while the easy ones already produce.

## What we promise, and have to keep

The customer owns the rules. They can change agent vendor, or drop us, and lose nothing: their repos
are in their organization, their rules are plain text in their language, and nothing we build depends
on a service only we can run.
