// Files co-owned with another repo (scripts/vendor-sync.mjs), on throwaway repos. Every name here is invented.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { divergences, manifests, pull, pushBack, verify } from './vendor-sync.mjs';

const top = mkdtempSync(join(tmpdir(), 'vendor-'));
after(() => rmSync(top, { recursive: true, force: true }));
const ID = ['-c', 'user.name=Sam', '-c', 'user.email=sam@example.com', '-c', 'init.defaultBranch=main'];
const git = (cwd, ...a) => execFileSync('git', [...ID, ...a], { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const write = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const quiet = () => {};

const kit = join(top, 'shared-ui');
const host = join(top, 'acme-site');
mkdirSync(kit); git(kit, 'init', '-q');
write(kit, 'components/card.css', '.card{}\n');
write(kit, 'components/table.css', '.table{}\n');
write(kit, 'paged.js', '// v1\n');
git(kit, 'add', '-A'); git(kit, 'commit', '-q', '-m', 'first');
mkdirSync(host);
write(host, 'vendor/shared-ui.json', JSON.stringify({ repo: 'acme/shared-ui', mappings: [['components/', 'site/shared/'], ['paged.js', 'scripts/paged.js']] }));
const one = () => manifests(host)[0];

test('pull copies every mapped file, records the commit and a sha256 each, and verify agrees', () => {
  const r = pull(one(), host, quiet);
  assert.deepEqual(r, { copied: 3, files: 3 });
  assert.equal(readFileSync(join(host, 'scripts/paged.js'), 'utf8'), '// v1\n');
  assert.equal(one().commit, git(kit, 'rev-parse', 'HEAD'));
  assert.equal(verify(host, quiet), 0);
});

test('a file edited here is a divergence: verify fails, pull refuses, push-back sends it to the kit', () => {
  write(host, 'scripts/paged.js', '// v2, fixed here\n');
  assert.deepEqual(divergences(one(), host).map((d) => d.why), ['edited here']);
  assert.equal(verify(host, quiet), 1);
  assert.throws(() => pull(one(), host, quiet), /edited here and never pushed back/);
  assert.equal(pushBack(one(), host, quiet), 1);
  assert.equal(readFileSync(join(kit, 'paged.js'), 'utf8'), '// v2, fixed here\n');
});

test('pull refuses while the kit has uncommitted changes, then takes the commit and drops what the kit removed', () => {
  assert.throws(() => pull(one(), host, quiet), /uncommitted changes/);
  git(kit, 'rm', '-q', 'components/table.css');
  git(kit, 'commit', '-q', '-am', 'the fix, and the table goes');
  pull(one(), host, quiet);
  assert.ok(!existsSync(join(host, 'site/shared/table.css')), 'a file the kit dropped leaves');
  assert.equal(Object.keys(one().files).length, 2);
  assert.equal(verify(host, quiet), 0);
});
