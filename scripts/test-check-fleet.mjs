// The fleet scan, tested on throwaway repos.
//
// One bug is worth a permanent guard: `templateHead` used to be the HEAD of
// whatever repo the script was started from, so run from a project — which is
// what the update-kit skill asks — every "behind" count was the project's own
// commits since it last synced. It read as plausible, it grew the harder the
// project was worked, and nothing contradicted it. A sentence in a comment
// would not have caught its return; this does.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'check-fleet.mjs');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });

/** A repo with `n` commits, an origin, and optionally a .kit-sync. */
function repo(dir, { origin, commits, kitSync = null }) {
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  git(dir, 'remote', 'add', 'origin', origin);
  const shas = [];
  for (let i = 0; i < commits; i++) {
    writeFileSync(join(dir, `f${i}.txt`), String(i));
    if (i === 0 && kitSync) writeFileSync(join(dir, '.kit-sync'), JSON.stringify({ sha: 'PLACEHOLDER' }));
    git(dir, 'add', '-A');
    git(dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', `c${i}`);
    shas.push(git(dir, 'rev-parse', 'HEAD').trim());
  }
  return shas;
}

function fleet() {
  const ws = mkdtempSync(join(tmpdir(), 'fleet-'));
  // The template: three commits, and the project synced at the first, so the
  // only true answer is "2 behind" whatever repo the scan is started from.
  const tpl = repo(join(ws, 'template'), {
    origin: 'https://github.com/pyduan/agentic-organization.git',
    commits: 3,
  });
  const proj = join(ws, 'proj');
  repo(proj, { origin: 'https://github.com/someone/proj.git', commits: 6, kitSync: true });
  writeFileSync(join(proj, '.kit-sync'), JSON.stringify({ sha: tpl[0] }));
  // The project needs the template's commits present to be *able* to get it wrong
  // the old way; fetching them is what a real instance's `template` remote does.
  git(proj, 'remote', 'add', 'template', join(ws, 'template'));
  git(proj, 'fetch', '-q', 'template');
  git(proj, 'add', '-A');
  git(proj, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'sync');
  return { ws, proj, tplDir: join(ws, 'template') };
}

const scan = (cwd, ws) =>
  execFileSync('node', [SCRIPT, '--offline', `--workspace=${ws}`], { cwd, encoding: 'utf8' });

test('the behind count is the same wherever the scan is started from', () => {
  const { ws, proj, tplDir } = fleet();
  try {
    const fromTemplate = scan(tplDir, ws);
    const fromProject = scan(proj, ws);
    assert.match(fromTemplate, /2 template commit\(s\) behind/,
      'run from the template, the project is 2 kit commits behind');
    assert.match(fromProject, /2 template commit\(s\) behind/,
      'run from the project, it must be the same 2 — not the project’s own commits');
    assert.doesNotMatch(fromProject, /7 template commit\(s\) behind/,
      'the old bug counted the caller’s history and reported its own commits');
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('with no template clone, it falls back to the instance’s own template ref', () => {
  // The common case, and the one that matters: a machine running an instance
  // almost never has a clone of the template beside it. The instance's own
  // `template/main` — what kit-sync and kit-news already keep fetched — answers
  // the same question, so the owner who most needs the figure still gets it.
  const { ws, proj } = fleet();
  try {
    const lonely = mkdtempSync(join(tmpdir(), 'lonely-'));
    // The project, alone, with no template repo anywhere in the scanned folder.
    execFileSync('cp', ['-R', proj, join(lonely, 'proj')]);
    const out = scan(join(lonely, 'proj'), lonely);
    assert.match(out, /No clone of the template on this machine/);
    assert.match(out, /2 template commit\(s\) behind/, 'the template remote still answers it');
    rmSync(lonely, { recursive: true, force: true });
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('with neither a clone nor a template remote, it prints no figure at all', () => {
  const lonely = mkdtempSync(join(tmpdir(), 'lonely-'));
  try {
    const only = join(lonely, 'only');
    repo(only, { origin: 'https://github.com/someone/only.git', commits: 2, kitSync: true });
    writeFileSync(join(only, '.kit-sync'), JSON.stringify({ sha: '0'.repeat(40) }));
    const out = scan(only, lonely);
    assert.match(out, /nothing to compare against/);
    assert.doesNotMatch(out, /\d+ template commit\(s\) behind/,
      'no number is better than a number nothing grounds');
  } finally { rmSync(lonely, { recursive: true, force: true }); }
});

test('a stale checkout is flagged before any verdict drawn from it', () => {
  const { ws, proj, tplDir } = fleet();
  try {
    // Give the project an origin that is ahead of it, the shape that made a
    // healthy repo look unwired: the clone was 118 commits old and said so nowhere.
    const bare = join(ws, 'proj-origin.git');
    execFileSync('git', ['clone', '--bare', '-q', proj, bare]);
    git(proj, 'remote', 'set-url', 'origin', bare);
    const other = join(ws, 'other');
    execFileSync('git', ['clone', '-q', bare, other]);
    writeFileSync(join(other, 'new.txt'), 'later work');
    git(other, 'add', '-A');
    git(other, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'pushed since');
    git(other, 'push', '-q', 'origin', 'HEAD');
    git(proj, 'fetch', '-q', 'origin');

    const out = scan(tplDir, ws);
    assert.match(out, /this clone is 1 commit\(s\) behind its own origin/);
    assert.match(out, /describes the copy on this disk/);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});
