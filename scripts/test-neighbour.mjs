// What a neighbour lets a script read of it (lib/neighbour.mjs), and the readers that go
// through it, tested on throwaway repos. Every name here is invented.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSENT_FILE, ReadRefused, isShape, neighbour, readConsent } from '../lib/neighbour.mjs';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
const top = realpathSync(mkdtempSync(join(tmpdir(), 'neighbour-')));
after(() => rmSync(top, { recursive: true, force: true }));

const ID = ['-c', 'user.name=Sam', '-c', 'user.email=sam@example.com', '-c', 'init.defaultBranch=main'];
const git = (cwd, ...a) => execFileSync('git', [...ID, ...a], { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

/** A repo in ws/ with an origin, some files, one commit, and an optional consent. */
function repo(name, files = {}, consent = null) {
  const dir = join(top, 'ws', name);
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  git(dir, 'remote', 'add', 'origin', `https://github.com/acme/${name}.git`);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  if (consent !== null) writeFileSync(join(dir, CONSENT_FILE), consent);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'first');
  return dir;
}

const project = (slug, title, open, done) => ({
  [`projects/${slug}/charter.md`]: `# ${title}\n\nStage: active\n`,
  [`projects/${slug}/next-steps.md`]: [
    ...Array.from({ length: open }, (_, i) => `- [ ] ${title} step ${i + 1} @sam`),
    ...Array.from({ length: done }, (_, i) => `- [x] ${title} old step ${i + 1}`),
  ].join('\n') + '\n',
  [`projects/${slug}/log.md`]: `- 2026-03-02: ${title} went to the printer\n`,
});

// ------------------------------------------------------------------ the declaration

test('no file is full; one word sets the level; anything else is none, and says why', () => {
  const at = (text) => {
    const dir = mkdtempSync(join(top, 'c-'));
    if (text !== null) writeFileSync(join(dir, CONSENT_FILE), text);
    return readConsent(dir);
  };
  assert.deepEqual(at(null), { level: 'full', declared: false, problem: null });
  assert.equal(at('counts\n').level, 'counts');
  assert.equal(at('# only what the dashboard needs\nCOUNTS\n').level, 'counts');
  assert.equal(at('none').level, 'none');
  for (const bad of ['maybe', 'counts none', '', 'full please']) {
    const c = at(bad);
    assert.equal(c.level, 'none', `"${bad}" must not open anything`);
    assert.match(c.problem, /read as none/);
  }
});

test('a shape is numbers, yes or no, dates and commit ids, never a word', () => {
  for (const ok of [0, 3.5, true, null, '2026-03-02', '2026-03-02T09:00:00Z', 'a1b2c3d', { open: 2, last: '2026-03-02' }, [1, [false]]]) {
    assert.ok(isShape(ok), JSON.stringify(ok));
  }
  for (const bad of ['brochure', '42', 'Sam <sam@example.com>', { title: 'Brochure' }, [1, 'two'], NaN, () => 1]) {
    assert.ok(!isShape(bad), String(JSON.stringify(bad) ?? bad));
  }
});

// ------------------------------------------------------------------ the ceiling

const counted = repo('counted', project('tender', 'Printer Tender', 3, 2), 'counts\n');
const closed = repo('closed', { ...project('board', 'Board Minutes', 1, 0), 'CLAUDE.md': '# closed\n' }, 'none\n');
const open = repo('open', project('brochure', 'Brochure Reprint', 2, 1));

test('at full everything reads, as before', async () => {
  const n = neighbour(open);
  assert.equal(n.level, 'full');
  assert.match(n.text('projects/brochure/charter.md'), /Brochure Reprint/);
  assert.deepEqual(n.folders('projects'), ['brochure']);
  assert.equal(await n.history(['--format=%an'], (log) => log), 'Sam');
});

test('at counts the words stay home and the numbers come back', async () => {
  const n = neighbour(counted);
  assert.throws(() => n.text('projects/tender/charter.md'), ReadRefused);
  assert.throws(() => n.folders('projects'), ReadRefused);
  assert.equal(n.exists('projects/tender/next-steps.md'), true);
  assert.equal(n.measure('projects/tender/next-steps.md', (t) => t.split('\n').filter((l) => l.startsWith('- [ ]')).length), 3);
  assert.throws(() => n.measure('projects/tender/charter.md', (t) => t.split('\n')[0]), ReadRefused, 'a title is wording');
  assert.deepEqual(n.measureEach('projects', 'next-steps.md', (t) => ({ lines: t.trim().split('\n').length })), [{ lines: 5 }]);
  assert.equal(await n.history(['--format=%an'], (log) => log.split('\n').length), 1);
  await assert.rejects(n.history(['--format=%an'], (log) => log), ReadRefused, 'an author is a name');
});

test('at none nothing is opened, not even to see what is there', async () => {
  const n = neighbour(closed);
  for (const tryIt of [() => n.exists('CLAUDE.md'), () => n.text('CLAUDE.md'), () => n.measure('CLAUDE.md', () => 1),
    () => n.measureEach('projects', 'next-steps.md', () => 1), () => n.folders('projects')]) {
    assert.throws(tryIt, ReadRefused);
  }
  await assert.rejects(n.history(['--format=%H'], () => 1), ReadRefused);
});

test('a repo reading itself reads everything, whatever it declares to others', () => {
  assert.match(neighbour(closed, { self: true }).text('CLAUDE.md'), /closed/);
});

// ------------------------------------------------------------------ the readers

const org = repo('org', {
  'ORGANIGRAM.md': [
    '# Organigram', '', '| Repo | Kind | What it holds | Access | Publishes to |', '|---|---|---|---|---|',
    '| `acme/org` **(this one)** | `router` | the router | you | - |',
    '| `acme/counted` | `satellite` | tenders | you | - |',
    '| `acme/closed` | `satellite` | the board | you | - |',
    '| `acme/open` | `satellite` | print work | you | - |', '',
  ].join('\n'),
  'apps/dashboard/index.html': '<!doctype html>\n',
});

test('the dashboard sums a counts repo without a name, and only names a none repo', () => {
  const out = join(top, 'dash');
  const r = spawnSync('node', [join(KIT, 'scripts/dashboard-data.mjs'), `--out=${out}`], { cwd: org, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const raw = readFileSync(join(out, 'data.json'), 'utf8');
  const data = JSON.parse(raw);
  for (const word of ['Printer Tender', 'tender', 'Board Minutes', 'board']) {
    assert.ok(!raw.toLowerCase().includes(word.toLowerCase()), `"${word}" left its repo`);
  }
  const c = data.projects.find((p) => p.repo === 'acme/counted');
  assert.deepEqual(c.counts, { projects: 1, open: 3, done: 2 });
  assert.equal(c.consent, 'counts');
  assert.deepEqual(data.private, ['acme/closed']);
  assert.ok(data.projects.some((p) => p.title === 'Brochure Reprint'), 'a full repo still shows its titles');
});

test('check-workspace does not open a none repo, and says so', () => {
  const r = spawnSync('node', [join(KIT, 'scripts/check-workspace.mjs'), '--offline', '--json'], { cwd: org, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const about = JSON.parse(r.stdout).findings.filter((f) => f.what.includes('closed'));
  assert.ok(about.some((f) => /declares none in \.read-consent/.test(f.detail)));
  // Its CLAUDE.md has no pointer home: reading it would have produced this warning.
  assert.ok(!about.some((f) => /never mentions/.test(f.detail)), 'its CLAUDE.md was read');
  const other = JSON.parse(r.stdout).findings.filter((f) => f.what.includes('open'));
  assert.ok(other.length === 0 || other.every((f) => !/declares/.test(f.detail)));
});

test('the sync leaves a none repo alone, and reads trailers only where it may', async () => {
  const { run, retroactive } = await import('../scripts/workspace-sync.mjs');
  const result = await run(org, { command: 'status', fetch: false });
  const byName = Object.fromEntries(result.repos.map((r) => [r.name, r]));
  assert.equal(byName.closed.state, 'not-read');
  assert.match(byName.closed.detail, /declares none/);
  assert.notEqual(byName.counted.state, 'not-read', 'counts still lets the sync keep the clone current');

  for (const dir of [counted, open]) {
    writeFileSync(join(dir, 'price.md'), '12\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'Price list', '-m', 'Retroactive: date the price lists already published');
  }
  assert.equal(await retroactive(counted, 'HEAD~1..HEAD', neighbour(counted)), null, 'its commit messages stay home');
  const seen = await retroactive(open, 'HEAD~1..HEAD', neighbour(open));
  assert.deepEqual(seen.map((t) => t.sweep), ['date the price lists already published']);
});
