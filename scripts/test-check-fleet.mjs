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

// ---------------------------------------------------------------- router vs satellite
//
// The second bug worth a permanent guard. The kit tells an owner whose organization
// outgrew one repo to build a router plus thin repos, then this scan counted every
// thin repo as a broken instance and told her to install the framework eleven times.
// She refused, correctly. What must not come back is the scan demanding of a
// satellite what only a router can have — and, symmetrically, the scan going quiet
// about a repo the owner has declared a router.

/** A thin repo: its CLAUDE.md points at the router, and it carries none of the method. */
function satellite(dir, { origin, method = false }) {
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  git(dir, 'remote', 'add', 'origin', origin);
  writeFileSync(join(dir, 'CLAUDE.md'),
    'This repo belongs to an organization whose router holds the agentic-organization framework.');
  if (method) mkdirSync(join(dir, 'source/formats'), { recursive: true });
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'thin');
  return dir;
}

const mapWithKinds = (dir, table) =>
  writeFileSync(join(dir, 'ORGANIGRAM.md'),
    ['# Organigram', '', '| Repo | Local folder | Kind | What it holds |', '|---|---|---|---|', ...table, ''].join('\n'));

test('a satellite is listed, never counted as an instance and never alarmed', () => {
  const { ws, tplDir } = fleet();
  try {
    satellite(join(ws, 'members'), { origin: 'https://github.com/someone/members.git' });
    const out = scan(tplDir, ws);
    assert.match(out, /1 instance\(s\) and 1 satellite\(s\)/,
      'the satellite is reported, and reported apart from the instances');
    assert.match(out, /SATELLITES/);
    assert.doesNotMatch(out, /members[\s\S]*?NOT WIRED/,
      'a repo carrying no framework cannot be wired to announce one');
    // The summary alarm, not the per-instance line, which uses the same words.
    const alarm = out.slice(out.indexOf('will never announce an update to their own owner'));
    assert.ok(!alarm.includes('members'),
      'an alarm nobody can clear without breaking the architecture is one that stops being read');
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('the map is believed over the derivation', () => {
  const { ws, tplDir } = fleet();
  try {
    satellite(join(ws, 'members'), { origin: 'https://github.com/someone/members.git' });
    // The owner says this one really is a full instance. Deriving would have let it
    // off every requirement, which is the dangerous direction of this change.
    mapWithKinds(tplDir, ['| `someone/members` | `members` | `router` | a real instance |']);
    const out = scan(tplDir, ws);
    assert.match(out, /2 instance\(s\)/);
    assert.doesNotMatch(out, /SATELLITES/);
    assert.match(out, /members[\s\S]*?NOT WIRED/,
      'declared a router, so held to what a router must have');
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('a satellite that copies the router is a finding', () => {
  const { ws, tplDir } = fleet();
  try {
    satellite(join(ws, 'members'), { origin: 'https://github.com/someone/members.git', method: true });
    mapWithKinds(tplDir, ['| `someone/members` | `members` | `satellite` | thin, but carrying a copy |']);
    const out = scan(tplDir, ws);
    assert.match(out, /carries a copy of the router/);
    assert.match(out, /rule 3/);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('the unwired alert states its own exception and prescribes no bulk action', () => {
  const { ws, tplDir } = fleet();
  try {
    const out = scan(tplDir, ws);
    const i = out.indexOf('will never announce an update to their owner');
    assert.ok(i > -1, 'the finding is still reported');
    const block = out.slice(i);
    // The six words a session obeyed at 01:07, on ten repos that must not carry the kit.
    assert.doesNotMatch(block, /Run the update-kit skill in each/,
      'an alert that prescribes its own remedy gets that remedy, including when it is wrong');
    assert.match(block, /applies ONLY to a repo that is meant to carry the framework/);
    assert.match(block, /ask the owner rather than/);
    assert.match(block, /Never run it across several repos in one pass/);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('a linked worktree is not a second instance', () => {
  const { ws, proj, tplDir } = fleet();
  try {
    // A worktree's `.git` is a FILE holding a gitdir: pointer. An owner's scan
    // counted three of them as satellites, inflating the fleet with rows that can
    // never have a line in the map.
    git(proj, 'worktree', 'add', '-q', '-b', 'side', join(ws, 'proj-side'));
    const out = scan(tplDir, ws);
    assert.doesNotMatch(out, /── proj-side/, 'a worktree of a listed repo is not its own instance');
    assert.match(out, /── proj\b/, 'the repo itself is still there');
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('standalone is a kind: it carries the framework but is not this org’s router', () => {
  const { ws, tplDir } = fleet();
  try {
    // The shape the kit ships for, and the one the two-kind version could not say:
    // an instance shared with people outside this organization, which must be
    // neither treated as the router nor stripped like a satellite.
    const shared = join(ws, 'shared');
    repo(shared, { origin: 'https://github.com/someone/shared.git', commits: 2, kitSync: true });
    mapWithKinds(tplDir, [
      '| `someone/proj` | `proj` | `router` | the org repo |',
      '| `someone/shared` | `shared` | `standalone` | follows the kit on its own, shared with others |',
    ]);
    const out = scan(tplDir, ws);
    assert.match(out, /2 instance\(s\)/, 'held to the same requirements as a router');
    assert.doesNotMatch(out, /SATELLITES[\s\S]*shared/, 'never stripped like a satellite');
    assert.match(out, /shared\s+standalone instance, not this organization/,
      'and labelled, so no session mistakes it for the router');
  } finally { rmSync(ws, { recursive: true, force: true }); }
});
