import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrate, pending, summary, reconcile, KIT_MIGRATIONS } from '../lib/local-migrations.mjs';

const POLICY = { internalDomains: ['example.org'] };
const machine = (files = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'local-migr-'));
  mkdirSync(join(root, '.claude'));
  for (const [f, c] of Object.entries(files)) writeFileSync(join(root, '.claude', f), typeof c === 'string' ? c : JSON.stringify(c));
  return root;
};
const read = (root, f) => JSON.parse(readFileSync(join(root, '.claude', f), 'utf8'));
const ID = KIT_MIGRATIONS[0].id;

test('an internal address gets its self entry once, and only an internal one', () => {
  const a = machine();
  const r = migrate(a, { email: 'Sam@Example.org', policy: POLICY });
  assert.deepEqual(read(a, 'send-guard.local.json'), { self: ['sam@example.org'], migrations: [ID] });
  assert.match(summary(r), /updated/);
  assert.equal(migrate(a, { email: 'sam@example.org', policy: POLICY }).done.length, 0, 'it does not run twice');
  const b = machine();
  assert.equal(migrate(b, { email: 'sam@elsewhere.net', policy: POLICY }).done.length, 0);
  rmSync(a, { recursive: true }); rmSync(b, { recursive: true });
});

test("a value the person set is never replaced", () => {
  const root = machine({ 'send-guard.local.json': { self: ['me@other.net'], allow: 1 } });
  migrate(root, { email: 'sam@example.org', policy: POLICY });
  assert.deepEqual(read(root, 'send-guard.local.json'), { self: ['me@other.net'], allow: 1, migrations: [ID] });
  rmSync(root, { recursive: true });
});

test('an unreadable file is reported and left as it is', () => {
  const root = machine({ 'send-guard.local.json': '{oops' });
  const r = migrate(root, { email: 'sam@example.org', policy: POLICY });
  assert.equal(readFileSync(join(root, '.claude', 'send-guard.local.json'), 'utf8'), '{oops');
  assert.match(summary(r), /not readable/);
  rmSync(root, { recursive: true });
});

test('the policy reconcile adds what is missing and keeps what is there', () => {
  const p = { policy: { routines: ['morning-import', 'self-briefing'], backfill: true } };
  assert.deepEqual(reconcile({ routines: { 'morning-import': 'installed' } }, p),
    { routines: { 'morning-import': 'installed', 'self-briefing': 'to-install' }, backfill: { state: 'to-do' } });
  assert.equal(reconcile({ routines: { 'morning-import': 'declined', 'self-briefing': 'installed' }, backfill: { state: 'done' } }, p), null);
  assert.equal(reconcile({}, {}), null, 'no policy, nothing written');
});

test('under a written policy the session installs without asking; without one it offers', () => {
  const root = machine();
  const policy = { policy: { decidedBy: '@sam', date: '2026-01-15', routines: ['morning-import'], backfill: true } };
  migrate(root, { email: '', policy });
  const lines = pending(root, { env: {}, policy });
  assert.match(lines.join('\n'), /without asking \(policy decided by @sam on 2026-01-15\)/);
  assert.match(lines.join('\n'), /backfill/);
  const unruled = pending(root, { env: {}, policy: { policy: { routines: ['morning-import'] } } });
  assert.match(unruled[0], /Offer them in one sentence/);
  rmSync(root, { recursive: true });
});

test('a session nobody attends is told nothing to install or start', () => {
  const root = machine({ 'machine.local.json': { routines: { x: 'to-install' }, backfill: { state: 'to-do' } } });
  assert.deepEqual(pending(root, { env: { CLAUDE_CODE_SESSION_ATTENDED: '0' }, policy: {} }), []);
  assert.equal(pending(root, { env: {}, policy: {} }).length, 2);
  rmSync(root, { recursive: true });
});
