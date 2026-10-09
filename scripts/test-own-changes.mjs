// The end-of-session check in a clone several sessions share: it must hold a session to its
// own unsaved work and stop asking it about a neighbour's (.claude/hooks/own-changes.mjs).
// Every doubt must land on the side of asking: no transcript, a background command, a
// subagent still running.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, realpathSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { windows, attribute } from '../.claude/hooks/own-changes.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = ['-c', 'user.name=Sam', '-c', 'user.email=sam@example.com'];
const git = (cwd, ...a) => execFileSync('git', [...ID, ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const iso = (ms) => new Date(ms).toISOString();

/** A transcript with one tool call per [start, end] pair (end null: never returned). */
function transcript(calls) {
  const lines = [];
  calls.forEach(([start, end, name = 'Bash', input = { command: 'true' }], i) => {
    lines.push({ type: 'assistant', timestamp: iso(start), message: { content: [{ type: 'tool_use', id: `t${i}`, name, input }] } });
    if (end !== null) lines.push({ type: 'user', timestamp: iso(end), message: { content: [{ type: 'tool_result', tool_use_id: `t${i}`, content: 'ok' }] } });
  });
  return lines.map((l) => JSON.stringify(l)).join('\n');
}

// ------------------------------------------------------------------ the rule itself

test('a file changed during one of this session\'s calls is its own; one changed between them is not', () => {
  const t0 = Date.parse('2026-10-01T10:00:00Z');
  const spans = windows(transcript([[t0, t0 + 5000], [t0 + 60000, t0 + 61000]]), t0 + 3600000);
  const { mine, others } = attribute([
    { repo: 'notes', path: 'a.md', mtime: t0 + 3000 },
    { repo: 'notes', path: 'b.md', mtime: t0 + 30000 },
    { repo: 'sales', commit: 'abc1234', time: t0 + 60500 },
  ], spans);
  assert.deepEqual(mine.map((l) => l.path || l.commit), ['a.md', 'abc1234']);
  assert.deepEqual(others.map((l) => l.path), ['b.md']);
});

test('a read cannot have written anything, however long it took', () => {
  const t0 = Date.parse('2026-10-01T10:00:00Z');
  const spans = windows(transcript([[t0, t0 + 20000, 'Read', { file_path: '/x/notes/a.md' }]]), t0 + 60000);
  assert.equal(attribute([{ repo: 'notes', path: 'a.md', mtime: t0 + 5000 }], spans).mine.length, 0);
});

test('a background command or a subagent covers everything after it started', () => {
  const t0 = Date.parse('2026-10-01T10:00:00Z');
  const now = t0 + 3600000;
  for (const call of [[t0, t0 + 100, 'Bash', { command: 'npm run import', run_in_background: true }], [t0, t0 + 100, 'Agent', { prompt: 'x' }], [t0, null]]) {
    const { mine } = attribute([{ repo: 'notes', path: 'late.md', mtime: t0 + 1800000 }], windows(transcript([call]), now));
    assert.equal(mine.length, 1, `${call[2] || 'unfinished call'} must cover a later change`);
  }
});

test('a deleted file is this session\'s only if one of its calls named it', () => {
  const t0 = Date.parse('2026-10-01T10:00:00Z');
  const spans = windows(transcript([[t0, t0 + 100, 'Bash', { command: 'git rm drafts/old-brochure.md' }]]), t0 + 1000);
  const { mine, others } = attribute([
    { repo: 'notes', path: 'drafts/old-brochure.md', mtime: null },
    { repo: 'notes', path: 'drafts/someone-elses.md', mtime: null },
  ], spans);
  assert.deepEqual(mine.map((l) => l.path), ['drafts/old-brochure.md']);
  assert.deepEqual(others.map((l) => l.path), ['drafts/someone-elses.md']);
});

// ------------------------------------------------------------------ through session-end.sh

function workspace() {
  const ws = realpathSync(mkdtempSync(join(tmpdir(), 'own-')));
  mkdirSync(join(ws, 'acme-ops/.claude'), { recursive: true });
  cpSync(join(KIT, '.claude/hooks'), join(ws, 'acme-ops/.claude/hooks'), { recursive: true });
  for (const name of ['notes', 'sales']) {
    const dir = join(ws, name);
    mkdirSync(dir);
    git(dir, 'init', '-q');
    writeFileSync(join(dir, 'README.md'), `# ${name}\n`);
    git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'first');
  }
  return ws;
}
const stop = (ws, input) => execFileSync('bash', [join(ws, 'acme-ops/.claude/hooks/session-end.sh')], {
  input: JSON.stringify(input), env: { ...process.env, CLAUDE_PROJECT_DIR: ws }, encoding: 'utf8',
});
const touch = (path, ms) => { writeFileSync(path, 'draft\n'); utimesSync(path, ms / 1000, ms / 1000); };

test('session-end names only the repos holding this session\'s work, and stays quiet over a neighbour\'s', () => {
  const ws = workspace();
  const now = Date.now();
  const path = join(ws, 't.jsonl');
  writeFileSync(path, transcript([[now - 20000, now - 15000]]));
  touch(join(ws, 'sales/lead.md'), now - 17000);          // during this session's call
  touch(join(ws, 'notes/their-draft.md'), now - 600000);  // ten minutes earlier: a neighbour
  const out = JSON.parse(stop(ws, { transcript_path: path }));
  assert.match(out.reason, /changes in: sales \(yours; 1 change\(s\) by other sessions left alone\)/);
  assert.doesNotMatch(out.reason, /in: notes/);

  unlinkSync(join(ws, 'sales/lead.md'));
  assert.equal(stop(ws, { transcript_path: path }), '', 'only a neighbour\'s work left: nothing to say');
});

test('without a readable transcript, session-end asks about everything, as before', () => {
  const ws = workspace();
  touch(join(ws, 'notes/their-draft.md'), Date.now() - 600000);
  const out = JSON.parse(stop(ws, { transcript_path: join(ws, 'missing.jsonl') }));
  assert.match(out.reason, /changes in: notes\./);
});
