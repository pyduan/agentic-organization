// The workspace sync, tested on throwaway remotes and clones.
//
// What this pins is the one promise the sync makes: it never loses work. A clone is
// fast-forwarded only on its default branch with nothing uncommitted in tracked files
// and no commits of its own; every other clone is named and left exactly as it was.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, run, syncReport, statusReport } from './workspace-sync.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = ['-c', 'user.name=Sam', '-c', 'user.email=sam@example.com', '-c', 'init.defaultBranch=main'];
const git = (cwd, ...a) => execFileSync('git', [...ID, ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** A scratch area: remotes/ holds the bare repos, ws/ the clones, org/ the main repo with its map. */
function scratch(mapRows = []) {
  const top = realpathSync(mkdtempSync(join(tmpdir(), 'sync-')));
  process.env.KIT_WORKSPACE_MAP = join(top, 'machine.json'); // never this machine's real file
  const ws = join(top, 'ws');
  mkdirSync(ws);
  const area = { top, ws };
  area.org = repoFor(area, 'org', {
    'ORGANIGRAM.md': ['# Organigram', '', '| Repo | Kind | What it holds |', '|---|---|---|',
      '| `acme/org` **(this one)** | `router` | the map |', ...mapRows, ''].join('\n'),
  }).dir;
  return area;
}

/** A bare remote at remotes/acme/<name>.git with one commit, and its clone in ws/. */
function repoFor({ top, ws }, name, files = { 'README.md': `# ${name}\n` }) {
  const remote = join(top, 'remotes', 'acme', `${name}.git`);
  mkdirSync(dirname(remote), { recursive: true });
  git(top, 'init', '-q', '--bare', remote);
  const seed = join(top, `seed-${name}`);
  git(top, 'clone', '-q', remote, seed);
  for (const [f, t] of Object.entries(files)) writeFileSync(join(seed, f), t);
  git(seed, 'add', '-A'); git(seed, 'commit', '-q', '-m', 'first'); git(seed, 'push', '-q', 'origin', 'HEAD:main');
  const dir = join(ws, name);
  git(ws, 'clone', '-q', remote, dir);
  return { dir, remote, seed };
}

/** Someone else pushes a commit adding or changing `file`. */
function pushFromElsewhere({ seed }, file, text) {
  git(seed, 'pull', '-q', '--ff-only');
  writeFileSync(join(seed, file), text);
  git(seed, 'add', '-A'); git(seed, 'commit', '-q', '-m', `change ${file}`); git(seed, 'push', '-q', 'origin', 'HEAD:main');
}

const byName = (result, name) => result.repos.find((r) => r.name === name);
const head = (dir, ref = 'HEAD') => git(dir, 'rev-parse', ref);

// ------------------------------------------------------------------ the policy

test('the policy: only a clean default branch with nothing of its own is fast-forwarded', () => {
  const base = { branch: 'main', defaultBranch: 'main', dirty: false, ahead: 0, behind: 0 };
  const cases = [
    [{}, 'up-to-date', false],
    [{ behind: 2 }, 'behind', true],
    [{ behind: 2, dirty: true }, 'local-changes', false],
    [{ behind: 2, ahead: 1 }, 'diverged', false],
    [{ ahead: 1 }, 'ahead', false],
    [{ behind: 2, branch: 'draft' }, 'other-branch', false],
    [{ behind: 2, branch: '' }, 'other-branch', false], // detached HEAD, or a rebase in progress
    [{ dirty: true }, 'up-to-date', false],
  ];
  for (const [over, state, merge] of cases) {
    const d = decide({ ...base, ...over });
    assert.equal(d.state, state, JSON.stringify(over));
    assert.equal(d.merge, merge, JSON.stringify(over));
  }
  assert.match(decide({ ...base, branch: '' }).detail, /detached HEAD/);
});

// ------------------------------------------------------------------ on real clones

test('a clean clone on its default branch is fast-forwarded, and the map decides which repos count', async () => {
  const area = scratch(['| `acme/shop` | `satellite` | the shop |', '| `acme/books` | `satellite` | not here |']);
  try {
    const shop = repoFor(area, 'shop');
    const stray = repoFor(area, 'stray');            // beside the router, on no map row
    pushFromElsewhere(shop, 'price.md', '12\n');
    pushFromElsewhere(stray, 'x.md', 'x\n');

    const status = await run(area.org, { command: 'status' });
    assert.equal(byName(status, 'shop').state, 'behind');
    assert.ok(!existsSync(join(shop.dir, 'price.md')), 'status changes nothing');
    assert.deepEqual(status.missing, ['acme/books']);
    assert.equal(byName(status, 'stray'), undefined, 'not on the map, and no --siblings');
    assert.match(statusReport(status), /acme\/books\s+on the map, not on this machine/);
    assert.match(statusReport(status), /1 can be fast-forwarded, 0 need a person/);

    const sync = await run(area.org, { command: 'sync' });
    assert.equal(byName(sync, 'shop').state, 'updated');
    assert.equal(readFileSync(join(shop.dir, 'price.md'), 'utf8'), '12\n');
    assert.ok(!existsSync(join(stray.dir, 'x.md')), 'a repo off the map is not touched');
    assert.match(syncReport(sync), /^Workspace: 2 repo\(s\) up to date \(1 pulled just now\)\.$/);
    assert.equal(syncReport(sync, { quiet: true }), '', 'nothing needs a person: quiet says nothing');

    const withSiblings = await run(area.org, { command: 'sync', siblings: true });
    assert.equal(byName(withSiblings, 'stray').state, 'updated');
    assert.equal(byName(withSiblings, 'stray').onMap, false);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('uncommitted changes, another branch, own commits: named, and left exactly as they were', async () => {
  const area = scratch(['| `acme/a` | | |', '| `acme/b` | | |', '| `acme/c` | | |', '| `acme/d` | | |']);
  try {
    const a = repoFor(area, 'a');                     // a tracked file edited, not committed
    writeFileSync(join(a.dir, 'README.md'), 'my draft\n');
    pushFromElsewhere(a, 'new.md', 'new\n');

    const b = repoFor(area, 'b');                     // someone is working on a branch
    git(b.dir, 'checkout', '-q', '-b', 'draft');
    pushFromElsewhere(b, 'new.md', 'new\n');

    const c = repoFor(area, 'c');                     // a commit of ours and one of theirs
    writeFileSync(join(c.dir, 'mine.md'), 'mine\n');
    git(c.dir, 'add', '-A'); git(c.dir, 'commit', '-q', '-m', 'mine');
    pushFromElsewhere(c, 'theirs.md', 'theirs\n');

    const d = repoFor(area, 'd');                     // a commit of ours, nothing new upstream
    writeFileSync(join(d.dir, 'mine.md'), 'mine\n');
    git(d.dir, 'add', '-A'); git(d.dir, 'commit', '-q', '-m', 'mine');

    const before = Object.fromEntries([a, b, c, d].map((r) => [r.dir, head(r.dir)]));
    const sync = await run(area.org, { command: 'sync' });
    assert.equal(byName(sync, 'a').state, 'local-changes');
    assert.equal(byName(sync, 'b').state, 'other-branch');
    assert.equal(byName(sync, 'c').state, 'diverged');
    assert.equal(byName(sync, 'd').state, 'ahead');
    for (const r of [a, b, c, d]) assert.equal(head(r.dir), before[r.dir], `${r.dir} did not move`);
    assert.equal(readFileSync(join(a.dir, 'README.md'), 'utf8'), 'my draft\n');
    assert.notEqual(head(b.dir, 'main'), head(b.dir, 'origin/main'), 'the default branch under a branch is not moved either');

    const quiet = syncReport(sync, { quiet: true });
    assert.match(quiet, /• a: NOT updated, 1 new commit on main, and uncommitted changes in the way\. Commit or set/);
    assert.match(quiet, /• b: NOT updated, on draft, not main\./);
    assert.match(quiet, /• c: NOT updated, 1 commit of yours and 1 new commit on main\. Run git pull --rebase/);
    assert.match(quiet, /• d: 1 commit not pushed yet\./);
    assert.match(quiet, /Never discard changes or commits/);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('an untracked file does not block a pull, and git refusing to overwrite one changes nothing', async () => {
  const area = scratch(['| `acme/a` | | |', '| `acme/b` | | |']);
  try {
    const a = repoFor(area, 'a');
    writeFileSync(join(a.dir, 'scratch.md'), 'mine\n');
    pushFromElsewhere(a, 'other.md', 'theirs\n');

    const b = repoFor(area, 'b');
    writeFileSync(join(b.dir, 'notes.md'), 'mine\n');
    pushFromElsewhere(b, 'notes.md', 'theirs\n');
    const before = head(b.dir);

    const sync = await run(area.org, { command: 'sync' });
    assert.equal(byName(sync, 'a').state, 'updated');
    assert.equal(readFileSync(join(a.dir, 'scratch.md'), 'utf8'), 'mine\n');
    assert.equal(byName(sync, 'b').state, 'refused');
    assert.match(byName(sync, 'b').detail, /git refused the fast-forward \(.*untracked.*\), nothing changed/);
    assert.equal(readFileSync(join(b.dir, 'notes.md'), 'utf8'), 'mine\n');
    assert.equal(head(b.dir), before);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('no origin, or an origin that does not answer: named, never an error that hides the rest', async () => {
  const area = scratch();
  try {
    mkdirSync(join(area.ws, 'local-only'));
    git(join(area.ws, 'local-only'), 'init', '-q');
    const gone = repoFor(area, 'gone');
    git(gone.dir, 'remote', 'set-url', 'origin', join(area.top, 'remotes', 'acme', 'nowhere.git'));
    git(area.org, 'remote', 'set-url', 'origin', join(area.top, 'remotes', 'acme', 'nowhere-either.git'));

    const sync = await run(area.org, { command: 'sync', siblings: true });
    assert.equal(byName(sync, 'local-only').state, 'no-remote');
    assert.equal(byName(sync, 'gone').state, 'unreachable');
    const text = syncReport(sync);
    assert.match(text, /Could not reach origin for any of the 2 repos \(offline\?\): nothing was updated\./);
    assert.match(text, /• local-only: no origin remote, so nothing to pull from\./);
    assert.doesNotMatch(text, /• gone:/, 'offline is said once, not once per repo');
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('a pull lists the Retroactive: trailers it brought, other than none, even when quiet', async () => {
  const area = scratch(['| `acme/shop` | `satellite` | the shop |']);
  try {
    const shop = repoFor(area, 'shop');
    const commit = (file, ...msg) => {
      git(shop.seed, 'pull', '-q', '--ff-only');
      writeFileSync(join(shop.seed, file), `${file}\n`);
      git(shop.seed, 'add', '-A');
      git(shop.seed, 'commit', '-q', ...msg.flatMap((m) => ['-m', m]));
      git(shop.seed, 'push', '-q', 'origin', 'HEAD:main');
    };
    commit('a.md', 'Prices carry their date', 'Retroactive: date the price lists already published');
    commit('b.md', 'Typo', 'Retroactive: none');
    commit('c.md', 'Shorter subject lines', 'Why.', 'Retroactive: none, forward-looking');

    const sync = await run(area.org, { command: 'sync' });
    const r = byName(sync, 'shop');
    assert.equal(r.state, 'updated');
    assert.deepEqual(r.retroactive.map((x) => [x.subject, x.sweep]), [['Prices carry their date', 'date the price lists already published']]);
    const quiet = syncReport(sync, { quiet: true });
    assert.match(quiet, /^Rules just pulled that apply to what already exists/);
    assert.match(quiet, /• shop [0-9a-f]{8} Prices carry their date: date the price lists already published/);
    assert.doesNotMatch(quiet, /some clones need a look/);

    assert.equal(byName(await run(area.org, { command: 'sync' }), 'shop').retroactive, undefined, 'said once, at the pull');
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('a clone git cannot compare with origin is named, never reported up to date', async () => {
  const area = scratch(['| `acme/shop` | `satellite` | the shop |']);
  try {
    const shop = repoFor(area, 'shop');
    // origin/main names a commit this clone does not have.
    writeFileSync(join(shop.dir, '.git', 'refs', 'remotes', 'origin', 'main'), `${'1'.repeat(40)}\n`);
    const status = await run(area.org, { command: 'status', fetch: false });
    const r = byName(status, 'shop');
    assert.equal(r.state, 'unreadable');
    assert.match(r.detail, /^could not compare with origin\/main/);
    assert.match(statusReport(status), /0 can be fast-forwarded, 1 need a person/);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('from the command line: JSON out, and exit 1 only when a sync failed for a reason nobody chose', () => {
  const area = scratch(['| `acme/shop` | | |']);
  try {
    for (const f of ['scripts/workspace-sync.mjs', 'lib/workspace.mjs']) cpSync(join(KIT, f), join(area.org, f));
    const shop = repoFor(area, 'shop');
    pushFromElsewhere(shop, 'price.md', '12\n');
    const cli = (...a) => spawnSync('node', [join(area.org, 'scripts/workspace-sync.mjs'), ...a], {
      encoding: 'utf8', env: process.env,
    });

    const ok = cli('sync', '--json');
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(JSON.parse(ok.stdout).repos.find((r) => r.name === 'shop').state, 'updated');

    // Still acme/shop by its URL, so the map still finds it; just nothing answers there.
    git(shop.dir, 'remote', 'set-url', 'origin', join(area.top, 'gone', 'acme', 'shop.git'));
    const failed = cli('sync', '--quiet');
    assert.equal(failed.status, 1);
    assert.match(failed.stdout, /• shop: NOT updated, could not reach origin/);
    assert.equal(cli('status', '--offline').status, 0, 'status always exits 0');
    assert.equal(cli('pull').status, 1, 'an unknown command is refused');
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});
