// The Access config lint (scripts/check-access-config.mjs). Every name here is invented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect, parseJsonc } from './check-access-config.mjs';

test('JSONC with comments, trailing commas and a URL in a string parses', () => {
  const cfg = parseJsonc('{\n  // the app\n  "name": "acme-admin", /* gated */\n  "vars": { "TEAM_DOMAIN": "https://acme.example/x", },\n}');
  assert.equal(cfg.vars.TEAM_DOMAIN, 'https://acme.example/x');
});

test('a Worker that checks nothing is left alone', () => {
  assert.deepEqual(inspect({ name: 'acme-site', assets: { directory: 'dist' } }), []);
});

test('assets served before the identity check is an error', () => {
  const f = inspect({ vars: { POLICY_AUD: '' }, assets: { directory: 'dist' }, workers_dev: false });
  assert.deepEqual(f.map((x) => x.severity), ['error']);
});

test('workers.dev left on is a warning, the right config is clean', () => {
  assert.deepEqual(inspect({ vars: { TEAM_DOMAIN: '' } }).map((x) => x.severity), ['warning']);
  assert.deepEqual(inspect({ vars: { TEAM_DOMAIN: '' }, assets: { run_worker_first: true }, workers_dev: false }), []);
});
