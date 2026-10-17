// The setup status, tested on a throwaway main repo.
//
// It aggregates checks that have their own tests, so what is pinned here is its own
// job: each reading lands on the right colour with its fix beside it, a check that
// cannot run is reported rather than dropped, and the verdict is counted from the
// checks instead of written in advance.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupStatus, report } from './setup-status.mjs';

const ID = ['-c', 'user.name=Sam', '-c', 'user.email=sam@example.com', '-c', 'init.defaultBranch=main'];
const git = (cwd, ...a) => execFileSync('git', [...ID, ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** remotes/acme/org.git, its clone ws/org, and a template remote with a CHANGELOG. */
function scratch() {
  const top = realpathSync(mkdtempSync(join(tmpdir(), 'setup-')));
  process.env.KIT_WORKSPACE_MAP = join(top, 'machine.json');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GIT_CONFIG_GLOBAL = join(top, 'gitconfig'); // no identity unless a test sets one
  writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  const bare = (name) => { const p = join(top, 'remotes', 'acme', `${name}.git`); mkdirSync(p, { recursive: true }); git(top, 'init', '-q', '--bare', p); return p; };
  const commitTo = (remote, files, msg) => {
    const seed = join(top, `seed-${Math.random().toString(36).slice(2)}`);
    git(top, 'clone', '-q', remote, seed);
    for (const [f, t] of Object.entries(files)) writeFileSync(join(seed, f), t);
    git(seed, 'add', '-A'); git(seed, 'commit', '-q', '-m', msg); git(seed, 'push', '-q', 'origin', 'HEAD:main');
    return git(seed, 'rev-parse', 'HEAD');
  };
  const kitRemote = bare('kit');
  const orgRemote = bare('org');
  commitTo(orgRemote, { 'README.md': '# org\n' }, 'first');
  const org = join(top, 'ws', 'org');
  mkdirSync(join(top, 'ws'));
  git(top, 'clone', '-q', orgRemote, org);
  return { top, org, orgRemote, kitRemote, commitTo };
}
const only = (area, ids, opts = {}) => setupStatus(area.org, { only: ids, ...opts });
const byId = (r, id) => r.checks.find((c) => c.id === id);

test('git identity: an address made up from the computer\'s name is red, a real one is green', async () => {
  const area = scratch();
  try {
    let r = await only(area, ['identity']);
    assert.equal(byId(r, 'identity').level, 'fail');
    assert.match(byId(r, 'identity').fix, /user\.email/);
    assert.equal(r.ok, false);

    git(area.org, 'config', 'user.email', 'sam@sams-laptop.local');
    assert.equal(byId(await only(area, ['identity']), 'identity').level, 'fail');

    git(area.org, 'config', 'user.email', 'sam@example.com');
    r = await only(area, ['identity']);
    assert.equal(byId(r, 'identity').level, 'ok');
    assert.equal(r.ok, true);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('clones: one behind is orange with the sync as its fix', async () => {
  const area = scratch();
  try {
    assert.equal(byId(await only(area, ['repos']), 'repos').level, 'ok');
    area.commitTo(area.orgRemote, { 'news.md': 'new\n' }, 'news');
    const c = byId(await only(area, ['repos']), 'repos');
    assert.equal(c.level, 'warn');
    assert.match(c.detail, /org: 1 new commit on main/);
    assert.equal(c.fix, 'node scripts/workspace-sync.mjs sync');
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('kit version: not wired, current, then behind by one announced update', async () => {
  const area = scratch();
  try {
    assert.match(byId(await only(area, ['kit']), 'kit').detail, /not wired to the template/);

    const first = area.commitTo(area.kitRemote, { 'CHANGELOG.md': '# Changelog\n\n## 2026-01-01 · MINOR · One\n' }, 'one');
    git(area.org, 'remote', 'add', 'template', area.kitRemote);
    assert.match(byId(await only(area, ['kit']), 'kit').detail, /never taken a kit update/);

    git(area.org, 'fetch', '-q', 'template');
    writeFileSync(join(area.org, '.kit-sync'), `${JSON.stringify({ sha: first })}\n`);
    assert.equal(byId(await only(area, ['kit']), 'kit').level, 'ok');

    area.commitTo(area.kitRemote, { 'CHANGELOG.md': '# Changelog\n\n## 2026-02-01 · MINOR · Two\n\n## 2026-01-01 · MINOR · One\n' }, 'two');
    const c = byId(await only(area, ['kit']), 'kit');
    assert.equal(c.level, 'warn');
    assert.match(c.detail, /^1 kit update\(s\) not taken yet$/);
    assert.match(c.fix, /update the kit/);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('hooks: no receipt is orange, a receipt from today is green', async () => {
  const area = scratch();
  try {
    assert.equal(byId(await only(area, ['hooks']), 'hooks').level, 'warn');
    writeFileSync(join(area.org, '.git', 'kit-news-ran'), JSON.stringify({ at: Date.now(), day: '2026-10-16' }));
    assert.equal(byId(await only(area, ['hooks']), 'hooks').level, 'ok');
    writeFileSync(join(area.org, '.git', 'kit-news-ran'), JSON.stringify({ at: Date.now() - 30 * 864e5, day: '2026-09-16' }));
    const stale = byId(await only(area, ['hooks']), 'hooks');
    assert.match(stale.detail, /last ran on 2026-09-16, so any session opened here since did not load/);
    assert.match(stale.fix, /install-workspace\.mjs/);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('workspace folder: missing guards are orange on an organization\'s repo, not applicable on the template', async () => {
  const area = scratch();
  try {
    mkdirSync(join(area.org, 'docs', 'workspace'), { recursive: true });
    writeFileSync(join(area.org, 'docs', 'workspace', 'CLAUDE.md'), '@{{ROUTER}}/CLAUDE.md\n');
    writeFileSync(join(area.org, 'docs', 'workspace', 'settings.json'), '{}\n');
    const org = byId(await only(area, ['guards'], { template: false }), 'guards');
    assert.equal(org.level, 'warn');
    assert.match(org.fix, /install-workspace\.mjs/);
    const tpl = byId(await only(area, ['guards'], { template: true }), 'guards');
    assert.equal(tpl.level, 'info');
    assert.equal(tpl.fix, null);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('a check that cannot run is reported, and the verdict is counted from the checks', async () => {
  const area = scratch();
  try {
    // A main repo without docs/workspace/: the guards check throws, and must still be a row.
    const r = await only(area, ['guards', 'identity', 'repos'], { offline: true });
    assert.equal(r.checks.length, 3);
    assert.equal(byId(r, 'guards').level, 'warn');
    assert.match(byId(r, 'guards').detail, /^could not run: /);
    assert.deepEqual([r.green, r.orange, r.red], [1, 1, 1]);
    for (const c of r.checks) assert.deepEqual(Object.keys(c).sort(), ['detail', 'fix', 'id', 'label', 'level']);
    assert.match(report(r), /3 check\(s\): 1 green, 1 orange, 1 red\.$/);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});
