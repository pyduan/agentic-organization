# Upstream

The published evaluation skills this pack calls, imported by `scripts/import-upstream.mjs` at the
commit `sources.json` pins. Nothing here is written by this pack, and nothing here is edited by
hand: a change belongs to its authors, proposed to them, and arrives with the next import.

`node packs/four-levels/scripts/import-upstream.mjs --status` says what is imported, from which
commit and when. A source whose licence does not allow redistribution stays on the machine that
imported it (`.gitignore`); `PROVENANCE.json` in each folder carries its licence and how to credit it.
