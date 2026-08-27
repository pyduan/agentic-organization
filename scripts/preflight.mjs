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

import { readFile } from 'node:fs/promises';
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

const md = await readFile(join(ROOT, 'docs/failure-modes.md'), 'utf8');

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

let register = { incidents: [] };
try {
  register = JSON.parse(await readFile(join(ROOT, 'source/quality/incidents.json'), 'utf8'));
} catch { /* no register yet: the general list still applies */ }
const incidents = register.incidents || [];

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
if (!incidents.length) {
  say('This project has logged no incidents yet, so only the general list applies below.');
  say('An empty register after weeks of work usually means the reflection pass is recording');
  say('lessons but not the misses that produced them (source/quality/README.md).');
  say();
} else if (!mine.length) {
  say(`Register: ${incidents.length} logged, none in these families.`);
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
