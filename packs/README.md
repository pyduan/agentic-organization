# packs/

Installable bundles: skills, scripts, apps and formats that one project built and another can use.
One folder per pack, each with a `pack.json`. The format and the rules are in
[`../source/formats/pack.md`](../source/formats/pack.md).

**The kit never touches anything in here.** `packs/` is not a framework path, so an upgrade will
neither overwrite a pack nor report it as a collision. That is deliberate: it is what lets a pack
and the kit move independently.

`npm run packs` builds a readable catalogue of what is here into `apps/packs/index.html`: what each
pack adds, what it requires, what you have to set, and whether it is **maintenu** — someone answers
when it breaks — or **expérimental**, meaning it worked somewhere and you are the second.

That page is the whole store, on purpose. The hard part of sharing is triage, not distribution.

 The first pack is extracted from a project that already runs the thing.
