#!/usr/bin/env node
// Print the checks a task has to survive, before it is delivered — not after.
//
// Two lists, and the second is the one that matters:
//   1. docs/failure-modes.md  the general rules, from every project running this kit.
//   2. source/quality/incidents.json  what THIS project got wrong, and what now guards it.
//
// The register is written by the `feedback` skill when a mistake is caught. Nothing read it
// at the start, which made it a diary rather than a test suite. This is the read side.
//
// A repeat of something already in the register is worse than a new mistake: it says the
// register is not working. So the most repeated mistakes are printed first, computed from
// the register's `repeat_of` links rather than written anywhere in prose.
//
// A task is matched against each rule, not each family: a whole family printed for one
// cue word made a simple task print a hundred lines, and a list that long is not read.
// So at most CAP rules, the ones whose words the task shares most; the rules a mechanism
// already refuses on one line; register entries deduplicated by lesson, the unguarded
// first, at most REGISTER_CAP. `--all` lifts both caps.
//
// Zero dependencies, Node built-ins only.
//
// Usage:
//   node scripts/preflight.mjs --task "check the price adjustment and publish it"
//   node scripts/preflight.mjs numbers destructive      # every rule of these families
//   node scripts/preflight.mjs                          # every rule
//   node scripts/preflight.mjs --broken                 # only the most-repeated ranking
//   node scripts/preflight.mjs --all                    # no cap on rules or register entries
//   node scripts/preflight.mjs --full                   # each rule's test, and where its case is
//   node scripts/preflight.mjs --list                   # the family names and their keys
//   node scripts/preflight.mjs --lint                   # the guide keeps the shape read here
//   node scripts/preflight.mjs --register=<path>        # register kept somewhere else
//   node scripts/preflight.mjs --families=<path>        # failure-modes guide kept somewhere else
//
// Both inputs are also settable with KIT_REGISTER and KIT_FAILURE_MODES, and both
// are searched for if the canonical path is absent. A workshop that translated the
// kit's paths does not need a bridge script.

import { readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { FAMILIES, findFile, loadRegister, repeatChains, validate } from '../lib/register.mjs';

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const FULL = args.includes('--full');
const LIST = args.includes('--list');
const ALL = args.includes('--all');
const BROKEN = args.includes('--broken');
const TASK = (args.find((a) => a.startsWith('--task=')) || '').slice(7)
  || (args.includes('--task') ? args[args.indexOf('--task') + 1] || '' : '');

const CAP = 15;
const REGISTER_CAP = 10;
const BROKEN_TOP = 5;
// A rule is printed when the words it shares with the task weigh at least this much. A word
// found in one rule weighs about 5, a word found in a fifth of them about 1.6.
const THRESHOLD = 2.5;

// Words a task description uses for a rule that its own text does not say. Matched as
// prefixes of the task's words, like the stems below. Keyed by the rule's id in
// docs/failure-modes.md; a key that names no rule is reported by the test suite.
const CUES = {
  absence: ['missing', 'absent', 'lost', 'record'],
  'retrieving-not-reading': ['missing', 'invoice', 'attachment'],
  'inherited-missing': ['missing'],
  'search-bounds': ['missing', 'invoice', 'mail', 'inbox'],
  'search-by-question': ['find', 'look', 'call', 'meeting'],
  'own-files-first': ['email', 'mail', 'question', 'accountant', 'lawyer', 'ask'],
  'contact-dated': ['email', 'mail', 'accountant', 'bank', 'lawyer', 'contact'],
  'follow-up-looking': ['reply', 'answer', 'follow', 'waiting'],
  'you-draft': ['email', 'mail', 'message', 'send', 'draft', 'reply', 'chat', 'slack'],
  'sent-today': ['email', 'mail', 'message', 'send'],
  'message-id': ['email', 'mail', 'send'],
  'one-producer': ['price', 'figure', 'amount', 'total', 'number'],
  'frame-of-reference': ['price', 'figure', 'amount', 'number'],
  'status-field': ['figure', 'estimat', 'price', 'amount'],
  'independent-check': ['calculat', 'comput', 'verif', 'formula'],
  'subtract-contents': ['price', 'cost', 'value', 'amount'],
  'adjustment-base': ['adjust', 'price', 'index'],
  'reconcile-subtraction': ['reconcil', 'match', 'agree'],
  'extreme-result': ['calculat', 'model', 'simulat', 'forecast'],
  'sweep-fallen-fact': ['correct', 'update', 'fix', 'price', 'change'],
  'pipeline-exists': ['publish', 'deploy', 'live', 'site'],
  'repo-not-app': ['publish', 'deploy', 'live', 'site'],
  'look-once': ['deploy', 'live', 'site'],
  'publish-working-tree': ['publish', 'deploy'],
  'gate-runnable': ['deploy', 'publish'],
  'exit-code': ['test', 'publish', 'commit', 'deploy'],
  'rename-aside': ['delete', 'remove', 'clean', 'purge', 'reset', 'wipe'],
  'delete-forward': ['delete', 'remove', 'clean'],
  'destination-backup': ['backup', 'delete', 'migrat'],
  'copy-everything': ['backup', 'migrat'],
  'safeguard-axis': ['backup', 'archive', 'safeguard', 'recover'],
  'rescue-untracked': ['backup', 'save', 'stash'],
  inventory: ['clean', 'disk', 'space', 'delete', 'move', 'backup', 'old'],
  'measure-constraint': ['disk', 'space', 'quota', 'free'],
  'instrument-bound': ['disk', 'space'],
  'problem-behind-instruction': ['disk', 'space', 'free'],
  'destination-each-write': ['backup', 'disk', 'drive'],
  'integrity-source': ['backup', 'restore'],
  'api-guarantee': ['bulk', 'delete', 'api'],
  'absolute-number': ['disk', 'space', 'free'],
  'claim-note': ['shared', 'session'],
  'shared-consumers': ['token', 'stylesheet', 'helper', 'shared'],
  'commit-named': ['commit'],
  'read-staged-diff': ['commit'],
};

const STOP = new Set(('a an and or to of in on for it is be with about this that my our your from at by as its ' +
  'their them they we i you before after every one never not no what which all any each then than only own ' +
  'check is are was were do does did done has have had can will would should into out up so if else but ' +
  'make makes made get gets new old some more most same other test').split(' '));

// A crude stem: enough to make "publishing", "published" and "publish" one word.
const stem = (w) => w.replace(/(ations?|ings?|ed|es|s|ly)$/, '').slice(0, 7);
const words = (s) => (s.toLowerCase().match(/[a-z%][a-z%'-]*/g) || [])
  .map((w) => w.replace(/'s$/, '').replace(/[-']/g, ''))
  .filter((w) => w.length > 2 && !STOP.has(w));

const firstSentence = (s) => (s.match(/^.+?[.!?](?=\s|$)/) || [s])[0];
const short = (s, n = 88) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

const byKey = Object.fromEntries(FAMILIES.map((f) => [f.key, f]));

if (LIST) {
  for (const f of FAMILIES) console.log(`${f.key.padEnd(24)} §${f.section}  ${f.label}`);
  process.exit(0);
}

// ---------------------------------------------------------- locate the two inputs
// A workshop may translate the kit's paths (a French install keeps its register
// under a French name). Hardcoding them made this script announce "no incidents
// logged" over a register holding a hundred and nine — the exact failure it exists
// to prevent, reported by the owner of that workshop. So: the canonical path, then
// a flag or env var, then a bounded search (lib/register.mjs). And the outcomes are
// never conflated: found / found-and-empty / not-found-at-all / unreadable.

const flag = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3);

const modesAt = await findFile(
  ROOT,
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
const casesPath = join(dirname(modesAt.path), 'failure-cases.md');
const cases = await readFile(casesPath, 'utf8').catch(() => '');
const hasCase = (id) => new RegExp(`^### ${id}\\s*$`, 'm').test(cases);

// Each `## N · Title` section holds `- <a id="…"></a>**claim** Test: … ⛨ mechanism`
// bullets, sometimes under `### ` groups. A guide written before the ids existed still
// parses: its rules get an id made from their first words.
function parseRules(text) {
  const out = [];
  let section = null, group = '', buf = null;
  const flush = () => {
    if (!buf || section === null) { buf = null; return; }
    const raw = buf.join(' ').replace(/\s+/g, ' ').trim().replace(/^- /, '');
    const id = (raw.match(/^<a id="([^"]+)"><\/a>/) || [])[1];
    const body = raw.replace(/^<a id="[^"]+"><\/a>/, '');
    const claim = ((body.match(/^\*\*(.+?)\*\*/) || [, body])[1]).trim();
    const mech = [...body.matchAll(/⛨ ([\w:.-]+)/g)].map((m) => m[1]);
    const test = ((body.match(/Test: (.+?)(?: ⛨ |$)/) || [])[1] || '').trim();
    const slug = claim.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 4).join('-');
    out.push({ id: id || slug, section, group, claim, test, mech, text: body });
    buf = null;
  };
  for (const l of text.split('\n')) {
    const s = l.match(/^## (\d+) · /);
    if (s) { flush(); section = Number(s[1]); group = ''; continue; }
    if (/^## /.test(l)) { flush(); section = null; continue; }
    if (l.startsWith('### ')) { flush(); group = l.slice(4).trim(); continue; }
    if (l.startsWith('- ')) { flush(); buf = [l]; continue; }
    if (buf && l.startsWith('  ')) { buf.push(l.trim()); continue; }
    flush();
  }
  flush();
  return out;
}

const RULES = parseRules(md);

// --lint: the guide keeps the shape this script reads. Every rule has an id, once, and a
// test; every cue names a rule; every case names a rule. A rule renamed without its cues
// would stop being picked, and nothing would say so.
if (args.includes('--lint')) {
  const problems = [];
  const ids = new Set();
  for (const r of RULES) {
    if (!/^<a id="/.test(r.text) && !md.includes(`<a id="${r.id}">`)) problems.push(`no id: ${short(r.claim, 70)}`);
    if (ids.has(r.id)) problems.push(`id used twice: ${r.id}`);
    ids.add(r.id);
    if (!r.test) problems.push(`no "Test:" in ${r.id}`);
  }
  for (const k of Object.keys(CUES)) if (!ids.has(k)) problems.push(`a cue names no rule: ${k}`);
  for (const m of cases.matchAll(/^### ([\w-]+)\s*$/gm)) if (!ids.has(m[1])) problems.push(`a case names no rule: ${m[1]}`);
  for (const p of problems) console.log(`✘ ${p}`);
  console.log(`preflight --lint: ${RULES.length} rule(s), ${problems.length} problem(s) in ${relative(ROOT, modesAt.path)}`);
  process.exit(problems.length ? 1 : 0);
}

// ------------------------------------------------------------ which rules

// Each rule's vocabulary: its id, its claim, its test, and its cues. A word's weight is
// how rare it is among the rules, so "missing" picks out a few and "file" picks out none.
const vocab = RULES.map((r) => new Set([
  ...words(`${r.id.replace(/-/g, ' ')} ${r.claim} ${r.test}`).map(stem),
  ...(CUES[r.id] || []).map(stem),
]));
const df = new Map();
for (const v of vocab) for (const w of v) df.set(w, (df.get(w) || 0) + 1);
const idf = (w) => Math.log(RULES.length / (df.get(w) || RULES.length));

// Two stems are one word when they are equal, or when the shorter, five letters or more,
// starts the longer.
const same = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));
function score(task) {
  const t = [...new Set(words(task).map(stem))];
  return RULES.map((r, i) => {
    let total = 0;
    for (const w of t) {
      const hit = [...vocab[i]].filter((v) => same(w, v));
      if (hit.length) total += Math.max(...hit.map(idf));
    }
    return { rule: r, score: total };
  });
}

const named = args.filter((a) => byKey[a]);
let selected = [];
let more = 0;
let matched = true;
if (named.length) {
  const secs = new Set(named.map((k) => byKey[k].section));
  selected = RULES.filter((r) => secs.has(r.section));
} else if (TASK) {
  const ranked = score(TASK).filter((s) => s.score >= THRESHOLD).sort((a, b) => b.score - a.score);
  matched = ranked.length > 0;
  const kept = ALL ? ranked : ranked.slice(0, CAP);
  more = ranked.length - kept.length;
  const keep = new Set(kept.map((s) => s.rule));
  selected = RULES.filter((r) => keep.has(r));   // back in the guide's order
} else {
  selected = RULES;
}
const families = new Set(named.length
  ? named
  : matched && TASK ? selected.map((r) => FAMILIES.find((f) => f.section === r.section)?.key) : FAMILIES.map((f) => f.key));

// ---------------------------------------------------------------- the register

const registerAt = await loadRegister(ROOT, { override: flag('register') || process.env.KIT_REGISTER });
// The schema sits beside the register this run read, wherever the project keeps it.
const schema = registerAt.path ? relative(ROOT, join(dirname(registerAt.path), 'README.md')) : 'source/quality/README.md';
const register = registerAt.raw;
const registerError = registerAt.state === 'unreadable' ? registerAt.error : null;
// A file that parses but has no `incidents` array is its own outcome, and it used to
// collapse into "it is empty" — the very conflation the register's first entry is about,
// reproduced one level down.
const incidents = registerAt.incidents;
const shapeUnknown = registerAt.state === 'bare-array' || registerAt.state === 'no-incidents';
// An entry outside the seven families cannot be selected by family, so filtering by
// family made it invisible here for good. It is printed whatever the task.
const offSchema = incidents.filter((i) => !FAMILIES.some((f) => f.key === i.category));

// The rule an entry points at, when its guard names one: docs/failure-modes.md#<id>.
const ruleOf = (i) => {
  const m = String(i.guard?.where || '').match(/failure-modes(?:\.md)?#([\w-]+)/);
  return m ? m[1] : null;
};
const unguarded = (i) => !i.guard || !i.guard.kind || i.guard.kind === 'none';

// One lesson, one line: several entries with the same `generic` are one rule broken several
// times, and printing each made the list long without saying more. The unguarded first,
// because there the reader is the only check; then the most recent.
function pickEntries(list, cap = REGISTER_CAP) {
  const sorted = [...list].sort((a, b) =>
    (unguarded(b) - unguarded(a)) || String(b.date || '').localeCompare(String(a.date || '')));
  const seen = new Map();
  for (const i of sorted) {
    const key = (i.generic || i.error || i.id || '').trim().toLowerCase();
    if (seen.has(key)) seen.get(key).times++;
    else seen.set(key, { entry: i, times: 1 });
  }
  const all = [...seen.values()];
  return { shown: cap ? all.slice(0, cap) : all, more: cap ? Math.max(0, all.length - cap) : 0 };
}

// The most repeated mistakes, from `repeat_of` chains: a ranking computed every run, so
// it cannot go stale the way a "top five" written in a guide does.
function broken(list) {
  return [...repeatChains(list).entries()]
    .map(([root, rows]) => ({ root: rows[0], repeats: rows.length - 1, last: rows[rows.length - 1].date, rule: rows.map(ruleOf).find(Boolean) }))
    .sort((a, b) => b.repeats - a.repeats || String(b.last).localeCompare(String(a.last)));
}

// ------------------------------------------------------------ render

const say = (s = '') => console.log(s);
const wrap = (s, width, indent) =>
  s.split(' ').reduce((acc, w) => {
    const last = acc[acc.length - 1];
    if (last && (last + ' ' + w).length <= width) acc[acc.length - 1] = last + ' ' + w;
    else acc.push(w);
    return acc;
  }, []).join('\n' + indent);

function printBroken(limit) {
  const rows = broken(incidents);
  if (!registerAt.path || registerError || shapeUnknown) return;
  if (!rows.length) {
    say('Most broken: no repeat logged yet (mark one with `repeat_of` in the register).');
    say();
    return;
  }
  say('── Most broken here, by repeats ───────────────────────────────────');
  for (const r of rows.slice(0, limit)) {
    const at = r.rule ? `  #${r.rule}` : '';
    say(`   ${String(r.repeats).padStart(2)}× ${short(r.root.generic || r.root.error || r.root.id)}${at}`);
  }
  if (rows.length > limit) say(`   ${rows.length - limit} more: --broken`);
  say();
}

if (BROKEN) {
  say();
  printBroken(Infinity);
  if (!registerAt.path) say('No register found: nothing to rank.');
  process.exit(0);
}

say();
say('PREFLIGHT — the checks this task has to survive');
if (TASK) say(`Task: ${TASK}`);
say(`Families: ${[...families].join(', ')}`);
say();
printBroken(BROKEN_TOP);

// This project's own past mistakes come first. They are the ones already paid for.
const mine = [...incidents.filter((i) => families.has(i.category)), ...offSchema];
const problems = validate(incidents);
if (offSchema.length) {
  say(`⚠ ${offSchema.length} entr${offSchema.length > 1 ? 'ies are' : 'y is'} filed outside the seven families ` +
      `(${[...new Set(offSchema.map((i) => i.category || '(none)'))].join(', ')}), so they are shown below`);
  say('  whatever the task. Refile them under a family and keep the finer word in `tags`:');
  say('  `node scripts/check-register.mjs` lists every entry the schema does not allow.');
  say();
}
// The other fields are reported whatever the families do: an `else` here once hid a
// drifted severity or detector behind the family warning, until the families were fixed.
const otherProblems = problems.filter((p) => p.field !== 'category');
if (otherProblems.length) {
  const fields = [...new Set(otherProblems.map((p) => p.field))].join(', ');
  say(`⚠ ${otherProblems.length} problem(s) in the register's entries (${fields}) — \`node scripts/check-register.mjs\` lists them.`);
  say();
}
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
  say(`  Schema: ${schema}. Nothing this project has already got wrong is in`);
  say('  this run — the entries are there and this script cannot see them.');
  say();
} else if (!incidents.length) {
  say(`Register read (${registerAt.path.replace(ROOT + '/', '')}): it is empty.`);
  say('An empty register after weeks of work usually means lessons are recorded as rules');
  say(`and the misses that produced them are not (${schema}).`);
  say();
} else if (!mine.length) {
  say(`Register (${registerAt.path.replace(ROOT + '/', '')}): ${incidents.length} logged, none in these families.`);
  say();
} else {
  const { shown, more: rest } = pickEntries(mine, ALL ? 0 : REGISTER_CAP);
  say(`── Already made on this project, in these families (${mine.length}) ────────────`);
  say('   Repeating one of these is worse than a new mistake: it says the register is not working.');
  say();
  // One entry, two or three lines: the lesson's first sentence and what guards it. The whole
  // lesson and the guard's full place with --full.
  for (const { entry: i, times } of shown) {
    const where = i.guard?.where ? ` (${FULL ? i.guard.where : short(i.guard.where, 60)})` : '';
    const guard = unguarded(i) ? 'NOTHING GUARDS THIS — you are the check' : `guarded by ${i.guard.kind}${where}`;
    const lesson = i.generic || i.error || '(no lesson recorded)';
    say(`   [${i.severity || '?'}] ${i.date || ''} ${i.category}${times > 1 ? ` ×${times}` : ''} · ${guard}`);
    say(`   ${wrap(FULL ? lesson : firstSentence(lesson), 92, '   ')}`);
  }
  say();
  if (rest) { say(`   ${rest} more: --all`); say(); }
}

if (TASK && !named.length && !matched) {
  say('No rule in docs/failure-modes.md shares a word with this task. Name the families instead');
  say('(`node scripts/preflight.mjs --list`), or describe the task in more words.');
  say();
} else {
  const held = selected.filter((r) => r.mech.length);
  const open = selected.filter((r) => !r.mech.length);
  let section = null, group = '';
  for (const r of open) {
    if (r.section !== section) {
      section = r.section; group = '';
      const f = FAMILIES.find((x) => x.section === section);
      say(`── §${section} ${f ? f.label : ''} ───────────────────────────────────`);
    }
    if (r.group && r.group !== group) { group = r.group; say(`   ${group}:`); }
    say(`   [ ] ${wrap(r.claim, 92, '       ')}`);
    if (FULL && r.test) say(`       test: ${wrap(r.test, 86, '             ')}`);
    if (FULL && hasCase(r.id)) say(`       case: docs/failure-cases.md#${r.id}`);
  }
  if (open.length) say();
  if (held.length) {
    say(`Held by a mechanism, so do the check when it blocks: ${held.map((r) => `${r.id} (${r.mech.join(', ')})`).join(', ')}.`);
    say();
  }
  if (more) { say(`${more} more rule(s) share a word with this task: --all`); say(); }
}

say('Anything you cannot tick, say so in the handover rather than delivering past it.');
say('Each rule\'s test: --full, or docs/failure-modes.md#<id>.');
say();
