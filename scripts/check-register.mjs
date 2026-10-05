#!/usr/bin/env node
// Does every entry in the incident register say what the schema lets it say?
//
// The register is only comparable across projects, and only countable at all,
// while its entries use the same seven families, three severities and five guard
// kinds. Nothing enforced that, so it drifted: one project's agent started filing
// incidents under words of its own, and the error report dropped them without a
// sign. This lists every field the schema does not allow, by entry, and exits 1
// while there is one. Schema: source/quality/README.md; vocabulary: lib/register.mjs.
//
// Usage:  node scripts/check-register.mjs [--register=<path>] [--json]

import { resolve } from 'node:path';
import { loadRegister, validate } from '../lib/register.mjs';

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const override = (args.find((a) => a.startsWith('--register=')) || '').slice(11) || undefined;

const reg = await loadRegister(ROOT, override ? { override } : undefined);
const rel = (p) => (p && p.startsWith(ROOT + '/') ? p.slice(ROOT.length + 1) : p);

// Not finding a register is reported as itself, never as a clean register.
if (!['ok', 'empty'].includes(reg.state)) {
  const msg = {
    missing: 'no register found (source/quality/incidents.json, or any incidents*.json below this folder)',
    ambiguous: `several registers, none chosen: ${reg.hits.map(rel).join(', ')}`,
    unreadable: `${rel(reg.path)} does not parse: ${reg.error}`,
    'bare-array': `${rel(reg.path)} is a bare array; entries go under { "version": 1, "incidents": [ … ] }`,
    'no-incidents': `${rel(reg.path)} has no \`incidents\` array`,
  }[reg.state];
  if (AS_JSON) console.log(JSON.stringify({ ok: false, state: reg.state, message: msg }));
  else console.log(`✘ ${msg}`);
  process.exit(reg.state === 'missing' ? 0 : 1);
}

const problems = validate(reg.incidents);
if (AS_JSON) {
  console.log(JSON.stringify({ ok: !problems.length, path: rel(reg.path), entries: reg.incidents.length, problems }, null, 2));
} else if (!problems.length) {
  console.log(`✓ ${reg.incidents.length} entr${reg.incidents.length === 1 ? 'y' : 'ies'} in ${rel(reg.path)}, all within the schema`);
} else {
  for (const p of problems) {
    console.log(`  ✘ ${p.id}  ${p.field}${p.value !== undefined ? ` = ${JSON.stringify(p.value)}` : ''} — ${p.why}`);
  }
  console.log(`\n✘ ${problems.length} problem(s) across ${new Set(problems.map((p) => p.id)).size} of ` +
    `${reg.incidents.length} entries in ${rel(reg.path)}`);
}
process.exit(problems.length ? 1 : 0);
