#!/usr/bin/env node
// Which projects run this kit, how old is the kit in each, and who is still working in them.
//
// The gap this closes, found the hard way: a project onboarded before the
// kit-news mechanism existed can never announce that the mechanism exists. The
// notifier ships inside the thing it notifies about — SessionStart hook in
// `.claude/settings.json`, script in `scripts/` — so an instance that predates it
// stays silent forever, and nothing on the maintainer's side goes red either. A
// real one went a month without anyone noticing.
//
// Three questions per instance, and the third is the one nobody had a view of:
//   1. How far behind the template is it (.kit-sync sha vs template HEAD)?
//   2. Is it WIRED — does it register the SessionStart hook that announces news?
//      An unwired instance will never tell its own owner anything.
//   3. Who last pushed to it, and when? A collaborator who went quiet, or whose
//      commits carry an unroutable author, is invisible from the GitHub UI.
//
// Zero dependencies, Node built-ins only. Reads only; writes nothing, ever.
//
// Usage:
//   node scripts/check-fleet.mjs            # scan the workspace
//   node scripts/check-fleet.mjs --offline  # skip every fetch
//   node scripts/check-fleet.mjs --json
//   node scripts/check-fleet.mjs --workspace=~/projects/other   # another folder of siblings

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve, basename } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const OFFLINE = args.includes('--offline');
const ROOT = resolve(process.cwd());
const TEMPLATE_SLUG = 'pyduan/agentic-organization';

// The folder whose direct children are the fleet. Never its parent: see below.
const WORKSPACE = (() => {
  const flag = process.argv.find((a) => a.startsWith('--workspace='));
  return flag ? resolve(flag.slice('--workspace='.length).replace(/^~/, homedir())) : dirname(ROOT);
})();

const git = async (cwd, a, timeout = 15_000) => {
  try { return (await run('git', a, { cwd, timeout })).stdout.trim(); }
  catch { return null; }
};

// ------------------------------------------------------- find the instances
// The workspace is this repo's parent folder, and ONLY that. It used to scan the
// grandparent too, to catch repos grouped by owner (~/projects/personal/…,
// ~/projects/bayesimpact/…) — and that reached into a neighbouring organization:
// on this machine it reported a Bayes repo as a kit instance "never upgraded",
// on the strength of its CLAUDE.md merely naming the kit. A survey of your own
// fleet must not walk into someone else's (Paul, 2026-08-28).
//
// One folder of siblings is the layout the kit documents, so it is the default.
// `--workspace=<path>` widens it deliberately, which is the only way it should
// ever widen.

async function candidateDirs() {
  const seen = new Set();
  const out = [];
  for (const base of [WORKSPACE]) {
    let entries = [];
    try { entries = await readdir(base, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const p = join(base, e.name);
      if (existsSync(join(p, '.git')) && !seen.has(p)) { seen.add(p); out.push(p); }
      else {
        let subs = [];
        try { subs = await readdir(p, { withFileTypes: true }); } catch { continue; }
        for (const s of subs) {
          if (!s.isDirectory() || s.name.startsWith('.')) continue;
          const q = join(p, s.name);
          if (existsSync(join(q, '.git')) && !seen.has(q)) { seen.add(q); out.push(q); }
        }
      }
    }
  }
  return out;
}

// A kit instance is a repo carrying the kit's own furniture. `.kit-sync` is the
// modern marker; the other two catch instances that predate it, which are exactly
// the ones this script exists to surface.
async function kitMarker(dir) {
  if (existsSync(join(dir, '.kit-sync'))) return 'kit-sync';
  if (existsSync(join(dir, 'source/formats')) && existsSync(join(dir, 'CLAUDE.md'))) return 'structure';
  if (existsSync(join(dir, 'CLAUDE.md'))) {
    try {
      if ((await readFile(join(dir, 'CLAUDE.md'), 'utf8')).includes('agentic-organization')) return 'claude-md';
    } catch { /* unreadable */ }
  }
  return null;
}

// ------------------------------------------------------- the template's own HEAD

const templateHead = await git(ROOT, ['rev-parse', 'HEAD']);
if (!OFFLINE) await git(ROOT, ['fetch', '--quiet', 'origin']);

// ------------------------------------------------------- inspect one instance

async function inspect(dir) {
  const name = basename(dir);
  const origin = (await git(dir, ['remote', 'get-url', 'origin'])) || '';
  if (origin.includes(TEMPLATE_SLUG)) return null; // the template is not an instance

  const marker = await kitMarker(dir);
  if (!marker) return null;

  // 1 · kit age
  let sha = null;
  try { sha = JSON.parse(await readFile(join(dir, '.kit-sync'), 'utf8')).sha || null; } catch { /* none */ }
  let behind = null;
  if (sha && templateHead) {
    const n = await git(ROOT, ['rev-list', '--count', `${sha}..${templateHead}`]);
    behind = n === null ? null : Number(n);
  }

  // 2 · wired to announce its own news?
  let wired = false;
  try {
    const s = JSON.parse(await readFile(join(dir, '.claude/settings.json'), 'utf8'));
    wired = JSON.stringify(s.hooks?.SessionStart || []).includes('kit-news');
  } catch { /* no settings, so not wired */ }

  // 3 · who is still working in it
  if (!OFFLINE) await git(dir, ['fetch', '--quiet', 'origin']);
  const ref = (await git(dir, ['rev-parse', '--verify', '--quiet', 'origin/HEAD'])) ? 'origin/HEAD' : 'HEAD';
  const log = (await git(dir, ['log', ref, '--format=%an\t%ae\t%ad', '--date=short', '-500'])) || '';
  const people = new Map();
  for (const line of log.split('\n').filter(Boolean)) {
    const [an, ae, ad] = line.split('\t');
    if (!people.has(an)) people.set(an, { name: an, email: ae, last: ad, n: 0 });
    people.get(an).n++;
  }

  return {
    name, origin, marker, sha, behind, wired,
    lastCommit: [...people.values()].map((p) => p.last).sort().pop() || null,
    people: [...people.values()].sort((a, b) => (a.last < b.last ? 1 : -1)),
  };
}

const dirs = await candidateDirs();
const rows = (await Promise.all(dirs.map(inspect))).filter(Boolean)
  .sort((a, b) => (a.name > b.name ? 1 : -1));

// ------------------------------------------------------- render

if (AS_JSON) {
  console.log(JSON.stringify({ templateHead, instances: rows }, null, 2));
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const daysSince = (d) => (d ? Math.round((Date.parse(today) - Date.parse(d)) / 86_400_000) : null);
// An author line that cannot be routed back to a person: git was never configured,
// so GitHub attributes the commit to nobody and the contributor looks idle.
const unroutable = (email) => !email || !email.includes('@') || /\.local$/.test(email) || email.endsWith('@localhost');

console.log();
console.log(`KIT FLEET — ${rows.length} instance(s), template at ${(templateHead || '?').slice(0, 7)}`);
console.log();

if (!rows.length) {
  console.log('No instances found beside this repo. If projects live elsewhere, run this from');
  console.log('a workspace that contains them, or clone them side by side (ORGANIGRAM.md).');
  console.log();
  process.exit(0);
}

for (const r of rows) {
  const age = r.behind === null
    ? (r.marker === 'kit-sync' ? 'no template HEAD to compare' : 'NO .kit-sync — never upgraded through kit-sync')
    : r.behind === 0 ? 'up to date' : `${r.behind} template commit(s) behind`;
  const quiet = daysSince(r.lastCommit);

  console.log(`── ${r.name}`);
  console.log(`   kit:    ${age}${r.sha ? ` (at ${r.sha.slice(0, 7)})` : ''}`);
  console.log(`   news:   ${r.wired
    ? 'wired — a session here announces kit news'
    : 'NOT WIRED — no SessionStart kit-news hook, so it will never announce an update'}`);
  console.log(`   last push: ${r.lastCommit || 'unknown'}${quiet !== null ? ` (${quiet}d ago)` : ''}`);
  for (const p of r.people.slice(0, 6)) {
    const flag = unroutable(p.email) ? '  ⚠ unroutable author, GitHub credits nobody' : '';
    console.log(`     ${p.last}  ${String(p.n).padStart(4)}  ${p.name} <${p.email}>${flag}`);
  }
  console.log();
}

const unwired = rows.filter((r) => !r.wired);
const stale = rows.filter((r) => r.behind !== null && r.behind > 0);
const noSync = rows.filter((r) => !r.sha);

// This scan sees clones on this machine and nothing else. An instance nobody has
// cloned here does not appear, and its absence from this list is not evidence it
// does not exist (docs/failure-modes.md ▸ no search proves an absence).
console.log(`Scanned: ${WORKSPACE} only, the folder this repo sits in, so a neighbouring`);
console.log('organization is never surveyed. An instance not cloned here does not appear,');
console.log('and this list is silent about it rather than clearing it. The repo map is ORGANIGRAM.md.');
console.log();

if (unwired.length) {
  console.log(`${unwired.length} instance(s) will never announce an update to their own owner:`);
  console.log(`  ${unwired.map((r) => r.name).join(', ')}`);
  console.log('  Run the update-kit skill in each. Until then, the only way its owner learns');
  console.log('  about a kit change is you telling them.');
  console.log();
}
if (noSync.length) {
  console.log(`${noSync.length} instance(s) have no .kit-sync, so an upgrade there is a copy, not a merge,`);
  console.log(`  and can silently revert the owner's own work: ${noSync.map((r) => r.name).join(', ')}`);
  console.log();
}
if (stale.length) {
  console.log(`${stale.length} instance(s) behind the template: ${stale.map((r) => `${r.name} (${r.behind})`).join(', ')}`);
  console.log();
}
