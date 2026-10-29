#!/usr/bin/env node
// Join an operator's outcome data to the agent version each person actually used.
//
// Levels 3 and 4 measure people, and an AI product changes under them: the playbook notes that
// the single-version condition of an impact evaluation is almost always violated. So before any
// outcome is read, each person's outcome is attributed to the versions they were exposed to before
// it was measured. Someone exposed to two versions is "mixed" and is reported, never silently
// assigned to the last one.
//
// Inputs, both CSV with a header row, both person-level and therefore kept in dataPath, which
// Git must ignore:
//   exposures: person_id, timestamp, version          (one row per session or message, from the agent's logs)
//   outcomes:  person_id, measured_at, <any columns>  (the operator's export: a survey, a test, a field visit)
// Column names can be mapped: --person <col> --time <col> --version <col> --measured <col>.
//
// Output: the outcomes file with four columns added (exposure_count, versions_before,
// last_version, mixed), written to --out, which must be a gitignored path; and on stdout only
// aggregates: people per version, mixed, outcomes with no exposure, exposed people with no
// outcome. The aggregates are what a report may quote.
//
// Usage:
//   node packs/four-levels/scripts/join-versions.mjs --exposures <csv> --outcomes <csv> --out <csv> [--json]

import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : dflt);
const exposuresPath = opt('exposures');
const outcomesPath = opt('outcomes');
const outPath = opt('out');
const col = { person: opt('person', 'person_id'), time: opt('time', 'timestamp'), version: opt('version', 'version'), measured: opt('measured', 'measured_at') };

if (!exposuresPath || !outcomesPath || !outPath) {
  console.error('Usage: join-versions.mjs --exposures <csv> --outcomes <csv> --out <csv> [--json]');
  process.exit(2);
}

// Person-level rows never land where Git would pick them up.
function ignoredByGit(path) {
  try {
    execFileSync('git', ['check-ignore', '-q', resolve(path)], { cwd: dirname(resolve(path)), stdio: 'ignore' });
    return true;
  } catch (e) {
    return e.status === 128; // not inside a repository at all: nothing to leak into
  }
}
if (!ignoredByGit(outPath)) {
  console.error(`Refusing to write ${outPath}: Git does not ignore it, and it holds one row per person. Write it under dataPath (gitignored).`);
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  const [header, ...body] = rows;
  return { header, records: body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) };
}
const esc = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

const exposures = parseCsv(await readFile(exposuresPath, 'utf8'));
const outcomes = parseCsv(await readFile(outcomesPath, 'utf8'));
for (const [file, data, needed] of [[exposuresPath, exposures, [col.person, col.time, col.version]], [outcomesPath, outcomes, [col.person, col.measured]]]) {
  const missing = needed.filter((c) => !data.header.includes(c));
  if (missing.length) {
    console.error(`${file} has no column ${missing.join(', ')} (it has: ${data.header.join(', ')}). Map them with --person/--time/--version/--measured.`);
    process.exit(1);
  }
}

const time = (v, file) => {
  const t = Date.parse(v);
  if (Number.isNaN(t)) { console.error(`${file}: "${v}" is not a date. Fix the export rather than guess.`); process.exit(1); }
  return t;
};
const byPerson = new Map();
for (const e of exposures.records) {
  const list = byPerson.get(e[col.person]) || [];
  list.push({ t: time(e[col.time], exposuresPath), v: e[col.version] });
  byPerson.set(e[col.person], list);
}
for (const list of byPerson.values()) list.sort((a, b) => a.t - b.t);

const perVersion = new Map();
let mixed = 0, unexposed = 0;
const withOutcome = new Set();
const out = outcomes.records.map((o) => {
  withOutcome.add(o[col.person]);
  const before = (byPerson.get(o[col.person]) || []).filter((e) => e.t <= time(o[col.measured], outcomesPath));
  const versions = [...new Set(before.map((e) => e.v))];
  if (!before.length) unexposed++;
  else if (versions.length > 1) mixed++;
  else perVersion.set(versions[0], (perVersion.get(versions[0]) || 0) + 1);
  return { ...o, exposure_count: before.length, versions_before: versions.join('|'), last_version: before.length ? before[before.length - 1].v : '', mixed: versions.length > 1 };
});
const exposedNoOutcome = [...byPerson.keys()].filter((p) => !withOutcome.has(p)).length;

const header = [...outcomes.header, 'exposure_count', 'versions_before', 'last_version', 'mixed'];
await writeFile(outPath, [header.join(','), ...out.map((r) => header.map((h) => esc(r[h])).join(','))].join('\n') + '\n');

const summary = {
  outcomes: outcomes.records.length,
  singleVersion: Object.fromEntries([...perVersion.entries()].sort()),
  mixed,
  outcomesWithNoExposure: unexposed,
  exposedWithNoOutcome: exposedNoOutcome,
};
if (args.includes('--json')) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`${summary.outcomes} outcome row(s) joined, written to ${outPath}`);
  for (const [v, n] of Object.entries(summary.singleVersion)) console.log(`  version ${v}: ${n} outcome(s) from people who used only this version`);
  console.log(`  mixed (more than one version before the measure): ${mixed}`);
  console.log(`  outcomes with no exposure logged before them: ${unexposed}`);
  console.log(`  people exposed with no outcome in this export: ${exposedNoOutcome}`);
  if (mixed) console.log('\nMixed rows are kept and flagged. Decide in the analysis plan how they are treated, before reading any outcome.');
}
