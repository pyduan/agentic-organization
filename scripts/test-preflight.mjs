// preflight, tested on throwaway projects.
//
// A task used to print every rule of every family one cue word touched: a hundred lines and
// more for "draft an email", which is a list nobody reads. These hold the caps, the order of
// the register, the one line for rules a mechanism holds, and the ranking computed from
// `repeat_of` that replaced any "most broken" list written by hand.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREFLIGHT = resolve(HERE, 'preflight.mjs');
const GUIDE = readFileSync(resolve(HERE, '../docs/failure-modes.md'), 'utf8');

const entry = (id, over = {}) => ({
  id, date: '2026-09-10', category: 'numbers', severity: 'major', detected_by: 'owner',
  guard: { kind: 'rule', where: 'docs/x.md' }, generic: `lesson ${id}.`, ...over,
});

function project(incidents, { guide = GUIDE, cases } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'preflight-'));
  mkdirSync(join(dir, 'source/quality'), { recursive: true });
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'source/quality/incidents.json'), JSON.stringify({ version: 1, incidents }));
  writeFileSync(join(dir, 'docs/failure-modes.md'), guide);
  if (cases !== undefined) writeFileSync(join(dir, 'docs/failure-cases.md'), cases);
  return dir;
}
const run = (dir, ...a) => {
  const r = spawnSync('node', [PREFLIGHT, ...a], { cwd: dir, encoding: 'utf8', env: { ...process.env, KIT_REGISTER: '', KIT_FAILURE_MODES: '' } });
  return { ...r, rules: (r.stdout.match(/^ {3}\[ \] /gm) || []).length };
};

test('the kit guide keeps the shape preflight reads', () => {
  const r = spawnSync('node', [PREFLIGHT, '--lint'], { cwd: resolve(HERE, '..'), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /0 problem\(s\)/);
});

test('--lint names a rule with no test, an id used twice, and a case for no rule', () => {
  const guide = '# x\n\n## 1 · One\n\n- <a id="a"></a>**First.** Test: look.\n- <a id="a"></a>**Second.** No test here.\n';
  const r = spawnSync('node', [PREFLIGHT, '--lint'], { cwd: project([], { guide, cases: '### a\n\n### gone\n' }), encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /id used twice: a/);
  assert.match(r.stdout, /no "Test:" in a/);
  assert.match(r.stdout, /a case names no rule: gone/);
});

test('a task prints at most fifteen rules, and says how many more there are', () => {
  const dir = project([]);
  const task = 'delete old backup files to free disk space, then publish the figures and email the accountant about the missing invoice';
  const capped = run(dir, '--task', task);
  assert.equal(capped.status, 0, capped.stderr);
  const held = (capped.stdout.match(/^Held by a mechanism.*$/m) || [''])[0].split('), ').filter(Boolean).length;
  assert.ok(capped.rules + held <= 15, `${capped.rules} rules and ${held} held`);
  const more = Number((capped.stdout.match(/(\d+) more rule\(s\) share a word with this task: --all/) || [])[1]);
  assert.ok(more > 0, 'the rest is counted, not dropped in silence');
  assert.ok(run(dir, '--task', task, '--all').rules > capped.rules);
});

test('a short task prints a short list', () => {
  const r = run(project([]), '--task', 'draft an email to the accountant about the missing invoice');
  assert.ok(r.rules > 0 && r.rules <= 15);
  assert.ok(r.stdout.split('\n').length < 60, `${r.stdout.split('\n').length} lines`);
});

test('a rule a mechanism holds is one line, not a box to tick', () => {
  const r = run(project([]), '--task', 'says the invoice is missing from the mail');
  assert.match(r.stdout, /^Held by a mechanism, so do the check when it blocks: .*absence \(turn-check:absence\)/m);
  assert.doesNotMatch(r.stdout, /\[ \] Something that seems missing/);
});

test('--full prints the test under each rule and where its case is', () => {
  const dir = project([], { cases: '### inventory\n\nA case.\n' });
  const r = run(dir, '--task', 'delete old backup files to free disk space', '--full');
  assert.match(r.stdout, /test: a listing of what exists/);
  assert.match(r.stdout, /case: docs\/failure-cases\.md#inventory/);
});

test('register entries: one per lesson, the unguarded first, then the newest, ten at most', () => {
  const list = [
    entry('n-1', { date: '2026-09-01', generic: 'same lesson.' }),
    entry('n-2', { date: '2026-09-05', generic: 'same lesson.' }),
    entry('n-3', { date: '2026-09-02', generic: 'unguarded lesson.', guard: { kind: 'none' } }),
    entry('n-4', { date: '2026-09-09', generic: 'newest guarded lesson.' }),
    ...Array.from({ length: 12 }, (_, k) => entry(`m-${k}`, { date: '2026-08-01' })),
  ];
  const out = run(project(list), 'numbers').stdout;
  const order = ['unguarded lesson', 'newest guarded lesson', 'same lesson'].map((s) => out.indexOf(s));
  assert.ok(order.every((i) => i > 0), 'all three printed');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'unguarded, then newest');
  assert.equal(out.split('same lesson').length - 1, 1, 'one line per lesson');
  assert.match(out, /numbers ×2 ·/);
  assert.match(out, /NOTHING GUARDS THIS/);
  assert.match(out, /^ {3}5 more: --all$/m, '15 lessons, 10 shown');
  assert.doesNotMatch(run(project(list), 'numbers', '--all').stdout, /more: --all/);
});

test('the most-broken ranking is computed from repeat_of, with the rule it points at', () => {
  const list = [
    entry('r-1', { date: '2026-09-01', generic: 'twice repeated.', guard: { kind: 'rule', where: 'docs/failure-modes.md#absence' } }),
    entry('r-2', { date: '2026-09-02', repeat_of: 'r-1' }),
    entry('r-3', { date: '2026-09-03', repeat_of: 'r-2' }),
    entry('s-1', { date: '2026-09-01', generic: 'once repeated.' }),
    entry('s-2', { date: '2026-09-04', repeat_of: 's-1' }),
  ];
  const out = run(project(list), '--broken').stdout;
  assert.match(out, / 2× twice repeated\.\s+#absence/);
  assert.ok(out.indexOf('twice repeated') < out.indexOf('once repeated'), 'more repeats first');
  assert.match(run(project(list), '--task', 'a missing file').stdout, /Most broken here/);
  assert.match(run(project([entry('x-1')]), '--task', 'a missing file').stdout, /no repeat logged yet/);
});

test('a task that shares no word with any rule says so, and still shows the register', () => {
  const r = run(project([entry('z-1')]), '--task', 'zzz qqq');
  assert.match(r.stdout, /No rule in docs\/failure-modes\.md shares a word with this task/);
  assert.match(r.stdout, /lesson z-1/);
});

test('a guide written before the ids still prints its rules', () => {
  const guide = '# x\n\n## 3 · Producing and reading figures\n\n- **A total is recomputed.** Long text.\n- **A sum has no plug.**\n';
  const r = run(project([], { guide }), 'numbers');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.rules, 2);
});
