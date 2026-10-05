// kit-sync's set-aside list, tested on throwaway repos.
//
// The fault this pins: `status` printed every customised file under "the kit has
// changed them since" whenever it differed from the kit, which a customised file
// always does. On a day the kit had not moved, an owner was told updates were
// waiting. The heading now has to be earned by an actual change in the kit.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'kit-sync.mjs');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: 'pipe' });
const commit = (cwd, msg) => {
  git(cwd, 'add', '-A');
  git(cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', msg);
  return git(cwd, 'rev-parse', 'HEAD').trim();
};
const write = (dir, file, text) => { mkdirSync(dirname(join(dir, file)), { recursive: true }); writeFileSync(join(dir, file), text); };

/** A template with one framework file, and a project synced at its first commit. */
function setup({ legacy }) {
  const ws = mkdtempSync(join(tmpdir(), 'kitsync-'));
  const tpl = join(ws, 'template');
  mkdirSync(tpl);
  git(tpl, 'init', '-q');
  write(tpl, 'docs/guide.md', 'kit v1\n');
  const v1 = commit(tpl, 'v1');

  const proj = join(ws, 'proj');
  mkdirSync(proj);
  git(proj, 'init', '-q');
  write(proj, 'docs/guide.md', 'kit v1\nmy own line\n');          // customised
  copyFileSync(SCRIPT, join(mkdirSync(join(proj, 'scripts'), { recursive: true }) || join(proj, 'scripts'), 'kit-sync.mjs'));
  write(proj, '.kit-sync', JSON.stringify({ sha: v1, setAside: legacy ? ['docs/guide.md'] : [{ file: 'docs/guide.md', at: v1 }] }));
  commit(proj, 'init');
  git(proj, 'remote', 'add', 'template', tpl);
  git(proj, 'fetch', '-q', 'template');
  return { tpl, proj, v1 };
}

const status = (proj) => execFileSync('node', ['scripts/kit-sync.mjs', 'status'], { cwd: proj, encoding: 'utf8' });

test('a customised file is not reported as changed by the kit when the kit has not moved', () => {
  for (const legacy of [true, false]) {
    const { proj } = setup({ legacy });
    const out = status(proj);
    assert.doesNotMatch(out, /kit has changed/, `legacy=${legacy}`);
    assert.match(out, /0 need a human/, `legacy=${legacy}`);
  }
});

test('the kit changing a customised file is reported, and stays reported until reconciled', () => {
  const { tpl, proj } = setup({ legacy: false });
  write(tpl, 'docs/guide.md', 'kit v2\n');
  commit(tpl, 'v2');
  git(proj, 'fetch', '-q', 'template');
  assert.match(status(proj), /kit has changed them since you last reconciled \(1\)/);
  // Applying other files must not bury it: the baseline moves, the file stays flagged.
  execFileSync('node', ['scripts/kit-sync.mjs', 'apply'], { cwd: proj, encoding: 'utf8' });
  assert.match(status(proj), /kit has changed them since you last reconciled \(1\)/);
  execFileSync('node', ['scripts/kit-sync.mjs', 'reconciled', 'docs/guide.md'], { cwd: proj, encoding: 'utf8' });
  const after = status(proj);
  assert.doesNotMatch(after, /kit has changed/);
  assert.match(after, /kept as yours; the kit has not touched them/);
});

test('a collision found by apply keeps the kit change visible after the baseline moves', () => {
  const { tpl, proj, v1 } = setup({ legacy: false });
  write(proj, '.kit-sync', JSON.stringify({ sha: v1, setAside: [] }));  // not set aside yet
  commit(proj, 'clear');
  write(tpl, 'docs/guide.md', 'kit v2\n');
  commit(tpl, 'v2');
  git(proj, 'fetch', '-q', 'template');
  execFileSync('node', ['scripts/kit-sync.mjs', 'apply'], { cwd: proj, encoding: 'utf8' });
  const sync = JSON.parse(readFileSync(join(proj, '.kit-sync'), 'utf8'));
  assert.deepEqual(sync.setAside, [{ file: 'docs/guide.md', at: v1 }]);
  assert.match(status(proj), /kit has changed them since you last reconciled \(1\)/);
});
