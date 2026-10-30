#!/usr/bin/env node
// Runs the tests of whichever packs this repository holds.
//
// A pack is optional: an instance installs the ones it wants and deletes the rest. Naming a
// pack's test in `npm test` would break the suite of every instance that removed the pack, so
// the tests are found on disk instead: packs/<slug>/scripts/test-*.mjs.
//
// Usage:  node scripts/test-packs.mjs

import { readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PACKS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packs');
const files = existsSync(PACKS)
  ? readdirSync(PACKS, { withFileTypes: true }).filter((d) => d.isDirectory())
    .flatMap((d) => {
      const dir = join(PACKS, d.name, 'scripts');
      return existsSync(dir) ? readdirSync(dir).filter((f) => /^test-.*\.mjs$/.test(f)).map((f) => join(dir, f)) : [];
    })
  : [];

if (!files.length) {
  console.log('No pack tests here.');
  process.exit(0);
}
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
