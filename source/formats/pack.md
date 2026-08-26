# Packs — how a project's good idea becomes reusable

A pack is a **bundle of additions that someone can install into their own project**: skills,
scripts, apps, formats, and the configuration they need. It exists so that what one organization
built for itself can serve the next one without either of them touching the other's repo.

The association tooling that grew inside one project — membership imports, donation receipts,
a members' argumentaire, a social-post format — is the case this was designed from. It is genuinely
useful to any small association running the kit, and today it is unextractable, for reasons the
rules below name.

**There is deliberately no store.** The hard part of sharing is not distribution, which is copying
files, but triage: deciding whether something is general, local, or a fifth implementation of what
the kit already does. A store solves the easy half and multiplies the hard half. What matters now is
that the *unit* exists and is clean, so that a registry later can be a markdown file rather than a
product.

## The four rules, and why each one exists

**1. A pack only ever adds files. It never edits one the kit owns.**

This is the rule that keeps a fleet from becoming a mess, and it is the one worth being rigid about.
The moment a pack patches `webapp.md` or a core skill, installing two packs means merging two
patches, and upgrading the kit means merging three. If a pack genuinely needs core to change, that
is a change to the kit, proposed on its own — not smuggled in as a dependency.

It is also mechanically checkable, which is why `scripts/check-packs.mjs` exists rather than a
paragraph asking nicely.

**2. A pack lives in its own namespace, and the kit never touches it.**

`packs/<slug>/`. Nothing under `packs/` is in the framework path list, so an upgrade never
overwrites a pack and a pack never shows up as a collision. That property is the whole reason the
namespace is separate; do not scatter a pack's files into `.claude/skills/` and `scripts/` to save
a directory level.

**3. What is project-specific is declared, not baked in.**

This is why the association tooling cannot be installed elsewhere today: the association's name, its
colours, its payment account and its members' file shape are written through the code rather than
declared at the top of it. Extraction then means reading every file and guessing which strings were
decisions.

So a pack names its settings in its manifest, with a description and a default where one makes
sense, and the installer asks for them once.

**4. A pack declares what it needs, so incompatibility is detected rather than discovered.**

Which kit version it was built against, which external services it assumes, which other packs it
expects. `.kit-sync` already records the baseline a project is on, so `requires.kit` is checkable
before anything is copied.

## The manifest

`packs/<slug>/pack.json`:

```json
{
  "id": "pk-3f9a2c",
  "name": "association-fr",
  "title": "Association loi 1901",
  "description": "Adhésions, reçus fiscaux, argumentaire, et le suivi d'une AG.",
  "suits": "A small French association with members, donations and an annual general meeting.",
  "requires": { "kit": "2026-08-26", "services": ["HelloAsso"] },
  "adds": {
    "skills": ["admin"],
    "scripts": ["import-adhesions-csv.mjs"],
    "apps": ["argumentaire"],
    "formats": ["visuel.md"]
  },
  "settings": {
    "associationName": { "description": "Nom exact, tel qu'il figure aux statuts" },
    "helloassoSlug": { "description": "Le slug de la campagne HelloAsso" }
  }
}
```

## The id, and why it is not the name

Every pack carries a permanent `id` of the form `pk-<hex>`, generated once and **never changed**.

It exists for one reason: feedback has to reach the right pack. A folder gets renamed, a title gets
rewritten, two organizations independently call theirs `association`. If a bug report points at a
name, then the day the name moves, yesterday's report attaches to nothing — or, worse, to a
different pack that now holds that name. An id does not move, so a report from a year ago still
resolves, and two packs can never quietly become the same one.

So: report against the id, version against the id, and let the folder and the title be as readable
as they like. `check-packs.mjs` refuses a duplicate and a malformed one.

## Extracting one is the test

If pulling a pack out of the project it grew in is painful, the boundary is wrong, and the pack is
not ready. The painful parts are always the same two: values that were never declared, and files
that reach into the host project's own content. Fix those in the source project first — it benefits
from the clarity anyway — and the extraction becomes a copy.

Run `node scripts/check-packs.mjs` before offering a pack to anyone. It is faster than a reviewer.
