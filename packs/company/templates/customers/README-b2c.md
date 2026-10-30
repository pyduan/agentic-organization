# customers

The pipeline. For a company that sells to individuals, it is made of two different things, which is
why there are two folders.

- `segments/`: one file per group of people who share a reason to buy. This is what the dashboard
  chart shows, one bar per segment, as tall as its population.
- `partners/`: one file per organization we have a real conversation with. Installers, resellers,
  clubs, media. These are named accounts, with a contact and a journal.
- `projects/`: one file per dated piece of work. A pilot, a launch, a production run.

**A segment is not a list of characteristics.** "Cyclists over fifty" describes people; it does not
say why they would take out their card. A segment shares a reason to buy, and its file must be able
to write it in one sentence.

**A partner is not a customer.** They do not pay, they bring. The "What they get out of it" section
of their file is the one people forget to write and the one that decides everything.

The templates are `segments/TEMPLATE-segment.md`, `partners/TEMPLATE-partner.md` and
`projects/TEMPLATE-project.md`.
