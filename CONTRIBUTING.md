# Contributing

What your organization learns while running the kit can come back into it in three ways, from the
lightest to the heaviest. The maintainer ([@pyduan](https://github.com/pyduan)) triages each one by
hand, and nothing merges or ships by itself.

**An error report.** When the rules let your agent get something wrong, the incident goes in your
`source/quality/incidents.json`. `node scripts/error-report.mjs --anonymized --email` turns it
into a report that keeps only the general lesson of each entry, with nothing about you, your
clients, your documents or your amounts. Send it. It's the most useful of the three, because it
says what broke in real use and nothing else does.

**A pack.** A skill, a script or an app your project built and already runs, which another
organization could install. It goes in `packs/<slug>/` with its `pack.json`
([`source/formats/pack.md`](source/formats/pack.md)) and arrives as a pull request. It starts
`experimental`, meaning it worked once somewhere, and becomes `canonical` when someone commits to
answering when it breaks. The catalogue (`npm run packs`) shows which is which.

**A pull request on the kit itself.** A fix, or a rule that holds for anyone using the kit, not
only for you. Keep the diff narrow, and before opening it:

- invent every example, because this repo is public: no real person, client, project or amount
  from your own repos;
- add the `CHANGELOG.md` entry when other organizations have to know or do something, and end the
  commit with a `Retroactive:` trailer when it changes a rule (`AGENTS.md` ▸ *Working rules*);
- run `npm test`.

Triage reads each contribution for one question: is it true for organizations that aren't yours?
The answer can be yes, yes once its names are taken out, or no, and a no comes with its reason.
