# customers

One file per company and one per project, from first contact to former customer. The pipeline is
these files; the intranet is only a view of them.

- `companies/`: one file per organization, whatever the stage. This is what the dashboard chart
  shows, one bar per company, as tall as its headcount.
- `projects/`: one file per engagement. A company can have several, or none.

The full format is in `__CENTRAL__` ▸ `packs/company/skills/customer-file/SKILL.md`. The templates are
`companies/TEMPLATE-company.md` and `projects/TEMPLATE-project.md`.

**What does not go here:** a customer's business rules. They live in the customer's own GitHub
organization. This repo holds our relationship with them.
