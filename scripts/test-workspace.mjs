// The repo map and where each repo sits, tested on throwaway workspaces.
//
// The fault this pins: the map carried a per-machine path, and on a repo shared
// by several people every tool told a collaborator that a repo he worked in daily
// was "listed but not cloned here", because he kept it under another folder name.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMap, slugOf, sameSlug } from '../lib/workspace.mjs';

const CHECK = resolve(dirname(fileURLToPath(import.meta.url)), 'check-workspace.mjs');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: 'pipe' });

function repo(dir, origin, files = {}) {
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  if (origin) git(dir, 'remote', 'add', 'origin', origin);
  for (const [f, t] of Object.entries(files)) { mkdirSync(dirname(join(dir, f)), { recursive: true }); writeFileSync(join(dir, f), t); }
  return dir;
}
const map = (rows, header = '| Repo | Kind | What it holds |') =>
  ['# Organigram', '', header, '|---|---|---|', ...rows, ''].join('\n');

function workspace() {
  const ws = mkdtempSync(join(tmpdir(), 'ws-'));
  const env = { ...process.env, KIT_WORKSPACE_MAP: join(ws, 'machine.json') };
  return { ws, env };
}
const check = (cwd, env, ...extra) => spawnSync('node', [CHECK, '--offline', ...extra], { cwd, env, encoding: 'utf8' });

test('a repo is found by its origin, whatever folder the map names', () => {
  const { ws, env } = workspace();
  try {
    const org = repo(join(ws, 'org'), 'https://github.com/acme/org.git', {
      'ORGANIGRAM.md': map(['| `acme/org` **(this one)** | `router` | x |', '| `acme/shop` | `/somebody/else/shop` | y |'],
        '| Repo | Local folder | Kind |'),
    });
    repo(join(ws, 'Shop-Renamed'), 'git@github.com:acme/shop.git');
    const r = check(org, env);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /not on this machine/);
    assert.match(r.stdout, /found at .*Shop-Renamed by its origin/);
    assert.match(r.stdout, /2 repo\(s\) on the map, 2 found on this machine/);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('a layout nothing could guess is recorded once per machine, outside every repo', () => {
  const { ws, env } = workspace();
  try {
    const org = repo(join(ws, 'org'), 'https://github.com/acme/org.git', {
      'ORGANIGRAM.md': map(['| `acme/org` **(this one)** | `router` | x |', '| `acme/vault` | `satellite` | y |']),
    });
    const far = repo(join(ws, 'deep', 'er', 'vault'), 'https://github.com/acme/vault.git');
    assert.match(check(org, env).stdout, /acme\/vault[\s\S]*not on this machine/);
    const rec = check(org, env, `--at=acme/vault=${far}`);
    assert.equal(rec.status, 0, rec.stderr);
    assert.ok(JSON.parse(readFileSync(env.KIT_WORKSPACE_MAP, 'utf8')).repos['acme/vault'].endsWith('vault'));
    assert.match(check(org, env).stdout, /2 found on this machine/);
    // A path whose origin is not the slug is refused, never recorded.
    const wrong = check(org, env, `--at=acme/vault=${org}`);
    assert.equal(wrong.status, 1);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('a kit project of another organization beside this one is mentioned, not alarmed', () => {
  const { ws, env } = workspace();
  try {
    const org = repo(join(ws, 'org'), 'https://github.com/acme/org.git', {
      'ORGANIGRAM.md': map(['| `acme/org` **(this one)** | `router` | x |']),
    });
    const kit = { 'source/brief.md': 'b', 'CLAUDE.md': 'A project of another organization entirely.' };
    repo(join(ws, 'neighbour'), 'https://github.com/other/neighbour.git', kit);
    repo(join(ws, 'member'), 'https://github.com/acme/member.git',
      { ...kit, 'CLAUDE.md': '## Where this repo sits\nThe shared guides live in org.' });
    const out = check(org, env).stdout;
    assert.match(out, /· neighbour/);
    assert.match(out, /▲ member[\s\S]*points at org/);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('the map reads the same with or without the legacy folder column', async () => {
  const { ws } = workspace();
  try {
    writeFileSync(join(ws, 'ORGANIGRAM.md'), map(['| `a/b` | `~/x/b` | `satellite` |'], '| Repo | Local folder | Kind |'));
    const legacy = (await readMap(ws)).rows[0];
    writeFileSync(join(ws, 'ORGANIGRAM.md'), map(['| `a/b` | `satellite` | z |']));
    const current = (await readMap(ws)).rows[0];
    assert.equal(legacy.slug, 'a/b');
    assert.equal(current.slug, 'a/b');
    assert.equal(legacy.kind, 'satellite');
    assert.equal(current.kind, 'satellite');
    assert.equal(legacy.folder, '~/x/b');
    assert.equal(current.folder, null);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test('slugs compare exactly', () => {
  assert.equal(slugOf('git@github.com:pyduan/agentic-organization.git'), 'pyduan/agentic-organization');
  assert.equal(slugOf('https://github.com/pyduan/agentic-organization-pro'), 'pyduan/agentic-organization-pro');
  assert.ok(sameSlug('Acme/Shop', 'acme/shop'));
  assert.ok(!sameSlug('pyduan/agentic-organization', 'pyduan/agentic-organization-pro'));
});
