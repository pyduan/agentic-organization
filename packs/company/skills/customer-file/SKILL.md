---
name: customer-file
description: "Create or update a company, segment, partner or project file in the customers repo, with the frontmatter the intranet renders and the fixed body sections. Use when the owner says 'add this company', 'open a file on X', 'we signed X', 'update the file on X', 'new project with X', 'move X to prospect', or when a meeting, a mail or a sweep produced facts about an account. Company pack only."
---

# Customer file

Every company and every project in `customers` has the same shape. The intranet renders the shape,
so a file that follows it appears with no work on the site, and a file that does not appear at all
has broken frontmatter.

- `companies/<slug>.md` (B2B) or `segments/<slug>.md` and `partners/<slug>.md` (B2C): one per
  organization or segment, whatever the stage.
- `projects/<slug>.md`: one per engagement. A company can have several, or none.

Start from `TEMPLATE-company.md`, `TEMPLATE-segment.md`, `TEMPLATE-partner.md` or
`TEMPLATE-project.md` in the repo.

## The frontmatter is the contract

Everything the intranet shows outside the prose comes from frontmatter. Fields are typed and the set
is closed: adding a field means adding it to the template and to `intranet/scripts/check-content.mjs`
in the same change. The examples are invented, from another kind of company: a consultancy that
installs planning software at furniture makers. `erp` is a field only that kind of company fills.

```yaml
---
type: company
name: Larchmont Joinery              # the legal or trading name, as they write it
slug: larchmont                      # lowercase, hyphens, matches the filename
status: active                       # a key of model.accountStatuses in intranet/config.mjs
owner: sam                           # which cofounder owns the relationship
industry: Timber frame and joinery manufacturing
sector: industry                     # a key of model.families. Colours the pipeline chart.
employees: 900                       # integer, or unknown
revenue: unknown                     # "EUR 180M (2024)", or unknown
hq: Northfield
website: https://larchmont.example
erp: Planwell                        # the system we sit above, or unknown
intro: direct                        # direct, or who introduced them
since: 2024-07                       # first contact, YYYY-MM
updated: 2026-09-16                  # last time a person checked this file
image: /images/companies/larchmont.jpg  # 16:9, or omit for a generated monogram
tags: [manufacturing, multi-site]
key_facts:
  - Four projects live across the drawing office, order entry, transport and pricing.
  - The drawing office is the entry point and the first repo.
contacts:
  - name: Robin Hale
    role: ERP project manager
    email: robin.hale@larchmont.example
    note: Coordinates everything. Default point of entry.
---
```

```yaml
---
type: project
name: Drawing office
slug: larchmont-drawing-office
company: larchmont                   # the slug of a file in companies/ (or partners/)
status: active
stage: delivery                      # a key of model.stages
owner: alex
started: 2026-09-15
updated: 2026-09-16
repo: https://github.com/<org>/<repo>
value: unknown                       # contracted value, or unknown
key_facts:
  - Rewrites fabrication drawing dimensions from rules the drawing office writes.
milestones:
  - { date: 2026-10-02, kind: workshop, text: Second use-case session }
next_steps:
  - { text: Send the revised wall schedule, owner: alex }
  - { text: Confirm the two pilot sites, owner: sam, waiting_on: Robin Hale }
---
```

Rules on the fields:

- `status`, `stage` and `sector` (or `family` in B2C) take the vocabulary in `intranet/config.mjs`
  and nothing else. An unknown value renders grey with no label, and `npm run check` refuses it.
- A sixth family needs a validated colour added to the intranet's `tokens.css` in the same change.
  The chart never invents a hue. `industry` is the free text a person reads; `sector` is the
  machine's version of the same thing.
- `unknown` is a valid value everywhere and the correct one when you do not know. It renders in faint
  grey, visibly different from a field nobody filled in.
- `key_facts` is three to five lines, each a fact with a subject and a verb, not a topic. It is what
  shows on the card, so it is the only part most people read. A bullet containing `": "` is quoted,
  or YAML reads it as a map and the card shows `[object Object]`.
- `updated` is the day a person checked the file, not the last commit.
- `milestones` are dated events (day or month), `kind` one of `intro`, `call`, `meeting`,
  `workshop`, `decision`, `delivery`, `seminar`, `deadline`. The capacity timeline is built from
  them, so a meeting not recorded here is one nobody sees coming. A milestone sits on the company or
  on its project, never both: a company milestone is a relationship event, a project milestone a
  delivery event, and the check refuses the copy.
- `next_steps` is on projects only: one action starting with a verb, with the cofounder who carries
  it, and `waiting_on` when the step is someone else's to take. They are tickable on the dashboard,
  and a tick is a working signal, not an answer: the item leaves the list when the file changes.

## The body

Fixed sections, in this order, so two files compare. An empty section stays, with one line saying
what is missing.

```markdown
## Summary
What this company does and why it is on our list. Four to eight lines, for a cofounder who has never
heard of it.

## Where we stand
The relationship today: what is agreed, what is not, the next step and who carries it. Dated.

## Decisions
Project files only. One `### Title (YYYY-MM-DD)` per decision, with the reasoning and what was set
aside. What binds the whole company goes in the central `source/decisions.md`, and this links to it.

## What we learned
Bullets. What is true of this company and would take another meeting to rediscover: constraints,
vocabulary, who really decides, what they tried and what failed.

## People
A table: name, role, work email, what they do in the relationship, the last exchange.

## Journal
### 2026-09-16 · workshop · Drawing office, use-case session 2
Who was there, what was decided, what came out of it. Four to ten lines. Facts, not impressions.

## Open questions
What we do not know, and who could answer.
```

On *People*: everyone we actually exchanged with goes in, including people only seen in copy. The
work address goes in, nothing else personal. A role taken from a mail signature is marked
*signature*; one inferred from what the person does in a thread is marked *inferred*, and is
confirmed by reading the list aloud with our main contact. The last contact is a date and what it
was (`2026-09-16, follow-up mail`), because the real question of the table is whom to write to and
whether that will feel abrupt; a name with no date is someone we lost. Nobody is deleted: someone
who leaves keeps their last contact and a note that they left. The `contacts` block in the
frontmatter is the short version for the card.

## Writing one

Pull `customers`, copy the template, fill the frontmatter leaving `unknown` where you do not know,
write the body with `(who, YYYY-MM-DD)` on every claim about a person or a number, add the row to
`customers/INDEX.md`, run `npm run check` in `intranet/`, commit. The intranet picks it up at the
next build.

## What does not go in

- The customer's own business rules. They live in the customer's own repos.
- Phone numbers, home addresses, anything personal beyond a work email and a role.
- Your read on someone's competence or motives. Write what they said and did.
