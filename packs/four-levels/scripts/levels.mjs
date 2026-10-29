#!/usr/bin/env node
// Where every product stands on the four levels, and whether the readiness gate holds.
//
// Reads one status file per product (formats/status.md) under productsPath. Prints the table by
// cluster, and refuses what the playbook's sequencing forbids: a level 4 evaluation started before
// levels 1 to 3 met their minimum, a level marked mve-met with no evidence line, a status outside
// the closed list. The counts in a report come from here, never typed by hand.
//
// Usage:
//   node packs/four-levels/scripts/levels.mjs                 the table, then findings
//   node packs/four-levels/scripts/levels.mjs --cluster <id>  one cluster
//   node packs/four-levels/scripts/levels.mjs --markdown      the table as Markdown, for a report
//   node packs/four-levels/scripts/levels.mjs --json
// Exit 1 when a finding fails the gate.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(PACK, '..', '..');
const settingsFile = existsSync(join(PACK, 'settings.json')) ? 'settings.json' : 'settings.example.json';
const settings = JSON.parse(await readFile(join(PACK, settingsFile), 'utf8'));
const args = process.argv.slice(2);
const only = args.includes('--cluster') ? args[args.indexOf('--cluster') + 1] : null;

const LEVELS = ['l1', 'l2', 'l3', 'l4'];
const HEADINGS = { l1: 'Level 1', l2: 'Level 2', l3: 'Level 3', l4: 'Level 4' };
const STATUSES = ['unknown', 'not-started', 'in-progress', 'mve-met', 'not-applicable'];
const RUNNING = ['in-progress', 'mve-met'];
const SHORT = { unknown: '?', 'not-started': '·', 'in-progress': 'running', 'mve-met': 'MVE met', 'not-applicable': 'n/a' };

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*?)\s*(#.*)?$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return fm;
}

// Evidence lines under "## Level N": "- YYYY-MM-DD · what · where".
function evidence(text) {
  const out = { l1: [], l2: [], l3: [], l4: [] };
  let current = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^##\s+Level\s+([1-4])\b/i);
    if (h) { current = `l${h[1]}`; continue; }
    if (/^##\s/.test(line)) { current = null; continue; }
    if (current && /^\s*-\s+\d{4}-\d{2}-\d{2}\s+·\s+.+·\s+\S+/.test(line)) out[current].push(line.trim());
  }
  return out;
}

async function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p));
    else if (e.name.endsWith('.md') && e.name !== 'README.md' && !e.name.startsWith('_')) files.push(p);
  }
  return files;
}

const productsDir = join(ROOT, settings.productsPath);
const rows = [];
const findings = [];
const add = (severity, file, detail) => findings.push({ severity, file, detail });

for (const file of await walk(productsDir)) {
  const text = await readFile(file, 'utf8');
  const fm = frontmatter(text);
  if (!fm || !LEVELS.some((l) => l in fm)) continue;
  const rel = relative(ROOT, file);
  const ev = evidence(text);
  const row = { file: rel, name: fm.name || '', product: fm.product || '', cluster: fm.cluster || '', owner: fm.owner || '', updated: fm.updated || '', version: fm.version || '' };
  for (const l of LEVELS) {
    const s = fm[l] || 'unknown';
    row[l] = s;
    row[`${l}_evidence`] = ev[l].length;
    if (!STATUSES.includes(s)) add('fail', rel, `${l}: "${s}" is not a status (${STATUSES.join(', ')})`);
    if (s === 'mve-met' && !ev[l].length) add('fail', rel, `${l} is mve-met with no dated evidence line under "## ${HEADINGS[l]}"`);
  }
  if (!fm.updated) add('warn', rel, 'no "updated" date, so nobody can tell how old these statuses are');
  if (RUNNING.includes(row.l4)) {
    const notMet = ['l1', 'l2', 'l3'].filter((l) => row[l] !== 'mve-met');
    if (notMet.length) add('fail', rel, `l4 is ${row.l4} while ${notMet.join(', ')} ${notMet.length > 1 ? 'have' : 'has'} not met the minimum: the playbook starts impact evaluation only after levels 1 to 3`);
    if (!fm.l4_ready) add('fail', rel, 'l4 is running with no l4_ready line naming the three readiness conditions as met');
    if (!row.version) add('fail', rel, 'l4 is running with no agent version: outcomes cannot be attributed to a version');
  }
  if (RUNNING.includes(row.l2) && !['mve-met', 'not-applicable'].includes(row.l1)) add('warn', rel, 'l2 runs before l1 met its minimum');
  if (RUNNING.includes(row.l3) && !['mve-met', 'not-applicable'].includes(row.l2)) add('warn', rel, 'l3 runs before l2 met its minimum (engagement first, or a process evaluation)');
  if (fm.cluster && !existsSync(join(ROOT, settings.clustersPath, `${fm.cluster}.md`))) add('warn', rel, `cluster "${fm.cluster}" has no file in ${settings.clustersPath}`);
  rows.push(row);
}

const shown = rows.filter((r) => !only || r.cluster === only).sort((a, b) => (a.cluster + a.name).localeCompare(b.cluster + b.name));
const fails = findings.filter((f) => f.severity === 'fail');

if (args.includes('--json')) {
  console.log(JSON.stringify({ products: shown, findings }, null, 2));
} else if (args.includes('--markdown')) {
  console.log('| Cluster | Organization | Product | L1 model | L2 product | L3 user | L4 impact | Updated |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of shown) {
    const cell = (l) => `${SHORT[r[l]] || r[l]}${r[`${l}_evidence`] ? ` (${r[`${l}_evidence`]})` : ''}`;
    console.log(`| ${r.cluster || 'none'} | ${r.name} | ${r.product} | ${cell('l1')} | ${cell('l2')} | ${cell('l3')} | ${cell('l4')} | ${r.updated} |`);
  }
  console.log('\nIn brackets: the number of dated evidence lines behind each status.');
} else {
  if (!shown.length) console.log(`No status files under ${settings.productsPath} yet (formats/status.md).`);
  let cluster = null;
  for (const r of shown) {
    if (r.cluster !== cluster) { cluster = r.cluster; console.log(`\n${cluster || '(no cluster)'}`); }
    console.log(`  ${(r.name + (r.product ? ` · ${r.product}` : '')).padEnd(48)} ${LEVELS.map((l) => `${l.toUpperCase()} ${SHORT[r[l]] || r[l]}`.padEnd(13)).join(' ')}`);
  }
  if (findings.length) console.log('');
  for (const f of findings) console.log(`  ${f.severity === 'fail' ? '✗' : '▲'} ${f.file}\n      ${f.detail}`);
  const byLevel = LEVELS.map((l) => `${l.toUpperCase()} ${shown.filter((r) => r[l] === 'mve-met').length}`).join(', ');
  console.log(`\n${fails.length ? '✗' : '✓'} ${shown.length} product(s); minimum met per level: ${byLevel}; ${fails.length} failure(s), ${findings.length - fails.length} warning(s)`);
}
process.exitCode = fails.length ? 1 : 0;
