// The pre-push gate (scripts/pre-push.mjs), installed by scripts/install-workspace.mjs, on throwaway
// repos with a real git push. Every name here is invented.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prePushSteps, apply } from './install-workspace.mjs';
import { MARK, onlyDeletes } from './pre-push.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const top = realpathSync(mkdtempSync(join(tmpdir(), 'prepush-')));
after(() => rmSync(top, { recursive: true, force: true }));
const ID = ['-c', 'user.name=Sam', '-c', 'user.email=sam@example.com', '-c', 'init.defaultBranch=main'];
const git = (cwd, ...a) => execFileSync('git', [...ID, ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const pkg = (dir, check) => writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', private: true, scripts: check ? { check } : {} }));

function repo(ws, name, check) {
  const dir = join(ws, name);
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  if (check !== undefined) pkg(dir, check);
  writeFileSync(join(dir, 'README.md'), `# ${name}\n`);
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'first');
  return dir;
}

const ws = join(top, 'ws');
const router = repo(ws, 'acme-ops', 'node -e "process.exit(0)"');
for (const f of ['scripts/pre-push.mjs']) { mkdirSync(join(router, dirname(f)), { recursive: true }); cpSync(join(KIT, f), join(router, f)); }
const sales = repo(ws, 'sales', 'node -e "process.exit(0)"');
repo(ws, 'notes');                                   // no check: no gate
const crm = repo(ws, 'crm', 'node -e "0"');
writeFileSync(join(crm, '.git/hooks/pre-push'), '#!/bin/sh\necho mine\n');
const husky = repo(ws, 'shop', 'node -e "0"');
git(husky, 'config', 'core.hooksPath', '.husky');

test('the gate goes into every repo that has a check, never over a hook someone wrote', () => {
  const byRepo = () => Object.fromEntries(prePushSteps(router).map((s) => [s.repo, s.state]));
  assert.deepEqual(byRepo(), { 'acme-ops': 'missing', crm: 'different', sales: 'missing', shop: 'different' });
  apply(prePushSteps(router));
  const hook = readFileSync(join(sales, '.git/hooks/pre-push'), 'utf8');
  assert.ok(hook.includes(MARK) && hook.includes('../acme-ops/scripts/pre-push.mjs'));
  assert.ok(statSync(join(sales, '.git/hooks/pre-push')).mode & 0o100, 'executable');
  assert.equal(readFileSync(join(crm, '.git/hooks/pre-push'), 'utf8'), '#!/bin/sh\necho mine\n');
  assert.ok(!existsSync(join(ws, 'notes/.git/hooks/pre-push')));
  assert.deepEqual(byRepo(), { 'acme-ops': 'current', crm: 'different', sales: 'current', shop: 'different' });
  writeFileSync(join(sales, '.git/hooks/pre-push'), `#!/bin/sh\n${MARK} an older version\n`);
  assert.equal(byRepo().sales, 'stale', 'an older gate of ours is refreshed');
  apply(prePushSteps(router));
});

test('a push whose check fails is refused with the instruction; once fixed it goes through', () => {
  const origin = join(top, 'sales.git');
  git(top, 'init', '-q', '--bare', origin);
  git(sales, 'remote', 'add', 'origin', origin);
  pkg(sales, 'node -e "console.log(\'✘ menu.md: price missing\'); process.exit(1)"');
  git(sales, 'add', '-A'); git(sales, 'commit', '-q', '-m', 'menu');
  const push = () => spawnSync('git', [...ID, 'push', '-q', 'origin', 'main'], { cwd: sales, encoding: 'utf8' });
  const refused = push();
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /price missing/);
  assert.match(refused.stderr, /Never git push --no-verify/);
  assert.equal(spawnSync('git', ['-C', origin, 'rev-parse', '--verify', '-q', 'main']).status, 1, 'nothing reached origin');

  pkg(sales, 'node -e "process.exit(0)"');
  git(sales, 'add', '-A'); git(sales, 'commit', '-q', '-m', 'fixed');
  assert.equal(push().status, 0);
  assert.equal(git(origin, 'rev-parse', 'main').trim(), git(sales, 'rev-parse', 'HEAD').trim());
});

test('a push that only deletes a branch runs no check', () => {
  assert.ok(onlyDeletes(`(delete) ${'0'.repeat(40)} refs/heads/old ${'a'.repeat(40)}\n`));
  assert.ok(!onlyDeletes(`refs/heads/main ${'b'.repeat(40)} refs/heads/main ${'a'.repeat(40)}\n`));
  assert.ok(!onlyDeletes(''));
});
