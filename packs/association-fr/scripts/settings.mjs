// The pack's declared settings, read once.
//
// Everything an installing organization has to supply lives in settings.json
// next to pack.json, never inside a script. That is the property that makes this
// pack installable at all: extraction failed for the project it came from
// precisely because its name, its account and its admin URL were written through
// the code instead of declared at the top of it.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = dirname(dirname(fileURLToPath(import.meta.url)));

export function readSettings() {
  try {
    return JSON.parse(readFileSync(join(PACK, 'settings.json'), 'utf8'));
  } catch {
    throw new Error(
      'packs/association-fr/settings.json is missing. Copy settings.example.json to settings.json\n' +
      'and fill it in — the pack cannot guess your association, and refuses to run on a default.',
    );
  }
}
