// The repo map, and where each repo on it sits on this machine.
//
// ORGANIGRAM.md's repo table is the one list of repos an organization spans. Four
// scripts read it, and each carried its own parser, all of them taking a "Local
// folder" column as the truth about where a repo is. That column is a fact about
// one machine written into a file every machine shares: on a repo four people push
// to, the map said `~/projects/personal/x` while a collaborator had it at
// `~/Projects/X`, and every tool told him a repo he worked in daily was "listed but
// not cloned here" (reported 2026-09-15).
//
// So the map says WHICH repos, and this module finds WHERE, in this order:
//   1. this repo itself, when its origin is the slug;
//   2. the per-machine file (~/.config/agentic-organization/workspace.json), for a
//      layout nothing could guess;
//   3. the map's legacy folder column, but only if the folder there has that origin;
//   4. the repos beside this one, matched by their origin.
// Nothing is written into the shared map, and nothing is guessed from a name.
//
// Zero dependencies, Node built-ins only.

import { readFile, readdir } from 'node:fs/promises';
import { statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const TEMPLATE_SLUG = 'pyduan/agentic-organization';

export const expand = (p) => resolve(String(p).replace(/^~(?=$|\/)/, homedir()));

/** `owner/repo` out of any git URL or slug, or null. */
export const slugOf = (url) =>
  (url ? (String(url).trim().match(/(?:^|[:/])([^/:\s]+\/[^/\s]+?)(?:\.git)?\/?$/) || [])[1] || null : null);

/**
 * Two slugs name the same repo. Exact, case-insensitive. A substring test made
 * `pyduan/agentic-organization-pro` pass for the kit itself.
 */
export const sameSlug = (a, b) => Boolean(a && b) && a.toLowerCase() === b.toLowerCase();

export const isTemplateSlug = (slug) => sameSlug(slug, TEMPLATE_SLUG);

export async function gitOrigin(dir) {
  try { return (await run('git', ['-C', dir, 'remote', 'get-url', 'origin'])).stdout.trim() || null; }
  catch { return null; }
}
export const originSlug = async (dir) => slugOf(await gitOrigin(dir));

/**
 * A repo has `.git` as a DIRECTORY. A linked worktree or a submodule has a `.git`
 * FILE pointing elsewhere, and neither is a separate repo: counting them put rows
 * in a fleet report that could never have a line in the map.
 */
export const isRepoRoot = (dir) => {
  try { return statSync(join(dir, '.git')).isDirectory(); } catch { return false; }
};

// ------------------------------------------------------------------ the map

const PLACEHOLDER = /add a row|<owner>|<repo>|<other>/i;
const ticked = (c) => [...String(c || '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/**
 * Read the repo table out of ORGANIGRAM.md. Columns are found by their header, so
 * a map with or without the legacy folder column, or with columns reordered,
 * reads the same. The slug is the first backticked value in the first column.
 *
 * Returns { exists, header, rows } where each row is
 *   { slug, folder, kind, url, isSelf, isPlaceholder, label, cells }.
 * `folder` is the legacy per-machine hint, null when the column is absent.
 */
export async function readMap(root) {
  let text;
  try { text = await readFile(join(root, 'ORGANIGRAM.md'), 'utf8'); }
  catch { return { exists: false, header: null, rows: [] }; }
  const rows = [];
  let header = null;
  for (const line of text.split('\n')) {
    if (/^\|\s*Repo\s*\|/i.test(line)) {
      header = line.split('|').slice(1, -1).map((c) => c.trim().toLowerCase());
      continue;
    }
    if (header && !line.startsWith('|')) { if (rows.length) break; else continue; }
    if (!header || /^\|\s*:?-+/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (!cells.length) continue;
    const col = (...names) => header.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
    const iFolder = col('local folder', 'folder', 'local');
    const iKind = col('kind');
    const kindCell = iKind >= 0 ? cells[iKind] : '';
    const kind = (ticked(kindCell)[0] || kindCell || '').toLowerCase().trim() || null;
    rows.push({
      slug: ticked(cells[0])[0] || null,
      folder: iFolder >= 0 ? ticked(cells[iFolder])[0] || null : null,
      kind: ['router', 'satellite', 'standalone'].includes(kind) ? kind : null,
      url: (cells.join(' ').match(/https?:\/\/[^\s|)`]+/) || [])[0] || null,
      isSelf: /this one/i.test(cells[0]),
      isPlaceholder: PLACEHOLDER.test(cells.join(' ')),
      label: ticked(cells[0])[0] || cells[0].replace(/[*_]/g, '').slice(0, 40),
      cells,
    });
  }
  return { exists: true, header, rows };
}

// ------------------------------------------------------- the per-machine file

export const machineMapPath = () =>
  process.env.KIT_WORKSPACE_MAP
  || join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'agentic-organization', 'workspace.json');

/** { 'owner/repo' (lowercase): '/abs/path' }. Missing or unreadable is an empty map. */
export function readMachineMap() {
  try {
    const j = JSON.parse(readFileSync(machineMapPath(), 'utf8'));
    return Object.fromEntries(Object.entries(j.repos || {}).map(([k, v]) => [k.toLowerCase(), expand(v)]));
  } catch { return {}; }
}

/** Record where a repo sits on this machine. Lives outside every repo, by design. */
export function rememberRepo(slug, dir) {
  const path = machineMapPath();
  let j = { repos: {} };
  try { j = JSON.parse(readFileSync(path, 'utf8')); j.repos ||= {}; } catch { /* first entry */ }
  j.repos[slug] = expand(dir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(j, null, 2)}\n`);
  return path;
}

// -------------------------------------------------------- the repos beside us

/**
 * Repos among the direct children of `workspace`, and one level below a child that
 * is not itself a repo (repos grouped by owner). Never the workspace's parent: a
 * survey of your own repos must not walk into a neighbouring organization.
 * Returns [{ dir, slug }].
 */
export async function siblingRepos(workspace) {
  const out = [];
  const seen = new Set();
  const add = async (dir) => {
    if (seen.has(dir)) return;
    seen.add(dir);
    out.push({ dir, slug: await originSlug(dir) });
  };
  let entries = [];
  try { entries = await readdir(workspace, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const p = join(workspace, e.name);
    if (isRepoRoot(p)) { await add(p); continue; }
    let subs = [];
    try { subs = await readdir(p, { withFileTypes: true }); } catch { continue; }
    for (const s of subs) {
      if (!s.isDirectory() || s.name.startsWith('.')) continue;
      const q = join(p, s.name);
      if (isRepoRoot(q)) await add(q);
    }
  }
  return out;
}

// ------------------------------------------------------------------ locate

/**
 * Where each row of the map sits on this machine. Returns the rows with
 *   { dir, how, hintStale }
 * added: `how` is self | machine | hint | sibling | null, and `hintStale` says the
 * legacy folder column named a place that is not this repo here.
 */
export async function locateRows(root, rows, { workspace = dirname(root) } = {}) {
  const machine = readMachineMap();
  const ownSlug = await originSlug(root);
  let siblings = null; // scanned once, and only if needed
  const out = [];
  for (const r of rows) {
    const res = { ...r, dir: null, how: null, hintStale: false };
    if (!r.slug || r.isPlaceholder) { out.push(res); continue; }
    if (r.isSelf || sameSlug(ownSlug, r.slug)) { Object.assign(res, { dir: root, how: 'self' }); }
    else {
      const fromMachine = machine[r.slug.toLowerCase()];
      if (fromMachine && isRepoRoot(fromMachine) && sameSlug(await originSlug(fromMachine), r.slug)) {
        Object.assign(res, { dir: fromMachine, how: 'machine' });
      } else if (r.folder && isRepoRoot(expand(r.folder)) && sameSlug(await originSlug(expand(r.folder)), r.slug)) {
        Object.assign(res, { dir: expand(r.folder), how: 'hint' });
      } else {
        siblings ||= await siblingRepos(workspace);
        const hit = siblings.find((s) => sameSlug(s.slug, r.slug));
        if (hit) Object.assign(res, { dir: hit.dir, how: 'sibling' });
      }
    }
    if (r.folder && res.dir !== expand(r.folder)) res.hintStale = true;
    out.push(res);
  }
  return out;
}

/** The map's real rows, located, plus this repo. What dashboard-like readers want. */
export async function locatedRepos(root, opts) {
  const map = await readMap(root);
  const rows = await locateRows(root, map.rows.filter((r) => !r.isPlaceholder), opts);
  return { map, rows };
}
