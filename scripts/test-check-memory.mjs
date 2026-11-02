// The memory sweep, run against a throwaway home.
//
// What is pinned: which of ~/.claude/projects a sweep opens, from the folder layouts the
// kit documents (repos side by side in ~/Projects) and others, on a Mac or a Linux home;
// that a folder matching nothing is said out loud; and that a path the memory names is
// checked against the disk. No network: gh is kept off PATH and no memory holds a URL.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode, indexFindings, INDEX_LINES } from './check-memory.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-memory.mjs');

function home() {
  const h = realpathSync(mkdtempSync(join(tmpdir(), 'memory-')));
  const memory = (folder, file, text) => {
    const dir = join(h, '.claude', 'projects', encode(folder), 'memory');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), text);
  };
  const repo = (path) => { mkdirSync(join(path, '.git'), { recursive: true }); return path; };
  return { h, memory, repo };
}

function sweep(h, cwd, ...args) {
  const r = spawnSync(process.execPath, [SCRIPT, '--json', ...args], {
    cwd, encoding: 'utf8', env: { HOME: h, PATH: dirname(process.execPath) },
  });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* a message, not a report */ }
  return { code: r.status, out: r.stdout, err: r.stderr, json };
}

test('the key is the absolute path with every non-alphanumeric turned into a dash, case kept', () => {
  assert.equal(encode('/Users/sam/Projects/site'), '-Users-sam-Projects-site');
  assert.equal(encode('/home/sam/My Work/.claude/x_y'), '-home-sam-My-Work--claude-x-y');
});

test('run from a clone in a flat ~/Projects, it sweeps that folder and nothing beside it', () => {
  const { h, memory, repo } = home();
  try {
    const projects = join(h, 'Projects');
    const site = repo(join(projects, 'site'));
    mkdirSync(join(h, 'Projects-old', 'x'), { recursive: true });
    memory(projects, 'folder.md', 'Checked 2026-10-01.\n');
    memory(site, 'site.md', 'Checked 2026-10-01.\n');
    memory(join(site, '.claude', 'worktrees', 'w1'), 'worktree.md', 'Checked 2026-10-01.\n');
    memory(join(h, 'Projects-old', 'x'), 'sibling.md', 'Checked 2026-10-01.\n');
    memory(join(h, 'Elsewhere'), 'other.md', 'Checked 2026-10-01.\n');

    const r = sweep(h, site);
    assert.equal(r.code, 0, r.err);
    assert.deepEqual(r.json.folders, [projects]);
    assert.equal(r.json.scanned, 3);
    assert.equal(r.json.skipped, 2);

    // Run from the folder itself, which is not a repo, the folder is the same.
    assert.equal(sweep(h, projects).json.scanned, 3);
    assert.equal(sweep(h, site, '--all').json.scanned, 5);
  } finally { rmSync(h, { recursive: true, force: true }); }
});

test('--folder names another folder, with ~, a space or a dot in it, and can be repeated', () => {
  const { h, memory } = home();
  try {
    const work = join(h, 'My Work.d');
    mkdirSync(join(work, 'repo'), { recursive: true });
    memory(join(work, 'repo'), 'a.md', 'Checked 2026-10-01.\n');
    memory(join(h, 'Renamed'), 'b.md', 'Checked 2026-10-01.\n');

    assert.equal(sweep(h, h, '--folder=~/My Work.d').json.scanned, 1);
    assert.equal(sweep(h, h, '--folder=~/My Work.d', '--folder=~/Renamed').json.scanned, 2);
  } finally { rmSync(h, { recursive: true, force: true }); }
});

test('a folder that matches nothing says so: an error when named, a plain note by default', () => {
  const { h, memory, repo } = home();
  try {
    memory(join(h, 'Elsewhere'), 'other.md', 'Checked 2026-10-01.\n');
    const named = sweep(h, h, '--folder=~/Nowhere');
    assert.equal(named.code, 1);
    assert.match(named.err, /nothing was swept/);

    const site = repo(join(h, 'Projects', 'site'));
    const quiet = sweep(h, site);
    assert.equal(quiet.code, 0);
    assert.match(quiet.out, /no memory to sweep/);
  } finally { rmSync(h, { recursive: true, force: true }); }
});

test('paths the memory names are held against the disk, on a Mac or a Linux home', () => {
  const { h, memory, repo } = home();
  try {
    const projects = join(h, 'Projects');
    repo(join(projects, 'site'));
    memory(projects, 'paths.md', [
      'Checked 2026-10-01.',
      '- The site lives in ~/Projects/site.',
      '- The drafts are in ~/Projects/ghost.',
      '- A teammate keeps a copy in /home/alex/Projects/site.',
      '- The archive moved: ~/Projects/old-archive was renamed.',
    ].join('\n'));
    memory(join(projects, 'site'), 'undated.md', 'The site has two pages.\n');

    const r = sweep(h, projects);
    const by = (what) => r.json.findings.find((f) => f.what.startsWith(what));
    assert.equal(by('~/Projects/site'), undefined);
    assert.equal(by('~/Projects/ghost').severity, 'warn');
    assert.equal(by('/home/alex/Projects/site').severity, 'warn');
    assert.equal(by('~/Projects/old-archive').severity, 'info');
    assert.equal(by('(no date)').where, 'Projects-site ▸ undated.md');
  } finally { rmSync(h, { recursive: true, force: true }); }
});

test('the index names the memories it does not link, and those it links past the cut', () => {
  const files = ['printer.md', 'brochure.md', 'late.md'];
  const short = '- [Printer](printer.md) — the printer wants files by Friday\n- [Brochure](brochure.md) — two folds\n';
  const f = indexFindings(short, files);
  assert.deepEqual(f.map((x) => x.what), ['late.md']);
  assert.match(f[0].detail, /not linked/);

  const long = short + Array.from({ length: INDEX_LINES + 10 }, (_, i) => `- line ${i}`).join('\n') + '\n- [Late](late.md) — added last\n';
  const g = indexFindings(long, files);
  assert.equal(g[0].what, 'MEMORY.md');
  assert.match(g[0].detail, /stops at line 200/);
  assert.match(g.find((x) => x.what === 'late.md').detail, /past the cut at line 200/);
  assert.equal(g.length, 2, 'the two files linked before the cut are fine');

  // The byte cut comes first when the lines are long.
  const wide = Array.from({ length: 50 }, () => `- ${'x'.repeat(600)}`).join('\n') + '\n- [Printer](printer.md)\n';
  assert.match(indexFindings(wide, ['printer.md']).find((x) => x.what === 'printer.md').detail, /past the cut/);

  const exact = Array.from({ length: INDEX_LINES }, (_, i) => (i ? `- line ${i}` : '- [Printer](printer.md)')).join('\n') + '\n';
  assert.deepEqual(indexFindings(exact, ['printer.md']), [], 'exactly 200 lines and a final newline fit');
  assert.match(indexFindings(null, files)[0].detail, /none of the 3/);
  assert.deepEqual(indexFindings(null, []), []);
  assert.deepEqual(indexFindings('- [P](printer.md)', ['printer.md']), [], 'a name inside a longer one does not count, the link does');
  assert.equal(indexFindings('- [P](old-printer.md)', ['printer.md']).length, 1);
});

test('the sweep reports the index findings under MEMORY.md', () => {
  const { h, memory, repo } = home();
  try {
    const projects = join(h, 'Projects');
    repo(join(projects, 'site'));
    memory(projects, 'MEMORY.md', '- [Printer](printer.md) — checked 2026-10-01\n');
    memory(projects, 'printer.md', 'Checked 2026-10-01.\n');
    memory(projects, 'orphan.md', 'Checked 2026-10-01.\n');
    const r = sweep(h, projects);
    const orphan = r.json.findings.find((x) => x.what === 'orphan.md');
    assert.equal(orphan.where, 'Projects ▸ MEMORY.md');
    assert.equal(orphan.severity, 'warn');
    assert.equal(r.json.findings.find((x) => x.what === 'printer.md'), undefined);
  } finally { rmSync(h, { recursive: true, force: true }); }
});
