// The retired-route check (scripts/check-retired.mjs), on throwaway files. Every example is invented.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { claimsOf, scan } from './check-retired.mjs';

const top = mkdtempSync(join(tmpdir(), 'retired-'));
after(() => rmSync(top, { recursive: true, force: true }));
const file = (rel, text) => { const p = join(top, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };

const claims = claimsOf(JSON.stringify({ claims: [{
  id: 'drafts-in-drive', pattern: 'drafts? (?:live|go) in the shared drive', unless: 'until 2026-|used to',
  say: 'drafts are files in the repo', allow: ['docs/quoting.md'],
}] }));

test('an instruction to the old route is a hit, its history is not', () => {
  const guide = file('docs/guide.md', 'Drafts go in the shared drive.\nDrafts used to go in the shared drive.\nUntil 2026-11-02, drafts lived in the shared drive.\n');
  assert.deepEqual(scan(claims, [guide], top).map((h) => h.line), [1]);
});

test('the dated logs and an allowed file are not read', () => {
  const log = file('source/decisions.md', 'Drafts go in the shared drive, we said then.\n');
  const quote = file('docs/quoting.md', 'The old rule read: "drafts go in the shared drive".\n');
  assert.deepEqual(scan(claims, [log, quote], top), []);
});

test('a claim without what to say instead, or with a broken pattern, is refused', () => {
  assert.throws(() => claimsOf(JSON.stringify({ claims: [{ id: 'x', pattern: 'y' }] })), /without "say"/);
  assert.throws(() => claimsOf(JSON.stringify({ claims: [{ id: 'x', pattern: '(', say: 'z' }] })));
});
