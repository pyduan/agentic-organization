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

// ------------------------------------------------------- find the template itself

// Never assume the template is the repo this was started from. The update-kit
// skill tells an owner to run this from THEIR project, and taking the caller's
// HEAD as the template's turned every "behind" count into a count of the
// project's own commits since it last synced — a number that is plausible, that
// moves the right way, and that grows the harder the project is worked. It also
// made an up-to-date instance unrangeable, so it read as uncomparable rather
// than fine. Reported by an owner whose project claimed 189 commits behind
// while kit-sync said there was nothing to apply (2026-08-31).
//
// The template is identified by its origin, wherever it sits: the caller, or a
// sibling in the workspace. If there is no clone of it on this machine there is
// nothing to compare against, and the scan says so instead of printing a number.
let templateDir = null;
let templateHead = null;
let templateBehind = null;

const isTemplate = async (d) =>
  ((await git(d, ['remote', 'get-url', 'origin'])) || '').includes(TEMPLATE_SLUG);

// Where an instance's yardstick comes from, in order of preference:
//   1. a clone of the template on this machine, fetched just now;
//   2. failing that, the instance's own `template/<branch>` ref — the very thing
//      it syncs against, and which kit-sync and kit-news already keep fetched.
// (2) is not a consolation prize, it is the common case: a machine that runs an
// instance usually has no clone of the template at all. Without it this scan
// would answer "cannot compare" to the one owner who most needs the number,
// which is a quieter way of being useless than the wrong figure it used to give.
const TEMPLATE_REMOTE = process.env.KIT_REMOTE || 'template';
const TEMPLATE_BRANCH = process.env.KIT_BRANCH || 'main';

async function yardstickFor(dir) {
  if (templateHead) return { sha: templateHead, repo: templateDir, from: 'clone' };
  if (!(await git(dir, ['remote', 'get-url', TEMPLATE_REMOTE]))) return { sha: null, from: 'none' };
  if (!OFFLINE) await git(dir, ['fetch', '--quiet', TEMPLATE_REMOTE]);
  const sha = await git(dir, ['rev-parse', `${TEMPLATE_REMOTE}/${TEMPLATE_BRANCH}`]);
  return sha ? { sha, repo: dir, from: 'remote-ref' } : { sha: null, from: 'none' };
}

// ------------------------------------------------------- inspect one instance

async function inspect(dir) {
  const name = basename(dir);
  const origin = (await git(dir, ['remote', 'get-url', 'origin'])) || '';
  if (origin.includes(TEMPLATE_SLUG)) return null; // the template is not an instance

  const marker = await kitMarker(dir);
  if (!marker) return null;

  // 0 · how fresh is this checkout? Everything below is read off the working copy,
  // so it describes a clone and not a repo. An owner was told a healthy project
  // had no hook and no .kit-sync, on the strength of a clone 118 commits old.
  if (!OFFLINE) await git(dir, ['fetch', '--quiet', 'origin']);
  const upstream = (await git(dir, ['rev-parse', '--verify', '--quiet', '@{u}'])) ? '@{u}'
    : (await git(dir, ['rev-parse', '--verify', '--quiet', 'origin/HEAD'])) ? 'origin/HEAD' : null;
  let copyBehind = null;
  if (upstream) {
    const n = await git(dir, ['rev-list', '--count', `HEAD..${upstream}`]);
    copyBehind = n === null ? null : Number(n);
  }

  // 1 · kit age, measured inside the template's repo — the only one that holds
  // both the sync point and the template's history.
  let sha = null;
  try { sha = JSON.parse(await readFile(join(dir, '.kit-sync'), 'utf8')).sha || null; } catch { /* none */ }
  let behind = null;
  let behindWhy = null;
  let yardstick = 'none';
  if (!sha) behindWhy = 'no-sync';
  else {
    const y = await yardstickFor(dir);
    yardstick = y.from;
    if (!y.sha) behindWhy = 'no-yardstick';
    else {
      const n = await git(y.repo, ['rev-list', '--count', `${sha}..${y.sha}`]);
      if (n === null) behindWhy = 'sync-point-unknown';
      else behind = Number(n);
    }
  }

  // 2 · wired to announce its own news? Two different questions, and this used to
  // answer only the first. The hook line being present in settings.json says what
  // someone intended; it does not say the mechanism has ever run. Its command ends
  // in `2>/dev/null || true`, so on a machine without node it fails silently and
  // exits zero — an owner ran a month of sessions being told he was wired while
  // kit-news had never once executed. So the hook now leaves a receipt in .git/
  // when it runs, and this reads it: configured is intent, ran is evidence.
  let configured = false;
  try {
    const s = JSON.parse(await readFile(join(dir, '.claude/settings.json'), 'utf8'));
    configured = JSON.stringify(s.hooks?.SessionStart || []).includes('kit-news');
  } catch { /* no settings, so not configured */ }

  let lastRan = null;
  const gitDir = await git(dir, ['rev-parse', '--absolute-git-dir']);
  if (gitDir) {
    try { lastRan = JSON.parse(await readFile(join(gitDir, 'kit-news-ran'), 'utf8')).at || null; }
    catch { /* never ran here, or ran before the receipt existed */ }
  }
  const wired = configured && Boolean(lastRan);

  // 3 · who is still working in it
  const ref = (await git(dir, ['rev-parse', '--verify', '--quiet', 'origin/HEAD'])) ? 'origin/HEAD' : 'HEAD';
  const log = (await git(dir, ['log', ref, '--format=%an\t%ae\t%ad', '--date=short', '-500'])) || '';
  const people = new Map();
  for (const line of log.split('\n').filter(Boolean)) {
    const [an, ae, ad] = line.split('\t');
    if (!people.has(an)) people.set(an, { name: an, email: ae, last: ad, n: 0 });
    people.get(an).n++;
  }

  return {
    name, origin, marker, sha, behind, behindWhy, yardstick, wired, configured, lastRan, copyBehind,
    lastCommit: [...people.values()].map((p) => p.last).sort().pop() || null,
    people: [...people.values()].sort((a, b) => (a.last < b.last ? 1 : -1)),
  };
}

const dirs = await candidateDirs();

if (await isTemplate(ROOT)) templateDir = ROOT;
else for (const d of dirs) if (await isTemplate(d)) { templateDir = d; break; }

if (templateDir) {
  if (!OFFLINE) await git(templateDir, ['fetch', '--quiet', 'origin']);
  templateHead = await git(templateDir, ['rev-parse', 'HEAD']);
  // The template clone is a working copy too, and it is the yardstick every other
  // number here is measured against. Say how fresh it is before using it.
  const up = (await git(templateDir, ['rev-parse', '--verify', '--quiet', '@{u}'])) ? '@{u}'
    : (await git(templateDir, ['rev-parse', '--verify', '--quiet', 'origin/HEAD'])) ? 'origin/HEAD' : null;
  if (up) {
    const n = await git(templateDir, ['rev-list', '--count', `HEAD..${up}`]);
    templateBehind = n === null ? null : Number(n);
  }
}

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
if (!templateDir) {
  console.log('No clone of the template on this machine. Each instance is therefore measured against');
  console.log(`its own \`${TEMPLATE_REMOTE}/${TEMPLATE_BRANCH}\` ref, which is what it syncs against anyway — so the ages below`);
  console.log('are as fresh as that instance\u2019s last fetch, and two of them can disagree.');
} else if (templateBehind) {
  console.log(`⚠ That template clone (${templateDir}) is itself ${templateBehind} commit(s) behind its`);
  console.log('  origin, so every age below is measured against a yardstick that is short. git pull it.');
}
console.log();

if (!rows.length) {
  console.log('No instances found beside this repo. If projects live elsewhere, run this from');
  console.log('a workspace that contains them, or clone them side by side (ORGANIGRAM.md).');
  console.log();
  process.exit(0);
}

const WHY = {
  'no-sync': 'NO .kit-sync — never upgraded through kit-sync',
  'no-yardstick': 'no template clone here and no `template` remote in it — nothing to compare against',
  'sync-point-unknown': 'its sync point is not in the template\u2019s history — fetch the template',
};

for (const r of rows) {
  const age = r.behind === null ? (WHY[r.behindWhy] ?? 'not comparable')
    : r.behind === 0 ? 'up to date' : `${r.behind} template commit(s) behind`;
  const quiet = daysSince(r.lastCommit);

  console.log(`── ${r.name}`);
  // Said before the verdicts, because they are all read off this checkout. A stale
  // clone makes a healthy project look broken, and the report never said so.
  if (r.copyBehind) {
    console.log(`   ⚠ this clone is ${r.copyBehind} commit(s) behind its own origin — everything below`);
    console.log('     describes the copy on this disk, not what the repo actually holds. git pull it.');
  }
  console.log(`   kit:    ${age}${r.sha ? ` (at ${r.sha.slice(0, 7)})` : ''}`);
  console.log(`   news:   ${r.wired
    ? `wired — kit-news last ran ${new Date(r.lastRan).toISOString().slice(0, 10)}`
    : r.configured
      ? 'configured, no receipt yet — cannot tell whether it has ever run'
      : 'NOT WIRED — no SessionStart kit-news hook, so it will never announce an update'}`);
  if (r.configured && !r.wired) {
    console.log('           kit-news only started leaving a receipt on 2026-08-31, so an instance that');
    console.log('           has not pulled the kit since then cannot have left one: this says nothing');
    console.log('           yet. Once it has, an empty receipt means node is probably missing — the');
    console.log('           hook ends in `2>/dev/null || true` and fails silently. Check `node --version`.');
  }
  console.log(`   last push: ${r.lastCommit || 'unknown'}${quiet !== null ? ` (${quiet}d ago)` : ''}`);
  for (const p of r.people.slice(0, 6)) {
    const flag = unroutable(p.email) ? '  ⚠ unroutable author, GitHub credits nobody' : '';
    console.log(`     ${p.last}  ${String(p.n).padStart(4)}  ${p.name} <${p.email}>${flag}`);
  }
  console.log();
}

const unwired = rows.filter((r) => !r.configured);
const silent = rows.filter((r) => r.configured && !r.wired);
const stalecopy = rows.filter((r) => r.copyBehind);
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
if (silent.length) {
  console.log(`${silent.length} instance(s) have the news hook and no receipt: ${silent.map((r) => r.name).join(', ')}`);
  console.log('  Configured is what someone intended; ran is what happened, and until 2026-08-31');
  console.log('  nothing recorded the difference. Expect these to clear as each pulls the kit and');
  console.log('  opens one session. Any that stay here after that are silently not running.');
  console.log();
}
if (stale.length) {
  console.log(`${stale.length} instance(s) behind the template: ${stale.map((r) => `${r.name} (${r.behind})`).join(', ')}`);
  console.log();
}
if (stalecopy.length) {
  console.log(`${stalecopy.length} clone(s) on this disk are behind their own origin, so their lines above`);
  console.log(`  may describe an old copy: ${stalecopy.map((r) => `${r.name} (${r.copyBehind})`).join(', ')}`);
  console.log();
}
