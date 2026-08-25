#!/usr/bin/env node
// Derive the to-dos app's source list from ORGANIGRAM.md, the one map.
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
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/todos/sources.json');
const expand = (p) => resolve(p.replace(/^~/, homedir()));
const read = async (p) => { try { return await readFile(p, 'utf8'); } catch { return ''; } };

/** Rows of ORGANIGRAM.md's repo table, plus this repo. Same parse as the dashboard. */
async function repos() {
  const out = [{ slug: basename(ROOT), dir: ROOT }];
  const map = await read(join(ROOT, 'ORGANIGRAM.md'));
  let inTable = false;
  for (const line of map.split('\n')) {
    if (/^\|\s*Repo\s*\|/i.test(line)) { inTable = true; continue; }
    if (inTable && !line.startsWith('|')) break;
    if (!inTable || /^\|\s*-+/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2 || /add a row|<owner>|<repo>|<other>/i.test(cells[0] + cells[1])) continue;
    if (/this one/i.test(cells[0])) continue;
    const slug = ([...cells[0].matchAll(/`([^`]+)`/g)][0] || [])[1];
    const folder = ([...cells[1].matchAll(/`([^`]+)`/g)][0] || [])[1];
    if (slug && folder && existsSync(expand(folder))) out.push({ slug, dir: expand(folder) });
  }
  return out;
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
    found.push({ id: repo.slug, label: titleCase(repo.slug), repo: gh, path: 'next-steps.md', branch });
  }

  let dirs = [];
  try { dirs = (await readdir(join(repo.dir, 'projects'), { withFileTypes: true })).filter((e) => e.isDirectory()); } catch {}
  for (const d of dirs) {
    if (d.name.startsWith('_')) continue; // _template, _unclaimed and friends are not projects
    const path = `projects/${d.name}/next-steps.md`;
    if (!existsSync(join(repo.dir, path))) continue;
    // The label names the project. Which repo it lives in is plumbing, and the
    // slug is only prefixed when two repos genuinely use the same project name.
    found.push({ id: `${repo.slug}-${d.name}`, label: titleCase(d.name), repo: gh, path, branch });
  }
  return { found };
}

const list = await repos();
const all = [], skipped = [];
for (const repo of list) {
  const { found, skipped: s, reason } = await sourcesIn(repo);
  if (s) { skipped.push(`${s} (${reason})`); continue; }
  all.push(...found);
}

// Two projects may share a name across repos; only then does the label need the repo.
const byLabel = new Map();
for (const s of all) byLabel.set(s.label, (byLabel.get(s.label) || 0) + 1);
for (const s of all) if (byLabel.get(s.label) > 1) s.label = `${s.label} · ${s.repo.split('/')[1]}`;

await writeFile(OUT, `${JSON.stringify(all, null, 2)}\n`);
console.log(`todo sources: ${all.length} project(s) across ${list.length} repo(s) → apps/todos/sources.json`);
for (const s of all) console.log(`  ${s.label.padEnd(24)} ${s.repo}/${s.path}`);
if (skipped.length) console.log(`skipped: ${skipped.join(', ')}`);
