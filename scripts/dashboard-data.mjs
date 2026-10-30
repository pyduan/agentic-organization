#!/usr/bin/env node
// Build the intranet (the private dashboard grown into the organization's home page): gather every
// project across the workspace into one small JSON file, then render apps/dashboard/dist/, the only
// folder the host sees: a home page with the banner from source/content/intranet-home.md, the
// dashboards and the tools from source/content/intranet-tools.md, and a page per project. The
// pages themselves are apps/dashboard/intranet.mjs.
//
// Why it aggregates rather than linking: the owner opens one door and wants to know
// where things stand by SUBJECT. Which repo a project happens to live in is plumbing,
// and organizing the home page by repo is a mistake people actually make — it shows
// the technical split instead of the mental one.
//
// What it reads, per repo on ORGANIGRAM.md's map (plus this one):
//   projects/<slug>/charter.md     the title, the stage, an optional "dashboard:" line
//   projects/<slug>/next-steps.md  open (- [ ]) and done (- [x]) items, in the
//                                  canonical format of source/formats/todo.md
//   projects/<slug>/log.md         dated entries, newest first, for the recap feed
//
// A project that should not expose its wording writes `dashboard: counts-only` in its
// charter: it then appears with its stage and its counts, and no titles travel.
//
// Another repo is read within what it declares in its `.read-consent` (lib/neighbour.mjs):
// at `counts` it appears as one line, its counts summed and no project named; at `none`
// it is not opened, and the page says it keeps to itself.
//
// Zero dependencies, Node built-ins only.
//
// Usage:  node scripts/dashboard-data.mjs [--out=apps/dashboard/dist]   (npm run intranet)

import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { renderIntranet, parseHome, parseTools } from '../apps/dashboard/intranet.mjs';
import { parse as parseTodos } from '../lib/todo.mjs';
import { locatedRepos } from '../lib/workspace.mjs';
import { neighbour } from '../lib/neighbour.mjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const OUT = resolve((args.find((a) => a.startsWith('--out=')) || '').slice(6) || 'apps/dashboard/dist');
const read = async (p) => { try { return await readFile(p, 'utf8'); } catch { return ''; } };

// ---------------------------------------------------------------- the workspace

// ORGANIGRAM.md is the one list of repos (see ORGANIGRAM.md ▸ One map), and
// lib/workspace.mjs finds each one on this machine by its origin. We read it here
// rather than keeping a second list, so this cannot describe a stale workspace.
async function repos() {
  const out = [{ slug: basename(ROOT), dir: ROOT, self: true }];
  const { rows } = await locatedRepos(ROOT);
  for (const r of rows) {
    if (!r.slug || !r.dir || r.dir === ROOT || r.isSelf) continue;
    out.push({ slug: r.slug, dir: r.dir, self: false });
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
  // Parsing lives in lib/todo.mjs so the dashboard, the to-do app and any agent
  // read a line the same way. Metadata is stripped out of the title here: an
  // owner and a due date are fields to render, not words to print in a sentence.
  const open = [], done = [];
  for (const i of parseTodos(nextSteps)) {
    const item = {
      text: i.text,
      owners: i.owners,
      due: i.due,
      id: i.id,
      tags: i.tags,
      note: i.notes[0] || null,
    };
    if (i.done) done.push({ ...item, doneOn: i.doneOn });
    else open.push(item);
  }
  // Nearest due date first; everything undated keeps its file order behind them,
  // which is the order the owner arranged by hand.
  open.sort((a, b) => (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99'));
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

// Another repo at `counts` shows as one line: how many projects, items open and done.
// Its project names are its own wording, so they stay with it too.
function countedRepo(repo, n) {
  const each = n.measureEach('projects', 'next-steps.md', (md) => {
    const { open, done } = items(md);
    return { open: open.length, done: done.length };
  });
  return {
    slug: null,
    title: repo.slug,
    stage: null,
    repo: repo.slug,
    countsOnly: true,
    consent: 'counts',
    counts: {
      projects: each.length,
      open: each.reduce((t, c) => t + c.open, 0),
      done: each.reduce((t, c) => t + c.done, 0),
    },
    open: [],
    latest: [],
  };
}

async function projectsIn(repo) {
  // This repo reads itself freely; any other is read through what it declares.
  let folders = async () => {
    try { return (await readdir(join(repo.dir, 'projects'), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name); }
    catch { return []; }
  };
  let text = (rel) => read(join(repo.dir, rel));
  if (!repo.self) {
    const n = neighbour(repo.dir);
    repo.consent = n.level;
    repo.consentProblem = n.problem;
    if (n.level === 'none') return [];
    if (n.level === 'counts') return [countedRepo(repo, n)];
    folders = async () => n.folders('projects');
    text = async (rel) => n.text(rel);
  }
  const out = [];
  for (const name of await folders()) {
    const charter = await text(`projects/${name}/charter.md`);
    const countsOnly = /^\s*dashboard:\s*counts-only\s*$/im.test(charter);
    const { open, done } = items(await text(`projects/${name}/next-steps.md`));
    const log = entries(await text(`projects/${name}/log.md`));
    out.push({
      slug: name,
      title: firstHeading(charter, name),
      stage: stageOf(charter),
      repo: repo.self ? null : repo.slug,
      countsOnly,
      counts: { open: open.length, done: done.length },
      open: countsOnly ? [] : open,
      latest: countsOnly ? [] : log.slice(0, 3),
      log: countsOnly ? [] : log.slice(0, 20),
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

// Each project with wording gets a page. Its address carries the repo when it is not this one, so
// two repos may each hold a `projects/site` without one page overwriting the other.
const used = new Set();
for (const p of projects) {
  if (!p.slug) continue;
  let key = p.repo ? `${p.repo}-${p.slug}` : p.slug;
  while (used.has(key)) key += '-2';
  used.add(key);
  p.page = `projects/${key}/`;
}

const recap = projects
  .flatMap((p) => p.latest.map((e) => ({ ...e, project: p.title, slug: p.slug, page: p.page })))
  .sort((a, b) => (a.date < b.date ? 1 : -1))
  .slice(0, 12);

const data = {
  // Counted at render time, never written by hand: a number spelled out in prose goes
  // stale without anyone touching it (docs/failure-modes.md ▸ Silent expiry).
  generated: new Date().toISOString(),
  org: orgName,
  repos: found.map((r) => r.slug),
  // The repos that keep to themselves, named by the map rather than by anything read in them.
  private: found.filter((r) => r.consent === 'none').map((r) => r.slug),
  projects,
  recap,
};

// The owner's words: the banner and the tools. They live in source/content/ so that changing the
// welcome text is editing a file, never the app; a missing file means no banner, or no tools.
const home = parseHome(await read(join(ROOT, 'source', 'content', 'intranet-home.md')));
const tools = parseTools(await read(join(ROOT, 'source', 'content', 'intranet-tools.md')));
const css = await readFile(fileURLToPath(new URL('../apps/dashboard/intranet.css', import.meta.url)), 'utf8');

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'data.json'), JSON.stringify(data, null, 2));
for (const [rel, text] of Object.entries(renderIntranet({ data, home, tools, css }))) {
  await mkdir(dirname(join(OUT, rel)), { recursive: true });
  await writeFile(join(OUT, rel), text);
}
const tokens = join(ROOT, 'source', 'brand', 'tokens.css');
if (existsSync(tokens)) await copyFile(tokens, join(OUT, 'tokens.css'));
// The packs catalogue is a page of its own (npm run packs); the intranet serves it at packs/.
const packs = join(ROOT, 'apps', 'packs', 'index.html');
if (existsSync(packs)) { await mkdir(join(OUT, 'packs'), { recursive: true }); await copyFile(packs, join(OUT, 'packs', 'index.html')); }

const totalOpen = projects.reduce((n, p) => n + p.counts.open, 0);
console.log(`intranet: ${home ? 'banner' : 'no banner'}, ${tools.length} tool(s), ${projects.length} project(s) from ${found.length} repo(s), ${totalOpen} open item(s) → ${OUT.replace(ROOT + '/', '')}`);
for (const r of found.filter((x) => x.consent && x.consent !== 'full')) {
  console.log(`  ${r.slug}: ${r.consent === 'none' ? 'declares none, not read' : 'declares counts, summed without names'}${r.consentProblem ? ` (${r.consentProblem})` : ''}`);
}
