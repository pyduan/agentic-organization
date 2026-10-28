// The leak check (scripts/check-leaks.mjs), on throwaway files. Every name here is invented.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTerms, scan } from './check-leaks.mjs';

const top = mkdtempSync(join(tmpdir(), 'leaks-'));
after(() => rmSync(top, { recursive: true, force: true }));
const file = (rel, text) => { const p = join(top, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, text); return p; };

test('a term is matched whole-word and case-insensitively', () => {
  const f = file('site/a.md', 'We met Northwind on Tuesday.\nNorthwinds are not a client.\n');
  const hits = scan([f], parseTerms('northwind\n'), top);
  assert.deepEqual(hits.map((h) => h.line), [1]);
});

test('comments and blank lines are ignored', () => {
  assert.deepEqual(parseTerms('# who must not be named\n\nNorthwind # the bakery\n').map((r) => r.term), ['Northwind']);
});

test('a scoped term is refused only where its glob matches', () => {
  const home = file('decks/pitch/deck.mdx', 'Our work with Contoso.\n');
  const shared = file('shared/notes.md', 'Our work with Contoso.\n');
  const rules = parseTerms('scope: shared/**\nContoso\n');
  assert.deepEqual(scan([home, shared], rules, top).map((h) => h.file), ['shared/notes.md']);
});

test('scope: * goes back to every path', () => {
  const rules = parseTerms('scope: shared/**\nContoso\nscope: *\nFabrikam\n');
  assert.equal(rules[1].scope, null);
});
