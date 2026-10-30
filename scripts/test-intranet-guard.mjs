// The local-build guard: every intranet build wipes its folder first, `--local` lets the extension
// read local/ through `intranet.local` and marks the build, and the deploy guard refuses a marked or
// an empty build. Run on an invented co-op, end to end through the real build script.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCAL_MARK, prepareOut, refusal } from './intranet-guard.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'scripts/dashboard-data.mjs');
const GUARD = join(ROOT, 'scripts/intranet-guard.mjs');

// An extension with one page: the drafts in local/ when the build may read them, a note otherwise.
// It also tries the repository reader on local/, which must refuse.
const EXTENSION = `export default function extend(intranet) {
  let refused = false;
  try { intranet.read('local/drafts/grant.md'); } catch { refused = true; }
  intranet.page('drafts/', (c) => ({
    title: 'Drafts',
    body: c.local
      ? '<h1>Drafts</h1>' + c.local.list('drafts', { ext: '.md' }).map((f) => '<p>' + c.esc(c.local.read('drafts/' + f)) + '</p>').join('')
      : '<h1>Drafts</h1><p>Kept on one machine.</p>',
  }));
  intranet.home('end', () => '<p data-refused="' + refused + '"></p>');
}
`;

function coop() {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-guard-'));
  const w = (rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
  mkdirSync(join(dir, 'source/brand'), { recursive: true });
  copyFileSync(join(ROOT, 'source/brand/tokens.css'), join(dir, 'source/brand/tokens.css'));
  w('source/brief.md', '# Brief: Riverside Co-op\n');
  w('apps/intranet-extend/index.mjs', EXTENSION);
  w('local/drafts/grant.md', 'Draft answer to the county fund');
  const dist = join(dir, 'apps/dashboard/dist');
  const build = (...a) => execFileSync(process.execPath, [BUILD, ...a], { cwd: dir, encoding: 'utf8' });
  const guard = () => spawnSync(process.execPath, [GUARD], { cwd: dir, encoding: 'utf8' });
  return { dir, dist, build, guard, read: (rel) => readFileSync(join(dist, rel), 'utf8'), done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('without --local the extension cannot see local/, and the build may be deployed', () => {
  const c = coop();
  try {
    c.build();
    assert.match(c.read('drafts/index.html'), /Kept on one machine/);
    assert.doesNotMatch(c.read('drafts/index.html'), /county fund/);
    assert.match(c.read('index.html'), /data-refused="true"/, 'the repository reader refuses local/');
    assert.ok(!existsSync(join(c.dist, LOCAL_MARK)));
    const g = c.guard();
    assert.equal(g.status, 0, g.stderr);
    assert.match(g.stdout, /cleared to deploy/);
  } finally { c.done(); }
});

test('--local reads local/ through intranet.local, marks the build, and the guard refuses it', () => {
  const c = coop();
  try {
    const out = c.build('--local');
    assert.match(out, /built with --local/);
    assert.match(c.read('drafts/index.html'), /county fund/);
    assert.match(c.read('index.html'), /data-refused="true"/, 'local/ stays closed to read() even with --local');
    assert.ok(existsSync(join(c.dist, LOCAL_MARK)));
    const g = c.guard();
    assert.equal(g.status, 1);
    assert.match(g.stderr, /deploy refused: .*built with --local/);
    // The next ordinary build wipes the folder: the mark and the local page are gone, and it deploys.
    writeFileSync(join(c.dist, 'stray.html'), 'left over');
    c.build();
    assert.ok(!existsSync(join(c.dist, LOCAL_MARK)));
    assert.ok(!existsSync(join(c.dist, 'stray.html')), 'every build starts from an empty folder');
    assert.doesNotMatch(c.read('drafts/index.html'), /county fund/);
    assert.equal(c.guard().status, 0);
  } finally { c.done(); }
});

test('the guard refuses an empty build, and the wipe refuses a folder that is not a build', () => {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-guard-out-'));
  try {
    assert.match(refusal(join(dir, 'nothing')), /no intranet is built/);
    const g = spawnSync(process.execPath, [GUARD, `--out=${join(dir, 'nothing')}`], { encoding: 'utf8' });
    assert.equal(g.status, 1);
    assert.match(g.stderr, /Run `npm run intranet` first/);

    const notes = join(dir, 'notes');
    mkdirSync(notes);
    writeFileSync(join(notes, 'mine.txt'), 'keep me');
    assert.throws(() => prepareOut(notes), /holds no earlier intranet build/);
    assert.equal(readFileSync(join(notes, 'mine.txt'), 'utf8'), 'keep me');

    const built = join(dir, 'built');
    mkdirSync(built);
    writeFileSync(join(built, 'index.html'), 'old');
    prepareOut(built);
    assert.ok(!existsSync(join(built, 'index.html')));
    assert.ok(existsSync(built));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
