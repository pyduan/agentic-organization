#!/usr/bin/env node
// Print the checks a task has to survive, before it is delivered — not after.
//
// Two lists, and the second is the one that matters:
//   1. docs/failure-modes.md  the general families, from every project running this kit.
//   2. source/quality/incidents.json  what THIS project got wrong, and what now guards it.
//
// The register is written at the end of a session by the `reflect` skill. Nothing read it
// at the start, which made it a diary rather than a test suite. This is the read side.
//
// A repeat of something already in the register is worse than a new mistake: it says the
// register is not working. So repeats are printed first and loudly.
//
// Zero dependencies, Node built-ins only.
//
// Usage:
//   node scripts/preflight.mjs                          # every family
//   node scripts/preflight.mjs numbers destructive      # only these
//   node scripts/preflight.mjs --task "check the price adjustment and publish it"
//   node scripts/preflight.mjs --full                   # whole rule, not just its claim
//   node scripts/preflight.mjs --list                   # the family names and their keys
//   node scripts/preflight.mjs --register=<path>        # register kept somewhere else
//   node scripts/preflight.mjs --families=<path>        # failure-modes guide kept somewhere else
//
// Both inputs are also settable with KIT_REGISTER and KIT_FAILURE_MODES, and both
// are searched for if the canonical path is absent. A workshop that translated the
// kit's paths does not need a bridge script.

import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const FULL = args.includes('--full');
const LIST = args.includes('--list');
const TASK = (args.find((a) => a.startsWith('--task=')) || '').slice(7)
  || (args.includes('--task') ? args[args.indexOf('--task') + 1] || '' : '');

// The seven keys are the same vocabulary as source/quality/README.md and error-report.mjs.
// `section` is the heading number in docs/failure-modes.md; `cues` are what makes a task
// touch that family, matched against the --task description.
const FAMILIES = [
  {
    key: 'searched-too-late',
    section: 1,
    label: 'Acting before looking',
    cues: ['search', 'find', 'look', 'missing', 'absent', 'does not exist', 'no record', 'inventory', 'corpus', 'archive', 'document', 'contract', 'clause', 'read', 'summar', 'ask', 'question'],
  },
  {
    key: 'status-of-information',
    section: 2,
    label: 'Status of information',
    cues: ['assum', 'hypothes', 'estimate', 'likely', 'probabl', 'to verify', 'to confirm', 'draft', 'plan', 'account', 'identity', 'deadline', 'test'],
  },
  {
    key: 'numbers',
    section: 3,
    label: 'Producing and reading figures',
    cues: ['calculat', 'comput', 'number', 'figure', 'amount', 'total', 'percent', '%', 'ratio', 'model', 'simulat', 'forecast', 'compare', 'count', 'measur', 'threshold', 'rank', 'price', 'cost', 'valu', 'budget'],
  },
  {
    key: 'expiry',
    section: 4,
    label: 'Silent expiry',
    cues: ['publish', 'update', 'deploy', 'live', 'page', 'summary', 'recap', 'dashboard', 'status', 'deadline', 'decision', 'correct', 'stale', 'refresh'],
  },
  {
    key: 'destructive',
    section: 5,
    label: 'Actions on files and the machine',
    cues: ['delete', 'remove', 'move', 'rename', 'clean', 'purge', 'backup', 'restore', 'archive', 'sync', 'copy', 'migrat', 'disk', 'space', 'script', 'tool', 'cron', 'schedul', 'permission', 'watchdog', 'guard', 'safeguard'],
  },
  {
    key: 'handover',
    section: 6,
    label: 'Handover and the relationship',
    cues: ['deliver', 'report', 'note', 'brief', 'app', 'page', 'explain', 'next step', 'recommend', 'advice', 'present', 'send', 'draft', 'answer'],
  },
  {
    key: 'parallel-sessions',
    section: 7,
    label: 'Parallel sessions',
    cues: ['commit', 'push', 'publish', 'deploy', 'shared', 'token', 'stylesheet', 'session', 'branch', 'merge'],
  },
];

const byKey = Object.fromEntries(FAMILIES.map((f) => [f.key, f]));

if (LIST) {
  for (const f of FAMILIES) console.log(`${f.key.padEnd(24)} §${f.section}  ${f.label}`);
  process.exit(0);
}

// ------------------------------------------------------------ which families

const named = args.filter((a) => byKey[a]);
const cued = TASK
  ? FAMILIES.filter((f) => f.cues.some((c) => TASK.toLowerCase().includes(c)))
  : [];
// A task description that matches nothing is a description too short to trust, not a task
// with no failure modes. Fall back to everything rather than to silence.
const selected = named.length
  ? named.map((k) => byKey[k])
  : cued.length
    ? cued
    : FAMILIES;

// ------------------------------------------------------------ the two lists

// ---------------------------------------------------------- locate the two inputs
// A workshop may translate the kit's paths (a French install keeps its register
// under a French name). Hardcoding them made this script announce "no incidents
// logged" over a register holding a hundred and nine — the exact failure it exists
// to prevent, reported by the owner of that workshop. So: the canonical path, then
// a flag or env var, then a bounded search. And the three outcomes are never
// conflated: found / found-and-empty / not-found-at-all.

const flag = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3);

async function findFile(canonical, matches, override) {
  if (override) return { path: resolve(ROOT, override), how: 'given' };
  if (await readFile(join(ROOT, canonical), 'utf8').then(() => true, () => false)) {
    return { path: join(ROOT, canonical), how: 'canonical' };
  }
  // Bounded walk: deep enough to find a renamed folder, shallow enough to stay instant.
  const hits = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.astro', '.wrangler']);
  const walk = async (dir, depth) => {
    if (depth > 4 || hits.length > 8) return;
    let entries = [];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.claude') continue;
      if (skip.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full, depth + 1);
      else if (matches(e.name)) hits.push(full);
    }
  };
  await walk(ROOT, 0);
  if (hits.length === 1) return { path: hits[0], how: 'found' };
  if (hits.length > 1) return { path: null, how: 'ambiguous', hits };
  return { path: null, how: 'missing' };
}

const modesAt = await findFile(
  'docs/failure-modes.md',
  (n) => /failure[-_]?modes?.*\.md$/i.test(n) || /modes?[-_]?(de[-_]?)?d[eé]faillance.*\.md$/i.test(n),
  flag('families') || process.env.KIT_FAILURE_MODES,
);
if (!modesAt.path) {
  console.error(`preflight: could not find the failure-modes guide (docs/failure-modes.md).`);
  if (modesAt.how === 'ambiguous') console.error(`  Several candidates: ${modesAt.hits.join(', ')}`);
  console.error(`  Point at it with --families=<path> or KIT_FAILURE_MODES=<path>.`);
  process.exit(2);
}
const md = await readFile(modesAt.path, 'utf8');

// Each `## N · Title` section holds `- **claim…**` bullets, sometimes under `### ` groups.
// Take the bold lead of each bullet as its claim: that is the assertion to check.
function rulesFor(section) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${section} · `));
  if (start === -1) return [];
  let end = lines.findIndex((l, i) => i > start && /^## \d+ · /.test(l));
  if (end === -1) end = lines.length;

  const out = [];
  let group = '';
  let buf = null;
  const flush = () => {
    if (!buf) return;
    const text = buf.join(' ').replace(/\s+/g, ' ').trim();
    const claim = (text.match(/^- \*\*(.+?)\*\*/s) || [, text.replace(/^- /, '')])[1];
    out.push({ group, claim: claim.replace(/\s+/g, ' ').trim(), text: text.replace(/^- /, '') });
    buf = null;
  };
  for (let i = start + 1; i < end; i++) {
    const l = lines[i];
    if (l.startsWith('### ')) { flush(); group = l.slice(4).trim(); continue; }
    if (l.startsWith('- ')) { flush(); buf = [l]; continue; }
    if (buf && l.startsWith('  ')) { buf.push(l.trim()); continue; }
    flush();
  }
  flush();
  return out;
}

const registerAt = await findFile(
  'source/quality/incidents.json',
  (n) => /^incidents?\.json$/i.test(n) || /^incidents?[-_].*\.json$/i.test(n),
  flag('register') || process.env.KIT_REGISTER,
);
let register = null;      // null means: no register file found. Not the same as empty.
let registerError = null; // a file that exists but will not parse is a third thing again.
if (registerAt.path) {
  try { register = JSON.parse(await readFile(registerAt.path, 'utf8')); }
  catch (e) { registerError = e.message; }
}
// A file that parses but has no `incidents` array is a FOURTH outcome, and it used to
// collapse into "it is empty" — the very conflation the register's first entry is about,
// reproduced one level down. A bare array is the likely shape: the schema example in
// source/quality/README.md shows one entry, so a register hand-started from it comes out
// as [ … ] rather than { incidents: [ … ] }.
const incidents = Array.isArray(register?.incidents) ? register.incidents : [];
const shapeUnknown = register !== null && !Array.isArray(register?.incidents);

// ------------------------------------------------------------ render

const say = (s = '') => console.log(s);
const wrap = (s, width, indent) =>
  s.split(' ').reduce((acc, w) => {
    const last = acc[acc.length - 1];
    if (last && (last + ' ' + w).length <= width) acc[acc.length - 1] = last + ' ' + w;
    else acc.push(w);
    return acc;
  }, []).join('\n' + indent);

say();
say('PREFLIGHT — the checks this task has to survive');
if (TASK) say(`Task: ${TASK}`);
say(`Families: ${selected.map((f) => f.key).join(', ')}`);
say();

// This project's own past mistakes come first. They are the ones already paid for.
const mine = incidents.filter((i) => selected.some((f) => f.key === i.category));
if (!registerAt.path) {
  // NOT the same as "no incidents". Say which is which, loudly: a check that reports
  // "all clear" when it simply could not read its input is worse than no check.
  say('⚠ NO REGISTER FOUND — this is not the same as "no mistakes logged".');
  say(`  Looked for source/quality/incidents.json under ${ROOT}, and for any incidents*.json`);
  if (registerAt.how === 'ambiguous') say(`  Several candidates, so none was chosen: ${registerAt.hits.join(', ')}`);
  say('  If this project keeps its register elsewhere (a translated path, another folder),');
  say('  point at it: --register=<path>, or set KIT_REGISTER. Everything below is the');
  say("  general list only, and it does NOT include what this project has already got wrong.");
  say();
} else if (registerError) {
  say(`⚠ REGISTER UNREADABLE at ${registerAt.path}`);
  say(`  ${registerError}`);
  say('  Fix it before trusting anything below: the project\'s own mistakes are not in this run.');
  say();
} else if (shapeUnknown) {
  say(`⚠ REGISTER SHAPE UNRECOGNISED at ${registerAt.path.replace(ROOT + '/', '')}`);
  say(`  It parsed, but there is no \`incidents\` array in it${Array.isArray(register)
    ? ': the file is a bare array, and the entries belong under { "version": 1, "incidents": [ … ] }.'
    : '.'}`);
  say('  Schema: source/quality/README.md. Nothing this project has already got wrong is in');
  say('  this run — the entries are there and this script cannot see them.');
  say();
} else if (!incidents.length) {
  say(`Register read (${registerAt.path.replace(ROOT + '/', '')}): it is empty.`);
  say('An empty register after weeks of work usually means the reflection pass is recording');
  say('lessons but not the misses that produced them (source/quality/README.md).');
  say();
} else if (!mine.length) {
  say(`Register (${registerAt.path.replace(ROOT + '/', '')}): ${incidents.length} logged, none in these families.`);
  say();
} else {
  say(`── Already made on this project, in these families (${mine.length}) ────────────`);
  say('   Repeating one of these is worse than a new mistake: it says the register is not working.');
  say();
  for (const i of mine) {
    const guard = !i.guard || i.guard.kind === 'none'
      ? 'NOTHING GUARDS THIS — you are the check'
      : `guarded by ${i.guard.kind}${i.guard.where ? ` (${i.guard.where})` : ''}`;
    say(`   [${i.severity || '?'}] ${i.date || ''} ${i.category}`);
    say(`   ${wrap(i.generic || i.error || '(no lesson recorded)', 92, '   ')}`);
    say(`   ${guard}`);
    say();
  }
}

for (const f of selected) {
  const rules = rulesFor(f.section);
  say(`── §${f.section} ${f.label} (${rules.length}) ───────────────────────────────────`);
  let group = '';
  for (const r of rules) {
    if (r.group && r.group !== group) { group = r.group; say(`   ${group}:`); }
    say(`   [ ] ${wrap(FULL ? r.text : r.claim, 92, '       ')}`);
  }
  say();
}

say('Anything you cannot tick, say so in the handover rather than delivering past it.');
say();
