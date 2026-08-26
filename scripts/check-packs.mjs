#!/usr/bin/env node
// Is every pack in this repo actually installable somewhere else?
//
// The rule a pack lives or dies by is that it only ADDS files, never edits one
// the kit owns. Stated in prose it is a request; checked here it is a property.
// Without it, installing two packs means merging two patches to the same core
// file, and upgrading the kit means merging three — the mess this whole shape
// exists to avoid.
//
// Usage:  node scripts/check-packs.mjs [--json]

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AS_JSON = process.argv.includes('--json');
const findings = [];
const add = (severity, pack, detail) => findings.push({ severity, pack, detail });

// The paths the kit owns. A pack that writes here is not a pack.
const FRAMEWORK = ['.claude/', 'docs/', 'scripts/', 'lib/', 'source/formats/', 'apps/dashboard/',
  'apps/todos/', 'CLAUDE.md', 'SETUP.md', 'README.md', 'CHANGELOG.md', 'package.json', 'wrangler.jsonc'];

const KNOWN = ['skills', 'scripts', 'apps', 'formats', 'files'];

let packs = [];
try {
  packs = (await readdir(join(ROOT, 'packs'), { withFileTypes: true }))
    .filter((e) => e.isDirectory()).map((e) => e.name);
} catch { /* no packs/ yet is fine */ }

for (const slug of packs.sort()) {
  const dir = join(ROOT, 'packs', slug);
  const manifestPath = join(dir, 'pack.json');
  if (!existsSync(manifestPath)) {
    add('fail', slug, 'has no pack.json, so nothing can know what it installs or needs');
    continue;
  }

  let m;
  try { m = JSON.parse(await readFile(manifestPath, 'utf8')); }
  catch (e) { add('fail', slug, `pack.json does not parse: ${e.message}`); continue; }

  for (const field of ['name', 'title', 'description', 'suits', 'requires', 'adds']) {
    if (!m[field]) add('fail', slug, `pack.json has no "${field}"`);
  }
  if (m.name && m.name !== slug) add('warn', slug, `pack.json says name "${m.name}" but the folder is "${slug}"`);
  if (m.requires && !m.requires.kit) add('warn', slug, 'requires.kit is unset, so nothing can tell whether a project is new enough for it');

  // Everything it claims to add must exist, and none of it may sit in a kit path.
  for (const [kind, entries] of Object.entries(m.adds || {})) {
    if (!KNOWN.includes(kind)) add('warn', slug, `"adds.${kind}" is not a known kind (${KNOWN.join(', ')})`);
    for (const entry of [].concat(entries)) {
      if (FRAMEWORK.some((f) => entry.startsWith(f) || entry === f.replace(/\/$/, ''))) {
        add('fail', slug, `adds "${entry}", which the kit owns — a pack adds files, it never edits the kit's`);
      }
      if (!existsSync(join(dir, kind, entry)) && !existsSync(join(dir, entry))) {
        add('fail', slug, `declares "${entry}" under ${kind}, but there is no such file in the pack`);
      }
    }
  }

  // Settings are how a pack stops being one organization's copy.
  for (const [key, def] of Object.entries(m.settings || {})) {
    if (!def || !def.description) add('warn', slug, `setting "${key}" has no description, so an installer cannot ask for it`);
  }
  if (m.settings && !Object.keys(m.settings).length) {
    add('warn', slug, 'declares no settings at all — check that no project-specific value is baked into its files');
  }
}

const fails = findings.filter((f) => f.severity === 'fail');
const warns = findings.filter((f) => f.severity === 'warn');

if (AS_JSON) {
  console.log(JSON.stringify({ packs: packs.length, findings }, null, 2));
} else if (!packs.length) {
  console.log('packs: none yet. The first one is extracted from a project that already runs the thing.');
} else {
  for (const f of findings) {
    console.log(`  ${f.severity === 'fail' ? '✗' : '▲'} ${f.pack}\n      ${f.detail}`);
  }
  console.log(`\n${fails.length ? '✗' : '✓'} ${packs.length} pack(s), ${fails.length} failure(s), ${warns.length} warning(s)`);
}
process.exitCode = fails.length ? 1 : 0;
