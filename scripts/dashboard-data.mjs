#!/usr/bin/env node
// Build the private dashboard: gather every project across the workspace into one
// small JSON file, then assemble apps/dashboard/dist/ (the only folder the host sees).
//
// Why it aggregates rather than linking: the owner opens one door and wants to know
// where things stand by SUBJECT. Which repo a project happens to live in is plumbing,
// and organizing the home page by repo is a mistake people actually make — it shows
// the technical split instead of the mental one.
//
// What it reads, per repo on ORGANIGRAM.md's map (plus this one):
//   projects/<slug>/charter.md     the title, the stage, an optional "dashboard:" line
//   projects/<slug>/next-steps.md  open (- [ ]) and done (- [x]) items
//   projects/<slug>/log.md         dated entries, newest first, for the recap feed
//
// A project that should not expose its wording writes `dashboard: counts-only` in its
// charter: it then appears with its stage and its counts, and no titles travel.
//
// Zero dependencies, Node built-ins only.
//
// Usage:  node scripts/dashboard-data.mjs [--out=apps/dashboard/dist]

import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const OUT = resolve((args.find((a) => a.startsWith('--out=')) || '').slice(6) || 'apps/dashboard/dist');
const expand = (p) => resolve(p.replace(/^~/, homedir()));
const read = async (p) => { try { return await readFile(p, 'utf8'); } catch { return ''; } };

// ---------------------------------------------------------------- the workspace

// ORGANIGRAM.md is the one list of repos (see ORGANIGRAM.md ▸ One map). We read it
// here rather than keeping a second list, so this cannot describe a stale workspace.
async function repos() {
  const out = [{ slug: basename(ROOT), dir: ROOT, self: true }];
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
    if (!slug || !folder) continue;
    const dir = expand(folder);
    if (existsSync(dir)) out.push({ slug, dir, self: false });
  }
  return out;
}

// ---------------------------------------------------------------- one project

const firstHeading = (md, fallback) => (md.match(/^#\s+(.+)$/m) || [, fallback])[1].trim();
const STAGES = ['idea', 'exploring', 'active', 'winding down', 'done'];

function stageOf(charter) {
  const line = charter.split('\n').find((l) => /stage/i.test(l) && STAGES.some((s) => l.toLowerCase().includes(s)));
  if (!line) return null;
  // Take the last stage word on the line: "Stage: exploring → active" means active.
  return STAGES.filter((s) => line.toLowerCase().includes(s)).pop();
}

function items(nextSteps) {
  const open = [], done = [];
  for (const line of nextSteps.split('\n')) {
    const m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*\S)/);
    if (!m) continue;
    (m[1] === ' ' ? open : done).push(m[2].replace(/\s+/g, ' ').trim());
  }
  return { open, done };
}

function entries(log) {
  // A dated line or heading starts an entry: "## 2026-08-23 — ..." or "- 2026-08-23: ...".
  const out = [];
  for (const line of log.split('\n')) {
    const m = line.match(/(\d{4}-\d{2}-\d{2})\s*[—:–-]?\s*(.*\S)?/);
    if (!m) continue;
    const text = (m[2] || '').replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim();
    if (text) out.push({ date: m[1], text });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

async function projectsIn(repo) {
  const base = join(repo.dir, 'projects');
  let dirs = [];
  try { dirs = (await readdir(base, { withFileTypes: true })).filter((e) => e.isDirectory()); } catch { return []; }
  const out = [];
  for (const d of dirs) {
    const dir = join(base, d.name);
    const charter = await read(join(dir, 'charter.md'));
    const countsOnly = /^\s*dashboard:\s*counts-only\s*$/im.test(charter);
    const { open, done } = items(await read(join(dir, 'next-steps.md')));
    const log = entries(await read(join(dir, 'log.md')));
    out.push({
      slug: d.name,
      title: firstHeading(charter, d.name),
      stage: stageOf(charter),
      repo: repo.self ? null : repo.slug,
      countsOnly,
      counts: { open: open.length, done: done.length },
      open: countsOnly ? [] : open.slice(0, 12),
      latest: countsOnly ? [] : log.slice(0, 3),
    });
  }
  return out;
}

// ---------------------------------------------------------------- assemble

const found = await repos();
const projects = (await Promise.all(found.map(projectsIn))).flat();

const brief = await read(join(ROOT, 'source', 'brief.md'));
const orgName = firstHeading(brief, basename(ROOT)).replace(/^(brief|project brief)\b[\s—:-]*/i, '') || basename(ROOT);

const order = (p) => STAGES.indexOf(p.stage ?? 'idea');
projects.sort((a, b) => order(b) - order(a) || b.counts.open - a.counts.open);

const recap = projects
  .flatMap((p) => p.latest.map((e) => ({ ...e, project: p.title, slug: p.slug })))
  .sort((a, b) => (a.date < b.date ? 1 : -1))
  .slice(0, 12);

const data = {
  // Counted at render time, never written by hand: a number spelled out in prose goes
  // stale without anyone touching it (docs/failure-modes.md ▸ Silent expiry).
  generated: new Date().toISOString(),
  org: orgName,
  repos: found.map((r) => r.slug),
  projects,
  recap,
};

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'data.json'), JSON.stringify(data, null, 2));
await copyFile(join(ROOT, 'apps', 'dashboard', 'index.html'), join(OUT, 'index.html'));
const tokens = join(ROOT, 'source', 'brand', 'tokens.css');
if (existsSync(tokens)) await copyFile(tokens, join(OUT, 'tokens.css'));

const totalOpen = projects.reduce((n, p) => n + p.counts.open, 0);
console.log(`dashboard: ${projects.length} project(s) from ${found.length} repo(s), ${totalOpen} open item(s) → ${OUT.replace(ROOT + '/', '')}`);
