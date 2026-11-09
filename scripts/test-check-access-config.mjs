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

test("an intranet that runs the to-do app's Worker: gated, pages through ASSETS, assets after the check", () => {
  const ok = {
    main: '../todos/worker.js', workers_dev: false,
    assets: { directory: './dist', binding: 'ASSETS', run_worker_first: true },
    vars: { TEAM_DOMAIN: 'https://riverside.cloudflareaccess.com', POLICY_AUD: 'aud', TODO_SOURCES: [] },
  };
  assert.deepEqual(inspect(ok), []);
  assert.match(inspect({ ...ok, vars: { TODO_SOURCES: [] } })[0].detail, /without TEAM_DOMAIN and POLICY_AUD/);
  assert.match(inspect({ ...ok, assets: { ...ok.assets, binding: 'STATIC' } })[0].detail, /not bound as "ASSETS"/);
  assert.match(inspect({ ...ok, assets: { directory: './dist', binding: 'ASSETS' } })[0].detail, /run_worker_first/);
});
