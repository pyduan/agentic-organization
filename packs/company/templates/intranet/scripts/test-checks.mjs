// The Access config check and the leak check, on throwaway files. Every name here is invented.
//
// What it holds in place: a Worker that reads an identity, under the names it uses,
// refuses assets served before its code runs; a Worker that checks nothing is left alone; and a
// leak term is matched whole-word, case-insensitively, and only where its scope says.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect, parseJsonc } from './check-access-config.mjs';
import { parseTerms, scan } from './check-leaks.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

test('JSONC with comments, trailing commas and a URL in a string parses', () => {
  const cfg = parseJsonc('{\n  // the app\n  "name": "acme-page", /* gated */\n  "vars": { "TEAM_DOMAIN": "https://acme.example/x", },\n}');
  assert.equal(cfg.vars.TEAM_DOMAIN, 'https://acme.example/x');
});

test('a Worker that checks nothing is left alone', () => {
  assert.deepEqual(inspect({ name: 'acme-site', assets: { directory: 'dist' } }), []);
});

test('assets served before the identity check is an error, whether the vars or the code name it', () => {
  assert.deepEqual(inspect({ vars: { POLICY_AUD: '' }, assets: { directory: 'public' } }).map((x) => x.severity), ['error']);
  assert.deepEqual(inspect({ assets: { directory: 'dist' } }, 'const aud = env.POLICY_AUD;').map((x) => x.severity), ['error']);
  assert.deepEqual(inspect({ vars: { TEAM_DOMAIN: '' }, assets: { run_worker_first: true } }), []);
});

test("the pack's own two Worker configs pass", () => {
  for (const rel of ['../wrangler.jsonc', '../outside/_template/wrangler.jsonc']) {
    const file = join(HERE, rel);
    const cfg = parseJsonc(readFileSync(file, 'utf8'));
    const code = readFileSync(join(dirname(file), cfg.main), 'utf8');
    assert.deepEqual(inspect(cfg, code), [], rel);
    assert.ok(/POLICY_AUD/.test(code), `${rel} reads an identity, so the check is not vacuous`);
  }
});

const top = mkdtempSync(join(tmpdir(), 'leaks-'));
after(() => rmSync(top, { recursive: true, force: true }));
const file = (rel, text) => { const p = join(top, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };

test('a leak term is matched whole-word and case-insensitively; comments are ignored', () => {
  const f = file('customers/decks/a/deck.mdx', 'We met Northwind on Tuesday.\nNorthwinds are not a customer.\n');
  assert.deepEqual(scan([f], parseTerms('# who must not be named\n\nnorthwind # the bakery\n'), top).map((h) => h.line), [1]);
});

test('a scoped term is refused only where its glob matches, and scope: * goes back to every path', () => {
  const home = file('strategy/decks/pitch/deck.mdx', 'Our work with Contoso.\n');
  const sent = file('customers/decks/offer/deck.mdx', 'Our work with Contoso.\n');
  const rules = parseTerms('scope: customers/**\nContoso\nscope: *\nFabrikam\n');
  assert.deepEqual(scan([home, sent], rules, top).map((h) => h.file), ['customers/decks/offer/deck.mdx']);
  assert.equal(rules[1].scope, null);
});
