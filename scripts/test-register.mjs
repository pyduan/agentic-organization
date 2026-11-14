// The register's readers, tested on throwaway registers.
//
// Two faults reached owners before any test existed. `error-report --email` crashed
// on a variable renamed everywhere but in the mail line, so the one form meant to be
// sent could not be produced. And the report built its family table and its register
// from the seven keys only, so an entry filed under any other word disappeared from
// both while the headline total still counted it. Each now fails a test here.
// Later: a register drifting outside the schema (a detector named "Sam", a severity
// "high") produced figures that flattered; the report now refuses it unless told
// --accept-drift, and the register-guard hook refuses the write that drifts.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegister, validate } from '../lib/register.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORT = resolve(HERE, 'error-report.mjs');
const PREFLIGHT = resolve(HERE, 'preflight.mjs');
const GUARD = resolve(HERE, '../.claude/hooks/register-guard.mjs');

const entry = (id, over = {}) => ({
  id, date: `2026-09-${String(10 + Number(id.slice(-1))).padStart(2, '0')}`,
  category: 'numbers', severity: 'major', detected_by: 'owner',
  guard: { kind: 'rule', where: 'docs/x.md' }, generic: `lesson ${id}`, ...over,
});

function project(incidents, { path = 'source/quality/incidents.json', raw } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'register-'));
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), raw ?? JSON.stringify({ version: 1, incidents }));
  // preflight needs the failure-modes guide beside the register.
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'docs/failure-modes.md'), readFileSync(resolve(HERE, '../docs/failure-modes.md')));
  return dir;
}

const MIXED = [
  entry('a-1'),
  entry('a-2', { category: 'domain-accuracy' }),             // a family nobody declared
  entry('a-3', { category: 'delivery', severity: 'high' }),  // and a severity nobody declared
  entry('a-4', { category: 'destructive', severity: 'minor', guard: { kind: 'check', where: 'scripts/x.mjs' } }),
];

test('--email produces the report and the mail line instead of crashing', () => {
  const dir = project(MIXED);
  const r = spawnSync('node', [REPORT, '--anonymized', '--email', '--out=out.md', '--accept-drift'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /mailto:/);
  assert.match(decodeURIComponent(r.stdout), /caught by a person/);
});

test('an entry outside the seven families is rendered, not dropped', () => {
  const dir = project(MIXED);
  const out = execFileSync('node', [REPORT, '--accept-drift'], { cwd: dir, encoding: 'utf8' });
  const rendered = (out.match(/^#### /gm) || []).length;
  assert.equal(rendered, MIXED.length, 'every entry appears in the register section');
  assert.match(out, /Outside the seven families/);
  assert.match(out, /domain-accuracy/);
  // The family table must add up to its own total row.
  const rows = [...out.matchAll(/^\| (?!Family|\*\*Total|---)[^|]+\| (\d+) \|/gm)].map((m) => Number(m[1]));
  assert.equal(rows.reduce((a, b) => a + b, 0), MIXED.length);
});

test('a severity outside the schema is named in the headline, not silently left out of it', () => {
  const dir = project(MIXED);
  const out = execFileSync('node', [REPORT, '--accept-drift'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /2 major or critical/);
  assert.match(out, /1 more carries a severity the schema does not define \(high\)/);
});

test('the anonymized form refuses to be written when a lesson names a listed term', () => {
  const dir = project([entry('a-1', { generic: 'Camille caught a total that did not move' })]);
  writeFileSync(join(dir, '.leak-terms'), '# people\ncamille\n');
  const r = spawnSync('node', [REPORT, '--anonymized', '--out=out.md'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /"camille"/);
  assert.throws(() => readFileSync(join(dir, 'out.md')), 'nothing written');
  // The full form stays the owner's and is not checked.
  assert.equal(spawnSync('node', [REPORT], { cwd: dir, encoding: 'utf8' }).status, 0);
});

test('the report finds a register kept under a translated path', () => {
  const dir = project(MIXED, { path: 'source/qualite/incidents.json' });
  const out = execFileSync('node', [REPORT, '--accept-drift'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /4 incidents/);
});

test('a register that cannot be read stops the report, it does not print an empty one', () => {
  const dir = project([], { raw: '[{"id":"x"}]' });
  const r = spawnSync('node', [REPORT], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /bare array/);
});

test('preflight shows an off-schema entry whatever the task', () => {
  const dir = project(MIXED);
  const out = execFileSync('node', [PREFLIGHT, 'parallel-sessions'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /filed outside the seven families/);
  assert.match(out, /lesson a-2/);
  assert.match(out, /lesson a-3/);
  assert.doesNotMatch(out, /lesson a-1/, 'an in-schema entry of another family stays filtered');
});

test('loadRegister never conflates its outcomes', async () => {
  assert.equal((await loadRegister(project(MIXED))).state, 'ok');
  assert.equal((await loadRegister(project([]))).state, 'empty');
  assert.equal((await loadRegister(project([], { raw: '[]' }))).state, 'bare-array');
  assert.equal((await loadRegister(project([], { raw: '{"version":1}' }))).state, 'no-incidents');
  assert.equal((await loadRegister(project([], { raw: '{nope' }))).state, 'unreadable');
  assert.equal((await loadRegister(mkdtempSync(join(tmpdir(), 'empty-')))).state, 'missing');
});

test('validate names the entry, the field and the value', () => {
  const problems = validate([
    ...MIXED,
    entry('a-1'),                                                // duplicate id
    entry('a-6', { detected_by: 'outside user', guard: { kind: 'ruleish' } }),
    entry('a-7', { guard: { kind: 'check' } }),                  // a guard that names no place
  ]);
  const has = (id, field) => problems.some((p) => p.id === id && p.field === field);
  assert.ok(has('a-2', 'category'));
  assert.ok(has('a-3', 'severity'));
  assert.ok(has('a-1', 'id'));
  assert.ok(has('a-6', 'detected_by'));
  assert.ok(has('a-6', 'guard.kind'));
  assert.ok(has('a-7', 'guard.where'));
  assert.ok(!has('a-4', 'category'));
});

test('a register outside the schema stops the report, unless the drift is accepted', () => {
  const dir = project(MIXED);
  const r = spawnSync('node', [REPORT, '--out=out.md'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /a-2 {2}category = "domain-accuracy"/);
  assert.match(r.stderr, /--accept-drift/);
  assert.throws(() => readFileSync(join(dir, 'out.md')), 'nothing written');
  assert.equal(spawnSync('node', [REPORT], { cwd: project([entry('a-1')]), encoding: 'utf8' }).status, 0);
});

test('a detector outside the schema is flagged and counted as neither a person nor the framework', () => {
  const dir = project([entry('a-1'), entry('a-2', { detected_by: 'Sam' }), entry('a-3', { detected_by: 'self' })]);
  const out = execFileSync('node', [REPORT, '--accept-drift'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /1 of 3 \(33%\) were caught by a person/);
  assert.match(out, /⚠ 1 other entry names a detector the schema does not define \(Sam\)/);
});

test('the total row and the mail body carry the caveat the headline carries', () => {
  const dir = project([...MIXED, entry('a-5', { detected_by: 'user' })]);
  const out = execFileSync('node', [REPORT, '--accept-drift'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /\| \*\*Total\*\* \| \*\*5\*\* \| \*\*3\*\* ⚠ \|/);
  assert.match(out, /^⚠ 1 entry with a severity the schema does not define \(high\) is counted in the incidents but not/m);
  const r = spawnSync('node', [REPORT, '--anonymized', '--email', '--out=out.md', '--accept-drift'], { cwd: dir, encoding: 'utf8' });
  const body = decodeURIComponent(r.stdout);
  assert.match(body, /3 major or critical \(1 more with a severity outside the schema, counted in neither\)/);
  assert.match(body, /\(1 others? with a detector outside the schema, counted as neither\)/);
});

test('preflight names a drifted severity even when families drift too', () => {
  const dir = project(MIXED);
  const out = execFileSync('node', [PREFLIGHT, 'numbers'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /filed outside the seven families/);
  assert.match(out, /1 problem\(s\) in the register's entries \(severity\)/);
});

test('register-guard blocks a write that leaves the register outside the schema, and nothing else', () => {
  const run = (dir, file, tool = 'Edit') => spawnSync('node', [GUARD, dir], {
    input: JSON.stringify({ tool_name: tool, tool_input: { file_path: join(dir, file) } }), encoding: 'utf8',
    env: { ...process.env, KIT_REGISTER: '' },
  });
  const bad = project([entry('a-1'), entry('a-2', { severity: 'high', detected_by: 'Sam' })]);
  const r = run(bad, 'source/quality/incidents.json');
  assert.equal(r.status, 0);
  const j = JSON.parse(r.stdout);
  assert.equal(j.decision, 'block');
  assert.match(j.reason, /a-2 {2}severity = "high"/);
  assert.match(j.reason, /a-2 {2}detected_by = "Sam"/);
  assert.equal(run(bad, 'docs/notes.md').stdout, '', 'another file passes');
  assert.equal(run(bad, 'source/quality/incidents.json', 'Read').stdout, '', 'a read passes');
  assert.equal(run(project([entry('a-1')]), 'source/quality/incidents.json', 'Write').stdout, '', 'a clean register passes');
  assert.match(JSON.parse(run(project([], { raw: '{"incidents": [' }), 'source/quality/incidents.json').stdout).reason, /no longer parses/);
  const translated = project([entry('a-1', { category: 'delivery' })], { path: 'qualite/incidents.json' });
  assert.match(JSON.parse(run(translated, 'qualite/incidents.json', 'MultiEdit').stdout).reason, /a-1 {2}category/);
});
