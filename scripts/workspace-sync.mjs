#!/usr/bin/env node
// Keep the organization's clones on this machine current, without ever losing work.
//
// Every session is told to pull first, and the workspace hook used to do it with
// `git pull --ff-only` in every folder beside the main repo. That pulls whatever branch
// happens to be checked out, into a working copy another session may be editing. The
// rules below come from an organization that runs this sync unattended, every quarter of
// an hour, on every laptop, where a sync that moved a file under someone's feet would
// have been noticed within a day.
//
// A clone is fast-forwarded only when all of these hold:
//   - it is on its default branch (origin/HEAD, else main or master);
//   - nothing is uncommitted in tracked files (untracked files do not count, and git
//     itself refuses if a new commit would overwrite one);
//   - it has no commits that origin lacks.
// Anything else is reported and left exactly as it was. A sync never merges, rebases,
// stashes, clones or pushes.
//
// Which repos: the ones on the map (ORGANIGRAM.md) that sit on this machine, found by
// their origin (lib/workspace.mjs), this repo included. With --siblings, also every repo
// beside this one, which is what the workspace hook wants: that folder is the
// organization's.
//
//   node scripts/workspace-sync.mjs status [--json] [--offline] [--siblings]
//   node scripts/workspace-sync.mjs sync   [--json] [--quiet]   [--siblings]
//
// --quiet prints only what needs a person, so a session start with nothing to say says
// nothing. A sync also warns when git has no identity on this machine: commits then go out
// signed <user>@<computer name>, tied to no account, and nobody notices until someone reads
// the history. sync exits 1 when a repo could not be brought up to date for a reason other
// than a choice (origin unreachable, git refused); status always exits 0.
//
// Zero dependencies, Node built-ins and git. Every git call has a timeout, and a fetch
// never waits on a password prompt.

import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitOrigin, isRepoRoot, locatedRepos, originSlug, siblingRepos } from '../lib/workspace.mjs';

const FETCH_TIMEOUT_MS = 20_000;
const LOCAL_TIMEOUT_MS = 10_000;

function git(cwd, args, timeout = LOCAL_TIMEOUT_MS) {
  return new Promise((ok, fail) => {
    execFile('git', ['-C', cwd, ...args], {
      encoding: 'utf8', timeout, windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (error, stdout, stderr) => (error ? fail(Object.assign(error, { stderr })) : ok(stdout.trim())));
  });
}
const tryGit = (cwd, args) => git(cwd, args).catch(() => null);

/** What git said, in one line: its first error, else its last line. */
function reason(error) {
  if (error.killed) return 'timed out';
  const lines = String(error.stderr || error.message).split('\n').map((l) => l.trim()).filter(Boolean);
  const first = lines.find((l) => /^(error|fatal):/i.test(l));
  return (first || lines.pop() || 'unknown error').replace(/^(error|fatal):\s*/i, '');
}

const commits = (n, adjective = '') => `${n} ${adjective}commit${n === 1 ? '' : 's'}`;

/**
 * Whether a clone may be fast-forwarded, and how to say where it stands. Pure, so the
 * whole policy is one table a test can read.
 */
export function decide({ branch, defaultBranch, dirty, ahead, behind }) {
  if (branch !== defaultBranch) {
    return { state: 'other-branch', merge: false, detail: `on ${branch || 'a detached HEAD'}, not ${defaultBranch}` };
  }
  if (ahead > 0 && behind > 0) {
    return { state: 'diverged', merge: false, detail: `${commits(ahead)} of yours and ${commits(behind, 'new ')} on ${defaultBranch}` };
  }
  if (behind > 0 && dirty) {
    return { state: 'local-changes', merge: false, detail: `${commits(behind, 'new ')} on ${defaultBranch}, and uncommitted changes in the way` };
  }
  if (behind > 0) return { state: 'behind', merge: true, detail: `${commits(behind, 'new ')} on ${defaultBranch}` };
  if (ahead > 0) return { state: 'ahead', merge: false, detail: `${commits(ahead)} not pushed yet` };
  return { state: 'up-to-date', merge: false, detail: dirty ? 'up to date, with uncommitted changes' : 'up to date' };
}

/** States that need a person. Everything else is a clone that is current. */
export const ATTENTION = new Set(['other-branch', 'diverged', 'local-changes', 'ahead', 'no-remote', 'not-fetched', 'unreachable', 'refused']);
/** States where the sync failed for a reason nobody chose. */
export const FAILED = new Set(['unreachable', 'refused']);

/** origin/HEAD as the clone recorded it, else main or master, whichever origin has. */
async function defaultBranchOf(dir) {
  const head = await tryGit(dir, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (head) return head.replace(/^origin\//, '');
  for (const b of ['main', 'master']) {
    if (await tryGit(dir, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${b}`])) return b;
  }
  return 'main';
}

/** Where a clone stands against origin; with `fetch`, fetches its default branch first. */
export async function inspect(dir, { fetch = false } = {}) {
  if (!(await gitOrigin(dir))) return { state: 'no-remote', merge: false, detail: 'no origin remote, so nothing to pull from' };
  const defaultBranch = await defaultBranchOf(dir);
  if (fetch) {
    try { await git(dir, ['fetch', '--quiet', 'origin', defaultBranch], FETCH_TIMEOUT_MS); }
    catch (e) { return { state: 'unreachable', merge: false, defaultBranch, detail: `could not reach origin (${reason(e)})` }; }
  }
  if (!(await tryGit(dir, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${defaultBranch}`]))) {
    return { state: 'not-fetched', merge: false, defaultBranch, detail: `origin/${defaultBranch} has never been fetched here` };
  }
  const branch = (await tryGit(dir, ['branch', '--show-current'])) ?? '';
  const dirty = ((await tryGit(dir, ['status', '--porcelain', '--untracked-files=no'])) ?? '') !== '';
  const counts = await tryGit(dir, ['rev-list', '--left-right', '--count', `HEAD...origin/${defaultBranch}`]);
  const [ahead, behind] = (counts ?? '0 0').split(/\s+/).map(Number);
  return { branch, defaultBranch, dirty, ahead, behind, ...decide({ branch, defaultBranch, dirty, ahead, behind }) };
}

/** Fetches, and fast-forwards when decide() allows it. Says where the clone stands after. */
export async function syncRepo(dir) {
  const found = await inspect(dir, { fetch: true });
  if (!found.merge) return found;
  try {
    await git(dir, ['merge', '--quiet', '--ff-only', `origin/${found.defaultBranch}`]);
    return { ...found, state: 'updated', merge: false, detail: `pulled ${commits(found.behind, 'new ')}` };
  } catch (e) {
    // An untracked file where a new commit adds one, or another session's git holding the
    // index: git refuses, and the clone is exactly as it was.
    return { ...found, state: 'refused', merge: false, detail: `git refused the fast-forward (${reason(e)}), nothing changed` };
  }
}

/**
 * The repos a sync covers: this one, the map's rows found on this machine, and with
 * `siblings` every repo beside this one. Also returns the map's rows that are not here.
 */
export async function targets(root, { siblings = false } = {}) {
  const found = new Map();
  const missing = [];
  if (isRepoRoot(root)) found.set(root, { dir: root, slug: await originSlug(root), onMap: true });
  const { rows } = await locatedRepos(root);
  for (const r of rows) {
    if (r.dir) { if (!found.has(r.dir)) found.set(r.dir, { dir: r.dir, slug: r.slug, onMap: true }); }
    else if (r.slug) missing.push(r.slug);
  }
  if (siblings) {
    for (const s of await siblingRepos(dirname(root))) {
      if (!found.has(s.dir)) found.set(s.dir, { dir: s.dir, slug: s.slug, onMap: false });
    }
  }
  const repos = [...found.values()].map((r) => ({ name: basename(r.dir), ...r }));
  repos.sort((a, b) => a.name.localeCompare(b.name));
  return { repos, missing };
}

/** One status or sync over every target, in parallel. */
export async function run(root, { command = 'status', fetch = true, siblings = false } = {}) {
  const { repos, missing } = await targets(root, { siblings });
  const results = await Promise.all(repos.map(async (r) => ({
    ...r, ...(command === 'sync' ? await syncRepo(r.dir) : await inspect(r.dir, { fetch })),
  })));
  return { root, command, fetched: command === 'sync' || fetch, at: new Date().toISOString(), repos: results, missing };
}

// What to tell the person, per state that needs one.
const ADVICE = {
  'diverged': 'Run git pull --rebase in it before writing.',
  'local-changes': 'Commit or set the changes aside, then pull.',
  'ahead': 'Push them, or find out whose they are.',
};
const line = (r) => {
  const notUpdated = !['ahead', 'no-remote'].includes(r.state);
  return `• ${r.name}: ${notUpdated ? 'NOT updated, ' : ''}${r.detail}.${ADVICE[r.state] ? ` ${ADVICE[r.state]}` : ''}`;
};

/** The sync report: the summary line the workspace hook has always printed, then what needs a person. */
export function syncReport(result, { quiet = false } = {}) {
  const out = [];
  const current = result.repos.filter((r) => !ATTENTION.has(r.state));
  const pulled = result.repos.filter((r) => r.state === 'updated');
  let attention = result.repos.filter((r) => ATTENTION.has(r.state));
  const unreachable = attention.filter((r) => r.state === 'unreachable');
  if (!quiet) {
    out.push(`Workspace: ${current.length} repo(s) up to date${pulled.length ? ` (${pulled.length} pulled just now)` : ''}.`);
  }
  // Offline, every repo fails the same way: one line says it better than one per repo.
  if (unreachable.length > 1 && unreachable.length === result.repos.filter((r) => r.state !== 'no-remote').length) {
    out.push(`• Could not reach origin for any of the ${unreachable.length} repos (offline?): nothing was updated.`);
    attention = attention.filter((r) => r.state !== 'unreachable');
  }
  out.push(...attention.map(line));
  if (quiet && out.length) {
    out.unshift('Workspace: some clones need a look before anyone writes in them.');
    out.push('Never discard changes or commits to bring one up to date: they may be another session\'s.');
  }
  return out.join('\n');
}

/** The warning for a machine whose git has no identity of its own, or null. */
export async function identityWarning(root) {
  const email = (await tryGit(root, ['config', 'user.email'])) || '';
  if (email && !/@[^@]*\.(local|home|lan|localdomain|internal)$/i.test(email)) return null;
  return '▲ Git has no identity on this machine: commits go out signed with the computer\'s name, tied to no account. ' +
    'Set user.name and user.email once (docs/troubleshooting.md ▸ Commits signed with the computer\'s name).';
}

const MARK = { 'up-to-date': '✓', updated: '✓', behind: '↓', ahead: '↑', 'other-branch': '▲', diverged: '▲', 'local-changes': '▲', 'no-remote': '·', 'not-fetched': '·', unreachable: '✘', refused: '✘' };

export function statusReport(result) {
  const width = Math.max(4, ...result.repos.map((r) => r.name.length));
  const out = [`Repos on this machine, ${result.fetched ? 'fetched just now' : 'as last fetched'}:`];
  for (const r of result.repos) out.push(`  ${MARK[r.state] || '·'} ${r.name.padEnd(width)}  ${r.detail}${r.onMap ? '' : '  (not on the map)'}`);
  for (const slug of result.missing) out.push(`  · ${slug.padEnd(width)}  on the map, not on this machine`);
  const behind = result.repos.filter((r) => r.state === 'behind').length;
  const attention = result.repos.filter((r) => ATTENTION.has(r.state)).length;
  out.push(`\n${result.repos.length} repo(s) checked: ${behind} can be fast-forwarded, ${attention} need a person.` +
    (behind ? ' Run `node scripts/workspace-sync.mjs sync` to bring them up to date.' : ''));
  return out.join('\n');
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  const [command = 'status', ...rest] = process.argv.slice(2);
  const flags = new Set(rest);
  if (!['status', 'sync'].includes(command)) {
    console.error('Usage: node scripts/workspace-sync.mjs status [--json] [--offline] [--siblings]\n' +
      '       node scripts/workspace-sync.mjs sync [--json] [--quiet] [--siblings]');
    process.exit(1);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = await run(root, { command, fetch: !flags.has('--offline'), siblings: flags.has('--siblings') });
  if (flags.has('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    const text = command === 'sync' ? syncReport(result, { quiet: flags.has('--quiet') }) : statusReport(result);
    if (text) console.log(text);
    const warning = command === 'sync' ? await identityWarning(root) : null;
    if (warning) console.log(warning);
  }
  process.exit(command === 'sync' && result.repos.some((r) => FAILED.has(r.state)) ? 1 : 0);
}
