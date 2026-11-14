// Copies that declare their source (lib/derived.mjs): the freshness pass that finds a copy left
// behind, and the end-of-turn hook that proposes its rebuild (.claude/hooks/derived.mjs). Every
// name here is invented.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { covers, readDerived, standing, touchedCopies } from '../lib/derived.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const top = realpathSync(mkdtempSync(join(tmpdir(), 'derived-')));
after(() => rmSync(top, { recursive: true, force: true }));
const ID = ['-c', 'user.name=Sam', '-c', 'user.email=sam@example.com', '-c', 'init.defaultBranch=main'];
const git = (cwd, args, when) => execFileSync('git', [...ID, ...args], {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  env: when ? { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } : process.env,
});
const write = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const commit = (dir, msg, when) => { git(dir, ['add', '-A']); git(dir, ['commit', '-q', '-m', msg], when); };

test('a source pattern covers a file, a folder ending in /, or a glob', () => {
  assert.ok(covers('data/menu.csv', 'data/menu.csv'));
  assert.ok(covers('data', 'data/menu.csv'), 'a folder named without its slash');
  assert.ok(covers('templates/', 'templates/a/b.html'));
  assert.ok(covers('templates/*.html', 'templates/menu.html'));
  assert.ok(!covers('templates/*.html', 'templates/old/menu.html'), '* stays within a folder');
  assert.ok(covers('templates/**/*.html', 'templates/old/menu.html'));
  assert.ok(!covers('data/menu.csv', 'data/menu.csv.bak'));
});

test('a copy whose source has a newer commit is behind; once rebuilt and committed it is current', () => {
  const site = join(top, 'bakery-site');
  const tool = join(top, 'menu-tool');
  for (const d of [site, tool]) { mkdirSync(d); git(d, ['init', '-q']); }
  write(tool, 'data/menu.csv', 'bread,2\n'); commit(tool, 'menu', '2026-10-01T10:00:00Z');
  write(site, 'derived.json', JSON.stringify({ copies: [
    { copy: 'site/public/menu.html', from: 'menu-tool', sources: ['data/'], rebuild: 'npm run menu', why: 'customers read it before they order' },
    { copy: 'site/public/hours.html', sources: ['source/hours.md'] },
    { copy: 'site/public/press.html', from: 'press-kit', sources: ['kit/'] },
  ] }));
  write(site, 'site/public/menu.html', '<p>bread 2</p>\n');
  write(site, 'source/hours.md', '9 to 5\n');
  write(site, 'site/public/hours.html', '<p>9 to 5</p>\n');
  commit(site, 'site', '2026-10-02T10:00:00Z');
  const states = () => Object.fromEntries(standing(readDerived(site)).map((c) => [c.copy, c.state]));
  assert.deepEqual(states(), { 'site/public/menu.html': 'current', 'site/public/hours.html': 'current', 'site/public/press.html': 'no-source' });

  write(tool, 'data/menu.csv', 'bread,3\n'); commit(tool, 'price', '2026-10-05T10:00:00Z');
  assert.equal(states()['site/public/menu.html'], 'behind');

  // Through the freshness sweep: a warning naming the rebuild, never a failure.
  let out;
  try { out = execFileSync(process.execPath, [join(KIT, 'scripts/check-freshness.mjs'), '--only=derived', '--offline', '--json'], { cwd: site, encoding: 'utf8' }); }
  catch (e) { assert.fail(`the sweep failed: ${e.stdout}`); }
  const warns = JSON.parse(out).findings.filter((f) => f.pass === 'derived' && f.severity === 'warn');
  assert.equal(warns.length, 1);
  assert.match(warns[0].detail, /1 source commit\(s\) since the copy's last commit \(2026-10-02\); customers read it before they order\. Rebuild with `npm run menu`/);

  write(site, 'site/public/menu.html', '<p>bread 3</p>\n'); commit(site, 'menu rebuilt', '2026-10-06T10:00:00Z');
  assert.equal(states()['site/public/menu.html'], 'current');
});

test('the copies a session touched: by their sources, and not when it rebuilt the copy too', () => {
  const copies = [{ copy: 'site/public/menu.html', dir: '/w/site', sourceDir: '/w/tool', sources: ['data/'] }];
  assert.deepEqual(touchedCopies(copies, [{ dir: '/w/tool', path: 'data/menu.csv' }])[0].touched, ['data/menu.csv']);
  assert.deepEqual(touchedCopies(copies, [{ dir: '/w/site', path: 'data/menu.csv' }]), [], 'the same path in another repo is not the source');
  assert.deepEqual(touchedCopies(copies, [{ dir: '/w/tool', path: 'data/menu.csv' }, { dir: '/w/site', path: 'site/public/menu.html' }]), []);
});

test('the end-of-turn hook proposes the rebuild once, and says nothing where nothing is declared', () => {
  const ws = join(top, 'ws');
  const router = join(ws, 'acme-ops');
  mkdirSync(join(router, '.claude'), { recursive: true });
  cpSync(join(KIT, '.claude/hooks'), join(router, '.claude/hooks'), { recursive: true });
  cpSync(join(KIT, 'lib'), join(router, 'lib'), { recursive: true });
  git(router, ['init', '-q']);
  write(router, 'source/menu.md', 'bread\n');
  write(router, 'site/public/menu.html', '<p>bread</p>\n');
  commit(router, 'first');
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const transcript = (file) => [
    { type: 'assistant', timestamp: iso(now - 5000), message: { content: [{ type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: join(router, file), old_string: 'a', new_string: 'b' } }] } },
    { type: 'user', timestamp: iso(now - 4000), message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } },
  ].map((l) => JSON.stringify(l)).join('\n');
  const stop = (file, id = 's-1') => {
    const path = join(ws, `${id}.jsonl`);
    writeFileSync(path, transcript(file));
    return execFileSync(process.execPath, [join(router, '.claude/hooks/derived.mjs')], {
      input: JSON.stringify({ session_id: id, transcript_path: path }), env: { ...process.env, CLAUDE_PROJECT_DIR: router }, encoding: 'utf8',
    });
  };
  assert.equal(stop('source/menu.md'), '', 'no derived.json: nothing to say');

  write(router, 'derived.json', JSON.stringify({ copies: [{ copy: 'site/public/menu.html', sources: ['source/menu.md'], rebuild: 'npm run menu', why: 'the menu is public' }] }));
  const out = JSON.parse(stop('source/menu.md'));
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /site\/public\/menu\.html \(the menu is public\): changed source\/menu\.md\. Rebuild: `npm run menu`/);
  assert.match(out.reason, /run nothing on your own/);
  assert.equal(stop('source/menu.md'), '', 'said once per session');
  assert.equal(stop('site/public/other.html', 's-2'), '', 'a file that is no source');
});
