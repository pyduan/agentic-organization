// Copies built from a source elsewhere, and whether each still follows its source.
//
// A public version of an internal page, a dashboard exported to a static file, a deck page
// rebuilt from a spreadsheet: the copy is committed, the source moves on, and nothing says the
// copy stayed behind. An organization running the kit found its public countdown stuck at an old
// date while the internal page it came from had changed format. The fix it kept: each copy
// declares where it comes from and how it is rebuilt, and a check compares the dates.
//
// `derived.json`, at the root of the repo that holds the copies:
//
//   { "copies": [
//     { "copy": "site/public/menu/index.html",          the file (or folder, ending in /) that is a copy
//       "from": "menu-tool",                            optional: the repo of the source, a folder beside
//                                                       this one; this repo when left out
//       "sources": ["data/menu.csv", "templates/**"],   paths in that repo: a file, a folder ending in /,
//                                                       or a glob (* within a folder, ** across folders)
//       "rebuild": "npm run menu",                      the command that rebuilds it, run in this repo
//       "why": "customers read the menu before they order" }
//   ] }
//
// Read by scripts/check-freshness.mjs (the `derived` pass: a copy whose source has a commit newer
// than the copy's last commit) and by .claude/hooks/derived.mjs (at the end of a turn, the rebuild
// proposed when the session touched a source). Neither runs the rebuild: a copy is often public, and
// publishing waits for a person's yes.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const FILE = 'derived.json';

/** The copies a repo declares, each with `dir` (this repo) and `sourceDir` (the source's repo). */
export function readDerived(dir) {
  const file = join(dir, FILE);
  if (!existsSync(file)) return [];
  const j = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(j.copies)) throw new Error(`${FILE}: no "copies" list`);
  return j.copies.map((c, i) => {
    if (!c || typeof c.copy !== 'string' || !Array.isArray(c.sources) || !c.sources.length) {
      throw new Error(`${FILE}: copies[${i}] needs "copy" and a non-empty "sources" list`);
    }
    return { ...c, dir, sourceDir: c.from ? resolve(dirname(resolve(dir)), c.from) : dir };
  });
}

const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
/** Whether a path (relative to its repo, with /) is covered by a source pattern. */
export function covers(pattern, path) {
  const p = String(pattern).replace(/^\.\//, '');
  if (p.endsWith('/')) return path.startsWith(p);
  if (!/[*?]/.test(p)) return path === p || path.startsWith(`${p}/`);
  const re = p.split('**').map((part) => part.split('*').map(escape).join('[^/]*')).join('.*');
  return new RegExp(`^${re}$`).test(path);
}

const git = (cwd, args) => {
  try { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 }).trim(); } catch { return ''; }
};
const spec = (p) => (/[*?]/.test(p) ? `:(glob)${p}` : p.replace(/\/$/, '') || '.');
/** The newest commit touching these paths: { sha, time } (time in ms), or null. */
export function lastCommit(cwd, paths) {
  const [sha, ct] = git(cwd, ['log', '-1', '--format=%H %ct', '--', ...paths.map(spec)]).split(' ');
  return sha ? { sha, time: Number(ct) * 1000 } : null;
}

/**
 * Where each copy stands: { ...copy, state, detail }, state being `current`, `behind` (a source
 * commit is newer than the copy's last commit), `never-built` (the copy has no commit) or
 * `no-source` (the source's repo is not on this machine, or none of its paths has a commit).
 */
export function standing(copies) {
  return copies.map((c) => {
    if (!existsSync(join(c.sourceDir, '.git'))) return { ...c, state: 'no-source', detail: `${c.from || 'its repo'} is not beside this one on this machine` };
    const src = lastCommit(c.sourceDir, c.sources);
    if (!src) return { ...c, state: 'no-source', detail: `no commit touches ${c.sources.join(', ')}` };
    const copy = lastCommit(c.dir, [c.copy]);
    if (!copy) return { ...c, state: 'never-built', detail: 'the copy has never been committed' };
    if (src.time > copy.time) {
      const n = git(c.sourceDir, ['rev-list', '--count', `--since=${Math.floor(copy.time / 1000) + 1}`, 'HEAD', '--', ...c.sources.map(spec)]);
      return { ...c, state: 'behind', detail: `${n || 'some'} source commit(s) since the copy's last commit (${new Date(copy.time).toISOString().slice(0, 10)})` };
    }
    return { ...c, state: 'current', detail: 'no source commit since the copy\'s last one' };
  });
}

/** The copies whose sources a set of touched files covers: touched is [{ dir, path }]. Copies the same files rebuilt are left out. */
export function touchedCopies(copies, touched) {
  const same = (a, b) => resolve(a) === resolve(b);
  return copies.flatMap((c) => {
    const hits = touched.filter((t) => same(t.dir, c.sourceDir) && c.sources.some((s) => covers(s, t.path)));
    if (!hits.length) return [];
    const rebuilt = touched.some((t) => same(t.dir, c.dir) && covers(c.copy, t.path));
    return rebuilt ? [] : [{ ...c, touched: [...new Set(hits.map((h) => h.path))] }];
  });
}
