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
import { setupStage, SAY_SETUP } from '../lib/setup-stage.mjs';

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

// ---------------------------------------------------------------- the setup's first steps

const STACK = (approved) => [
  '# Stack', '', '| Role | What we use | State | Way out | Approved |', '|---|---|---|---|---|',
  `| Source of truth | Git | in place | any Git host | ${approved[0] || ''} |`,
  `| Private pages (the intranet first) | Access, https://riverside-dashboard.sam.workers.dev | in place | any gate | ${approved[1] || ''} |`, '',
].join('\n');

test('stack: rows without a dated approval are orange and named, all approved is green', async () => {
  const area = scratch();
  try {
    assert.match(byId(await only(area, ['stack'], { template: false }), 'stack').detail, /no STACK\.md/);
    writeFileSync(join(area.org, 'STACK.md'), '| Role | What we use |\n|---|---|\n| Website | Workers |\n');
    assert.match(byId(await only(area, ['stack'], { template: false }), 'stack').detail, /no Approved column/);
    writeFileSync(join(area.org, 'STACK.md'), STACK(['2026-10-30 @sam']));
    const half = byId(await only(area, ['stack'], { template: false }), 'stack');
    assert.equal(half.level, 'warn');
    assert.match(half.detail, /^1 of 2 row\(s\) not approved yet: Private pages/);
    assert.match(half.fix, /walk the stack/);
    writeFileSync(join(area.org, 'STACK.md'), STACK(['2026-10-30 @sam', '2026-10-30 @sam']));
    assert.equal(byId(await only(area, ['stack'], { template: false }), 'stack').level, 'ok');
    assert.equal(byId(await only(area, ['stack'], { template: true }), 'stack').level, 'info');
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

const CONNECTORS = [
  '# Connectors', '', '<!-- | a | comment | -->',
  '| Connector | Status | What for, and how far | Who approves | Approved |', '|---|---|---|---|---|',
  '| Gmail | authorized | one-off import | @sam | 2026-10-30 @sam |',
  '| Google Drive (`gdrive`) | recommended | named folders | @sam | 2026-10-30 @sam |',
  '| Notion | to decide | export | @sam | |',
  '| Third-party WhatsApp servers (`whatsapp`) | not allowed | none | @sam | 2026-10-30 @sam |', '',
].join('\n');

test('connectors: names only, a configured server without an approved row is orange, a forbidden one red', async () => {
  const area = scratch();
  const home = join(area.top, 'home');
  mkdirSync(join(home, '.claude'), { recursive: true });
  const servers = (user, project = {}) => writeFileSync(join(home, '.claude.json'), JSON.stringify({
    mcpServers: user, projects: { [area.org]: { mcpServers: project } },
  }));
  const check = async () => byId(await only(area, ['connectors'], { template: false, home }), 'connectors');
  try {
    assert.match((await check()).detail, /no CONNECTORS\.md/);
    writeFileSync(join(area.org, 'CONNECTORS.md'), CONNECTORS);
    servers({ gdrive: { command: 'x', env: { TOKEN: 'secret-never-read-out' } } });
    let c = await check();
    assert.equal(c.level, 'warn');
    assert.match(c.detail, /^1 of 4 row\(s\) of CONNECTORS\.md not approved yet; approved but not configured on this machine: Gmail/);
    assert.doesNotMatch(JSON.stringify(c), /secret-never-read-out/);

    servers({ gdrive: {} }, { 'notion-mcp': {}, 'crm-sync': {} });
    c = await check();
    assert.equal(c.level, 'warn');
    assert.match(c.detail, /not on the list: crm-sync \(~\/\.claude\.json \(this repo\)\)/);
    assert.match(c.detail, /listed, not approved: notion-mcp/);

    writeFileSync(join(area.org, '.mcp.json'), JSON.stringify({ mcpServers: { whatsapp: {} } }));
    c = await check();
    assert.equal(c.level, 'fail');
    assert.match(c.detail, /does not allow it: whatsapp \(\.mcp\.json\)/);
    rmSync(join(area.org, '.mcp.json'));

    writeFileSync(join(area.org, 'CONNECTORS.md'), CONNECTORS.replace('| Notion | to decide | export | @sam | |', '| Notion (`notion-mcp`) | authorized | export | @sam | 2026-10-31 @sam |'));
    servers({ gdrive: {} }, { 'notion-mcp': {} });
    c = await check();
    assert.equal(c.level, 'ok');
    assert.match(c.detail, /2 server\(s\) configured here, each on an approved row; approved but not configured on this machine: Gmail/);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('intranet: unnamed, built with --local, then published open (red) and behind Access (green)', async () => {
  const area = scratch();
  const dash = join(area.org, 'apps', 'dashboard');
  const answer = (status, location) => async () => ({ status, headers: new Headers(location ? { location } : {}) });
  const check = async (o = {}) => byId(await only(area, ['intranet'], { template: false, ...o }), 'intranet');
  try {
    assert.match((await check()).detail, /no apps\/dashboard/);
    mkdirSync(join(dash, 'dist'), { recursive: true });
    writeFileSync(join(dash, 'wrangler.jsonc'), '{ "name": "my-dashboard" }\n');
    let c = await check();
    assert.equal(c.level, 'warn');
    assert.match(c.detail, /not published yet: its Worker still has the template's name/);
    assert.match(c.fix, /publish my intranet/);

    writeFileSync(join(dash, 'dist', 'index.html'), '<p>home</p>');
    writeFileSync(join(dash, 'dist', '.local-build'), 'local');
    assert.match((await check()).detail, /made with --local/);
    rmSync(join(dash, 'dist', '.local-build'));

    writeFileSync(join(dash, 'wrangler.jsonc'), '{ "name": "riverside-dashboard" }\n');
    assert.match((await check()).detail, /^built; no address recorded/);

    writeFileSync(join(area.org, 'STACK.md'), STACK([]));
    assert.equal((await check({ offline: true })).level, 'info');
    c = await check({ fetch: answer(200) });
    assert.equal(c.level, 'fail');
    assert.match(c.detail, /answers without a sign-in/);
    c = await check({ fetch: answer(302, 'https://riverside.cloudflareaccess.com/cdn-cgi/access/login/x') });
    assert.equal(c.level, 'ok');
    assert.match(c.detail, /riverside-dashboard\.sam\.workers\.dev, behind a sign-in/);
    assert.equal((await check({ fetch: answer(403) })).level, 'ok');
    assert.equal((await check({ fetch: async () => { throw new Error('ENOTFOUND'); } })).level, 'warn');
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});

test('the next step follows the setup\'s order: the brief, the stack, the connectors, the intranet', () => {
  const area = scratch();
  const w = (rel, text) => { mkdirSync(join(area.org, rel, '..'), { recursive: true }); writeFileSync(join(area.org, rel), text); };
  const table = (approved) => `| Connector | Status | Approved |\n|---|---|---|\n| Gmail | authorized | ${approved} |\n`;
  try {
    assert.equal(setupStage(area.org).next, SAY_SETUP, 'no brief yet');
    w('source/brief.md', '# Riverside Co-op\n- **Owner**: TODO\n');
    assert.equal(setupStage(area.org).next, SAY_SETUP, 'a brief with TODO is the template');
    w('source/brief.md', '# Riverside Co-op\n- **Owner**: Sam\n');
    w('STACK.md', STACK(['2026-10-30 @sam']));
    assert.match(setupStage(area.org).next, /walk the stack/);
    w('STACK.md', STACK(['2026-10-30 @sam', '2026-10-30 @sam']));
    w('CONNECTORS.md', table(''));
    assert.match(setupStage(area.org).next, /walk the connectors/);
    w('CONNECTORS.md', table('2026-10-30 @sam'));
    assert.match(setupStage(area.org).next, /publish my intranet/);
    w('apps/dashboard/dist/index.html', '<p>home</p>');
    const s = setupStage(area.org);
    assert.deepEqual([s.setUp, s.stack, s.connectors, s.intranet], [true, 0, 0, true]);
    assert.match(s.next, /check my setup/);
  } finally { rmSync(area.top, { recursive: true, force: true }); }
});
