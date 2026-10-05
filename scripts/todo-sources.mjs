#!/usr/bin/env node
// Derive the to-dos app's source list from ORGANIGRAM.md, the one map.
//
// Each entry also carries `dir`, the local checkout, which only the dev server
// uses: it lets local development span the same repos as production instead of
// being a special case with its own configuration.
//
// Why derive rather than configure: the kit keeps exactly one list of repos
// (ORGANIGRAM.md ▸ One map), because the moment the same topology is written in
// two places one of them starts describing last month. The to-dos app needs to
// know which repos hold which projects — that is the same question the map
// already answers, so it is answered there and generated from here.
//
// It also absorbs the topologies people actually have. One repo with several
// projects, several repos each holding one, an annex repo alongside a common
// one: all of them are just rows on the map plus the projects/ convention.
//
//   node scripts/todo-sources.mjs   → apps/todos/sources.json
//
// Zero dependencies. Run it before deploying the app.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { locatedRepos } from '../lib/workspace.mjs';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/todos/sources.json');
const read = async (p) => { try { return await readFile(p, 'utf8'); } catch { return ''; } };

/** Rows of ORGANIGRAM.md's repo table, located on this machine (lib/workspace.mjs), plus this repo. */
async function repos() {
  const out = [{ slug: basename(ROOT), dir: ROOT }];
  const { map, rows } = await locatedRepos(ROOT);
  if (!map.exists) return { repos: out, rows: 0, skipped: [{ why: 'ORGANIGRAM.md is missing or unreadable' }] };
  const skipped = [];
  const others = rows.filter((r) => r.dir !== ROOT && !r.isSelf);
  for (const r of others) {
    // Say precisely which expectation a row failed: silently skipping it reads as
    // "there is nothing here", which is the wrong lesson.
    if (!r.slug) { skipped.push({ label: r.label, why: 'no `owner/repo` in backticks in column 1' }); continue; }
    if (!r.dir) { skipped.push({ label: r.slug, why: 'not found on this machine (beside this repo, or in the per-machine workspace file)' }); continue; }
    out.push({ slug: r.slug, dir: r.dir });
  }
  return { repos: out, rows: others.length, skipped };
}

/** owner/repo as GitHub knows it — the app writes through the API, not through a path. */
async function ghSlug(dir) {
  try {
    const { stdout } = await run('git', ['-C', dir, 'remote', 'get-url', 'origin']);
    const m = stdout.trim().match(/github\.com[:/]([^/]+\/[^/.]+)/);
    return m ? m[1] : null;
  } catch { return null; }
}

async function branchOf(dir) {
  try {
    const { stdout } = await run('git', ['-C', dir, 'symbolic-ref', '--short', 'HEAD']);
    return stdout.trim() || 'main';
  } catch { return 'main'; }
}

const titleCase = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

async function sourcesIn(repo) {
  const gh = await ghSlug(repo.dir);
  if (!gh) return { skipped: repo.slug, reason: 'no GitHub origin' };
  const branch = await branchOf(repo.dir);
  const found = [];

  // A list at the root is the person's own, not a project's.
  if (existsSync(join(repo.dir, 'next-steps.md'))) {
    found.push({ id: repo.slug, label: titleCase(repo.slug), repo: gh, path: 'next-steps.md', branch, dir: repo.dir });
  }

  let dirs = [];
  try { dirs = (await readdir(join(repo.dir, 'projects'), { withFileTypes: true })).filter((e) => e.isDirectory()); } catch {}
  for (const d of dirs) {
    if (d.name.startsWith('_')) continue; // _template, _unclaimed and friends are not projects
    const path = `projects/${d.name}/next-steps.md`;
    if (!existsSync(join(repo.dir, path))) continue;
    // The label names the project. Which repo it lives in is plumbing, and the
    // slug is only prefixed when two repos genuinely use the same project name.
    found.push({ id: `${repo.slug}-${d.name}`, label: titleCase(d.name), repo: gh, path, branch, dir: repo.dir });
  }
  return { found };
}

const { repos: list, rows, skipped: unreadable } = await repos();
const all = [], noRemote = [];
for (const repo of list) {
  const { found, skipped: s, reason } = await sourcesIn(repo);
  if (s) { noRemote.push(`${s} (${reason})`); continue; }
  all.push(...found);
}

// Two projects may share a name across repos; only then does the label need the repo.
const byLabel = new Map();
for (const s of all) byLabel.set(s.label, (byLabel.get(s.label) || 0) + 1);
for (const s of all) if (byLabel.get(s.label) > 1) s.label = `${s.label} · ${s.repo.split('/')[1]}`;

await writeFile(OUT, `${JSON.stringify(all, null, 2)}\n`);
console.log(`todo sources: ${all.length} project(s) across ${list.length} repo(s) → apps/todos/sources.json`);
for (const s of all) console.log(`  ${s.label.padEnd(24)} ${s.repo}/${s.path}`);
if (noRemote.length) console.log(`no GitHub origin: ${noRemote.join(', ')}`);

// A bare zero is the failure this script is most likely to produce and the least
// likely to be understood: it reads as "there is nothing to find" when it usually
// means "I could not read your map".
if (!all.length) {
  console.log('');
  console.log('Nothing was found. That is almost never because there is nothing.');
  if (unreadable.length) {
    console.log(`ORGANIGRAM.md: ${rows} row(s) read, none usable:`);
    for (const s of unreadable) console.log(`  - ${s.label ? s.label + ': ' : ''}${s.why}`);
    console.log('');
    console.log('The table wants `owner/repo` in backticks in column 1, and each repo cloned beside');
    console.log('this one (or recorded with `node scripts/check-workspace.mjs --at=<owner/repo>=<path>`).');
    console.log('Fix the map rather than this script: the map is what every tool reads.');
  } else if (!rows) {
    console.log("ORGANIGRAM.md's repo table has no rows yet beyond the template placeholders.");
  } else {
    console.log(`${rows} repo(s) read from the map, but none of them holds a next-steps.md`);
    console.log('at the root or under projects/<slug>/. That is a real empty, not a parsing failure.');
  }
  process.exitCode = 1;
}
