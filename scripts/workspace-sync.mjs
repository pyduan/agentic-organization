#!/usr/bin/env node
// Keep the organization's clones on this machine current, without ever losing work.
//
// Every session is told to pull first, and a plain `git pull --ff-only` in every folder
// pulls whatever branch happens to be checked out, into a working copy another session
// may be editing. The rules below hold for a sync run unattended, on every laptop.
//
// A clone is fast-forwarded only when all of these hold:
//   - it is on its default branch (origin/HEAD, else main or master);
//   - nothing is uncommitted in tracked files (untracked files do not count, and git
//     itself refuses if a new commit would overwrite one);
//   - it has no commits that origin lacks.
// Anything else is reported and left exactly as it was. A sync never merges, rebases,
// stashes, clones or pushes.
//
// A rule usually lands with a backlog: files written before it that break it. A commit
// that knows of one says so in a trailer, `Retroactive: <what to sweep>` (or
// `Retroactive: none`). After a fast-forward the sync lists the trailers of the commits it
// just pulled, other than none, so the session applies them to what already exists.
//
// Which repos: the ones on the map (ORGANIGRAM.md) that sit on this machine, found by
// their origin (lib/workspace.mjs), this repo included. With --siblings, also every repo
// beside this one, which is what the workspace hook wants: that folder is the
// organization's. A repo that declares `none` in its .read-consent is left alone, and one
// that declares `counts` is fast-forwarded without its commit messages being read here, so
// its trailers wait for a session of its own (lib/neighbour.mjs).
//
//   node scripts/workspace-sync.mjs status [--json] [--offline] [--siblings]
//   node scripts/workspace-sync.mjs sync   [--json] [--quiet]   [--siblings]
//   node scripts/workspace-sync.mjs prompt [--siblings]          (the UserPromptSubmit hook)
//
// `prompt` pulls again before each message the person sends, because a session that runs for an
// hour works from a start-of-session copy while another session corrects the facts it relies on.
// It does what sync does (fast-forward only, a clean default branch only, never a merge, a
// rebase or a stash) and says only what changed: the commits it pulled and their Retroactive:
// trailers, or, once per new situation, why it could not pull. Nothing to pull: nothing said.
// It asks origin at most once a minute per clone (the start's sync counts), and a clone another
// sync, another session's hook or git itself is busy in is skipped for that prompt: two pull
// hooks on one checkout fight over git's lock, and the loser reports a conflict that does not
// exist. So there is one pull mechanism per checkout, this one: a project that wired its own
// prompt-time pull removes it. The start's sync stays, since it does more (the siblings' trailers,
// git identity, machine settings), and it runs before the first prompt, never beside it.
//
// --quiet prints only what needs a person, so a session start with nothing to say says
// nothing. With --siblings, the hook of a workspace or a satellite, the sync also says when the
// workspace's own files (scripts/install-workspace.mjs) are missing or out of date: nothing else
// tells a machine set up before a change that its hooks and skills lag behind the router. A sync also warns when git has no identity on this machine: commits then go out
// signed <user>@<computer name>, tied to no account, and nobody notices until someone reads
// the history. sync exits 1 when a repo could not be brought up to date for a reason other
// than a choice (origin unreachable, git refused), except under --quiet, the session-start
// mode: a hook's output reaches the agent only when it exits 0, and the failure is the part
// the agent most needs to read. status always exits 0.
//
// Zero dependencies, Node built-ins and git. Every git call has a timeout, and a fetch
// never waits on a password prompt.

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitOrigin, isRepoRoot, locatedRepos, originSlug, siblingRepos } from '../lib/workspace.mjs';
import { neighbour, ReadRefused, CONSENT_FILE } from '../lib/neighbour.mjs';

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
export const ATTENTION = new Set(['other-branch', 'diverged', 'local-changes', 'ahead', 'no-remote', 'not-fetched', 'unreachable', 'unreadable', 'refused', 'busy']);
/** States where the sync failed for a reason nobody chose. */
export const FAILED = new Set(['unreachable', 'unreadable', 'refused']);

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
    catch (e) {
      if (LOCKED.test(String(e.stderr))) return { state: 'busy', merge: false, defaultBranch, detail: 'another git command is running in it' };
      return { state: 'unreachable', merge: false, defaultBranch, detail: `could not reach origin (${reason(e)})` };
    }
  }
  if (!(await tryGit(dir, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${defaultBranch}`]))) {
    return { state: 'not-fetched', merge: false, defaultBranch, detail: `origin/${defaultBranch} has never been fetched here` };
  }
  const branch = (await tryGit(dir, ['branch', '--show-current'])) ?? '';
  const dirty = ((await tryGit(dir, ['status', '--porcelain', '--untracked-files=no'])) ?? '') !== '';
  let counts;
  try { counts = await git(dir, ['rev-list', '--left-right', '--count', `HEAD...origin/${defaultBranch}`]); }
  catch (e) { return { branch, defaultBranch, dirty, state: 'unreadable', merge: false, detail: `could not compare with origin/${defaultBranch} (${reason(e)})` }; }
  const [ahead, behind] = counts.split(/\s+/).map(Number);
  return { branch, defaultBranch, dirty, ahead, behind, ...decide({ branch, defaultBranch, dirty, ahead, behind }) };
}

/**
 * The `Retroactive:` trailers of the commits in a range, oldest first, `none` left out.
 * Commit messages are a repo's own words, so they are read through what it declares:
 * null when it keeps them home.
 */
export async function retroactive(dir, range, n = neighbour(dir, { self: true })) {
  const parse = (log) => {
    const out = [];
    for (const entry of log.split('\x1e').map((e) => e.trim()).filter(Boolean)) {
      const [sha, subject, body = ''] = entry.split('\x1f');
      for (const m of body.matchAll(/^\s*Retroactive:\s*(.+)$/gim)) {
        if (!/^none\b/i.test(m[1].trim())) out.push({ sha, subject, sweep: m[1].trim() });
      }
    }
    return out;
  };
  try { return await n.history(['--reverse', '--format=%H%x1f%s%x1f%B%x1e', range], parse); }
  catch (e) { return e instanceof ReadRefused ? null : []; }
}

// ------------------------------------------------------------------ one pull at a time per clone

const LOCK_STALE_MS = 2 * 60 * 1000;
// What git prints when another git process holds the lock it needs.
const LOCKED = /index\.lock|cannot lock ref|Unable to create '[^']*\.lock'|another git process/i;
const FETCH_EVERY_MS = 60 * 1000;
const gitDirOf = async (dir) => {
  const d = await tryGit(dir, ['rev-parse', '--absolute-git-dir']);
  return d || null;
};

/** Takes the clone's sync lock; returns its release, or null when another pull holds it or git is busy. */
export async function lock(dir) {
  const gd = await gitDirOf(dir);
  if (!gd) return () => {};
  if (existsSync(join(gd, 'index.lock'))) return null;
  const path = join(gd, 'workspace-sync.lock');
  try { mkdirSync(path); } catch {
    try { if (Date.now() - statSync(path).mtimeMs < LOCK_STALE_MS) return null; } catch { return null; }
    try { rmdirSync(path); mkdirSync(path); } catch { return null; }
  }
  return () => { try { rmdirSync(path); } catch { /* gone */ } };
}

const stampFile = async (dir, name) => { const gd = await gitDirOf(dir); return gd ? join(gd, name) : null; };
async function fetchedRecently(dir, now = Date.now()) {
  const f = await stampFile(dir, 'workspace-sync.fetched');
  try { return f && now - Number(readFileSync(f, 'utf8')) < FETCH_EVERY_MS; } catch { return false; }
}
async function markFetched(dir, now = Date.now()) {
  const f = await stampFile(dir, 'workspace-sync.fetched');
  try { if (f) writeFileSync(f, String(now)); } catch { /* read-only */ }
}

/** Fetches, and fast-forwards when decide() allows it. Says where the clone stands after. */
export async function syncRepo(dir, n = neighbour(dir, { self: true }), { fetch = true } = {}) {
  const found = await inspect(dir, { fetch });
  if (fetch && found.state !== 'unreachable') await markFetched(dir);
  if (!found.merge) return found;
  try {
    const before = await git(dir, ['rev-parse', 'HEAD']);
    await git(dir, ['merge', '--quiet', '--ff-only', `origin/${found.defaultBranch}`]);
    const trailers = await retroactive(dir, `${before}..HEAD`, n);
    return {
      ...found, state: 'updated', merge: false, detail: `pulled ${commits(found.behind, 'new ')}`,
      retroactive: trailers ?? [], trailersWithheld: trailers === null,
    };
  } catch (e) {
    // An untracked file where a new commit adds one, or another session's git holding the
    // index: git refuses, and the clone is exactly as it was. A lock held by someone else's
    // pull (a hook of another tool firing at the same prompt) is no refusal: the clone is busy.
    if (LOCKED.test(String(e.stderr))) return { ...found, state: 'busy', merge: false, detail: 'another git command is running in it' };
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

/** One status, sync or prompt-time pull over every target, in parallel. */
export async function run(root, { command = 'status', fetch = true, siblings = false } = {}) {
  const { repos, missing } = await targets(root, { siblings });
  const results = await Promise.all(repos.map(async (r) => {
    const n = neighbour(r.dir, { self: r.dir === root });
    if (n.level === 'none') {
      return { ...r, consent: 'none', state: 'not-read', merge: false, detail: `declares none in ${CONSENT_FILE}, so it is not touched from here` };
    }
    if (command === 'status') return { ...r, consent: n.level, ...await inspect(r.dir, { fetch }) };
    const release = await lock(r.dir);
    if (!release) return { ...r, consent: n.level, state: 'busy', merge: false, detail: 'another pull or git command is running in it' };
    try {
      const again = command === 'sync' || !(await fetchedRecently(r.dir));
      return { ...r, consent: n.level, ...await syncRepo(r.dir, n, { fetch: again }) };
    } finally { release(); }
  }));
  return { root, command, fetched: command !== 'status' || fetch, at: new Date().toISOString(), repos: results, missing };
}

/**
 * What the prompt-time pull tells the agent: the commits pulled and their trailers, and why a
 * clone could not be pulled, each said once until the situation changes. `said` maps a clone to
 * what was last said about it, and is updated. Empty when there is nothing new.
 */
export function promptReport(result, said = {}) {
  const out = [];
  for (const r of result.repos) {
    if (r.state === 'updated') {
      out.push(`git (${r.name}): pulled ${r.detail.replace(/^pulled /, '')} just now. Work from what is there now, and reread a file you read before this message.`);
      for (const x of r.retroactive || []) out.push(`• ${r.name} ${x.sha.slice(0, 8)} ${x.subject}: ${x.sweep}. Fix the existing files it names.`);
      delete said[r.dir];
      continue;
    }
    // Only a clone with new commits it could not take is worth a word, and once per situation.
    const blocked = ['local-changes', 'diverged', 'refused'].includes(r.state) || (r.state === 'other-branch' && r.behind > 0);
    if (!blocked) { if (r.state !== 'busy') delete said[r.dir]; continue; }
    const line = `git (${r.name}): ${r.detail}, so nothing was pulled.${ADVICE[r.state] ? ` ${ADVICE[r.state]}` : ''}`;
    if (said[r.dir] === line) continue;
    said[r.dir] = line;
    out.push(line);
  }
  return out.join('\n');
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
  const current = result.repos.filter((r) => !ATTENTION.has(r.state) && r.state !== 'not-read');
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
  // A repo at `counts` was pulled without its messages being read: its trailers, if any,
  // can only be seen from a session opened in it.
  for (const r of result.repos.filter((x) => x.trailersWithheld)) {
    out.push(`• ${r.name}: pulled, and it declares counts in ${CONSENT_FILE}, so its Retroactive: trailers are not read from here. A session opened in it applies them.`);
  }
  const sweeps = result.repos.flatMap((r) => (r.retroactive || []).map((x) => ({ name: r.name, ...x })));
  if (sweeps.length) {
    out.push('Rules just pulled that apply to what already exists (Retroactive: trailers):');
    for (const x of sweeps) out.push(`• ${x.name} ${x.sha.slice(0, 8)} ${x.subject}: ${x.sweep}`);
    out.push('Find the existing files each one names and fix them now; name anything bigger to the owner with its scope.');
  }
  return out.join('\n');
}

/** The warning for a machine whose git has no identity of its own, or null. */
export async function identityWarning(root) {
  const email = (await tryGit(root, ['config', 'user.email'])) || '';
  if (email && !/@[^@]*\.(local|home|lan|localdomain|internal)$/i.test(email)) return null;
  return '▲ Git has no identity on this machine: commits go out signed with the computer\'s name, tied to no account. ' +
    'Ask the owner for the name and address their GitHub account uses, then set them once: ' +
    '`git config --global user.name "<name>"` and `git config --global user.email "<address>"`.';
}

/**
 * The workspace's own files that install-workspace.mjs would write or refresh, as one line, or
 * null. A copy of this script with no installer beside it says nothing.
 */
export async function workspaceNotice(root) {
  const installer = join(dirname(fileURLToPath(import.meta.url)), 'install-workspace.mjs');
  if (!existsSync(installer)) return null;
  let steps;
  try { steps = (await import(pathToFileURL(installer).href)).plan({ routerDir: root }); } catch { return null; }
  const due = steps.filter((s) => ['missing', 'stale', 'partial', 'orphan'].includes(s.state));
  if (!due.length) return null;
  const what = [...new Set(due.map((s) => (s.kind === 'relay' ? '.claude/skills' : s.kind === 'pre-push' ? `the pre-push check of ${s.repo}` : s.target)))];
  return `▲ The workspace's own files are missing or out of date (${what.join(', ')}): run ` +
    `\`node ${basename(root)}/scripts/install-workspace.mjs\` from ${dirname(root)}. It rewrites only what it wrote, ` +
    'and a session started after it runs the router\'s current hooks and offers its current skills.';
}

const MARK = { busy: '·', 'not-read': '·', 'up-to-date': '✓', updated: '✓', behind: '↓', ahead: '↑', 'other-branch': '▲', diverged: '▲', 'local-changes': '▲', 'no-remote': '·', 'not-fetched': '·', unreachable: '✘', unreadable: '✘', refused: '✘' };

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

/**
 * The machine's own settings, after the pull: lib/local-migrations.mjs is imported only now, so a
 * migration that arrived with this very pull runs in this session rather than the next. Returns the
 * lines for the agent: what was updated, and what waits on this machine (routines to install, a
 * backfill to start or resume). A failure here never fails the sync.
 */
export async function machineSettings(root) {
  try {
    const lm = await import(pathToFileURL(join(root, 'lib', 'local-migrations.mjs')).href);
    const migrations = [...lm.KIT_MIGRATIONS, ...await lm.instanceMigrations(root)];
    const text = lm.summary(lm.migrate(root, { migrations }));
    return [...(text ? [text] : []), ...lm.pending(root)];
  } catch (e) {
    return [`Machine settings: not checked (${e.message.split('\n')[0]}).`];
  }
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  const [command = 'status', ...rest] = process.argv.slice(2);
  const flags = new Set(rest);
  if (!['status', 'sync', 'prompt'].includes(command)) {
    console.error('Usage: node scripts/workspace-sync.mjs status [--json] [--offline] [--siblings]\n' +
      '       node scripts/workspace-sync.mjs sync [--json] [--quiet] [--siblings]\n' +
      '       node scripts/workspace-sync.mjs prompt [--siblings]');
    process.exit(1);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (command === 'prompt') {
    // A hook before each message never holds the person up and never fails: whatever happens, exit 0.
    try {
      const result = await run(root, { command: 'prompt', siblings: flags.has('--siblings') });
      const file = await stampFile(root, 'workspace-sync.said.json');
      let said = {};
      try { said = JSON.parse(readFileSync(file, 'utf8')); } catch { /* first prompt */ }
      const text = promptReport(result, said);
      try { if (file) writeFileSync(file, JSON.stringify(said)); } catch { /* read-only */ }
      if (text) console.log(text);
    } catch { /* nothing pulled this time */ }
    process.exit(0);
  }
  const result = await run(root, { command, fetch: !flags.has('--offline'), siblings: flags.has('--siblings') });
  if (flags.has('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    const text = command === 'sync' ? syncReport(result, { quiet: flags.has('--quiet') }) : statusReport(result);
    if (text) console.log(text);
    const warning = command === 'sync' ? await identityWarning(root) : null;
    if (warning) console.log(warning);
    const notice = command === 'sync' && flags.has('--siblings') ? await workspaceNotice(root) : null;
    if (notice) console.log(notice);
    if (command === 'sync') for (const line of await machineSettings(root)) console.log(line);
  }
  const failed = command === 'sync' && result.repos.some((r) => FAILED.has(r.state));
  process.exit(failed && !flags.has('--quiet') ? 1 : 0);
}
