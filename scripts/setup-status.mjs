#!/usr/bin/env node
// Is this machine set up the way the kit expects? One answer, from the checks that exist.
//
// Each piece of a setup already has its own check: the map (check-workspace), what
// instructs the agent from outside the repo (check-conflicts), the workspace folder's
// guards (install-workspace --check), the kit version (what kit-news announces), the
// clones (workspace-sync). Nobody runs five scripts to find out why their agent behaves
// oddly, so this runs them all and gives one line each, green, orange or red, with the
// fix beside it. The `check-setup` skill reads it to the owner; an app could too, which
// is why `--json` is a contract and not a debug dump.
//
// It changes nothing: every fix is a separate command, named in the report.
//
//   node scripts/setup-status.mjs            the table
//   node scripts/setup-status.mjs --json     the same, for a skill or an app
//   node scripts/setup-status.mjs --offline  no fetch, no network check
//
// Exit 1 when a check is red, 0 otherwise. Zero dependencies, Node built-ins and git.

import { execFile } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTemplateSlug, originSlug } from '../lib/workspace.mjs';
import { ATTENTION, run as repoStatus } from './workspace-sync.mjs';
import { plan as workspacePlan, Stop } from './install-workspace.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIN_NODE = 18;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function exec(cmd, args, { cwd, timeout = 15_000 } = {}) {
  return new Promise((ok) => {
    execFile(cmd, args, {
      cwd, timeout, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (error, stdout, stderr) => ok({
      code: error ? (typeof error.code === 'number' ? error.code : -1) : 0,
      missing: error?.code === 'ENOENT', killed: Boolean(error?.killed),
      stdout: String(stdout || '').trim(), stderr: String(stderr || '').trim(),
    }));
  });
}
const gitOut = async (root, args, timeout) => {
  const r = await exec('git', ['-C', root, ...args], { timeout });
  return r.code === 0 ? r.stdout : null;
};

const ok = (detail, fix = null) => ({ level: 'ok', detail, fix });
const warn = (detail, fix = null) => ({ level: 'warn', detail, fix });
const fail = (detail, fix = null) => ({ level: 'fail', detail, fix });
const info = (detail) => ({ level: 'info', detail, fix: null });

// ---------------------------------------------------------------- the checks

async function tools() {
  const g = await exec('git', ['--version']);
  if (g.missing || g.code !== 0) return fail('git is not installed', 'QUICKSTART ▸ Install, in one paste');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < MIN_NODE) return fail(`Node ${process.versions.node} is too old (the scripts need ${MIN_NODE} or later)`, 'install a current Node (QUICKSTART ▸ Install, in one paste)');
  return ok(`${g.stdout.replace(/^git version /, 'git ')}, Node ${process.versions.node}`);
}

async function github() {
  const r = await exec('gh', ['auth', 'status']);
  if (r.missing) return warn('the GitHub CLI is not installed: creating and cloning private repos goes through it', 'QUICKSTART ▸ Install, in one paste');
  if (r.killed) return warn('GitHub did not answer in time, so the login could not be checked');
  if (r.code !== 0) return fail('not logged into GitHub: pushes and clones of private repos will fail', 'gh auth login --web (a browser window, one click)');
  const who = `${r.stdout}\n${r.stderr}`.match(/account\s+(\S+)/i) || `${r.stdout}\n${r.stderr}`.match(/as\s+(\S+)/i);
  return ok(who ? `logged in as ${who[1]}` : 'logged in');
}

async function identity(root) {
  const email = (await gitOut(root, ['config', 'user.email'])) || '';
  const name = (await gitOut(root, ['config', 'user.name'])) || '';
  // The same test as the workspace hook: an address git made up from the computer's name.
  if (!email || /@[^@]*\.(local|home|lan|localdomain|internal)$/i.test(email)) {
    return fail('git has no identity here: commits go out signed with the computer\'s name, tied to no account',
      'git config --global user.name "…" and user.email "…" (docs/troubleshooting.md ▸ Commits signed with the computer\'s name)');
  }
  return ok(`commits are signed ${name ? `${name} <${email}>` : email}`);
}

async function map(root) {
  const r = await exec(process.execPath, [join(HERE, 'check-workspace.mjs'), '--json', '--offline'], { cwd: root, timeout: 60_000 });
  let j;
  try { j = JSON.parse(r.stdout); } catch { return warn('check-workspace did not run', 'node scripts/check-workspace.mjs'); }
  const first = (sev) => j.findings.find((f) => f.severity === sev);
  const found = j.repos.filter((x) => x.dir).length;
  const summary = `${j.repos.length} repo(s) on the map, ${found} found on this machine`;
  if (j.fails) return fail(`${summary}; ${first('fail').what}: ${first('fail').detail}`, 'node scripts/check-workspace.mjs');
  if (j.warns) return warn(`${summary}; ${j.warns} warning(s), the first: ${first('warn').what}: ${first('warn').detail}`, 'node scripts/check-workspace.mjs');
  return ok(summary);
}

async function repos(root, { offline }) {
  const r = await repoStatus(root, { command: 'status', fetch: !offline });
  const behind = r.repos.filter((x) => x.state === 'behind');
  const attention = r.repos.filter((x) => ATTENTION.has(x.state));
  const where = offline ? 'as last fetched' : 'fetched just now';
  if (attention.length) {
    return warn(`${attention.map((x) => `${x.name}: ${x.detail}`).join('; ')} (${where})`,
      'node scripts/workspace-sync.mjs status, then deal with each one; never discard changes to do it');
  }
  if (behind.length) {
    return warn(`${behind.map((x) => `${x.name}: ${x.detail}`).join('; ')} (${where})`, 'node scripts/workspace-sync.mjs sync');
  }
  return ok(`${r.repos.length} clone(s) up to date (${where})`);
}

async function guards(root) {
  let steps;
  try { steps = workspacePlan({ routerDir: root }); }
  catch (e) { if (e instanceof Stop) return warn(e.message); throw e; }
  const off = steps.filter((s) => s.state !== 'current');
  if (!off.length) return ok('the folder beside this repo loads its guards (send guard, end-of-session check)');
  if (off.some((s) => s.state === 'different')) {
    return warn(`${off.map((s) => s.target).join(' and ')} in the workspace folder was written by someone else, so a session opened there may skip this repo's guards`,
      'compare it with docs/workspace/, then node scripts/install-workspace.mjs --replace (moves it aside, never deletes)');
  }
  return warn(`a session opened on the workspace folder would run without this repo's guards (${off.map((s) => `${s.target} ${s.state}`).join(', ')})`,
    'node scripts/install-workspace.mjs');
}

async function hooks(root, { template }) {
  if (template) return info('the template itself: kit news stays silent here, so there is no receipt to read');
  const gitDir = await gitOut(root, ['rev-parse', '--absolute-git-dir']);
  let ran = null;
  try { ran = JSON.parse(readFileSync(join(gitDir, 'kit-news-ran'), 'utf8')); } catch { /* never ran */ }
  if (!ran) {
    return warn('the session-start hooks have never run on this clone, so sessions here may not be loading this repo\'s settings',
      'open the agent on this repo, or on the workspace folder after node scripts/install-workspace.mjs');
  }
  if (Date.now() - ran.at > WEEK_MS) return warn(`the session-start hooks last ran on ${ran.day}`, 'if a session was opened since, it did not load this repo\'s settings');
  return ok(`the session-start hooks last ran on ${ran.day}`);
}

async function kit(root, { offline, template }) {
  if (template) return info('the template itself: there is no newer kit to take');
  const remote = process.env.KIT_REMOTE || 'template';
  const ref = `${remote}/${process.env.KIT_BRANCH || 'main'}`;
  if (await gitOut(root, ['remote', 'get-url', remote]) === null) {
    return warn('not wired to the template yet, so kit updates are never announced', 'open one session here: kit news adds the template remote at session start');
  }
  if (!offline) await gitOut(root, ['fetch', '--quiet', remote], 20_000);
  const target = await gitOut(root, ['rev-parse', ref]);
  if (!target) return warn('the template has never been fetched here', `git fetch ${remote}`);
  let base = null;
  try {
    const raw = readFileSync(join(root, '.kit-sync'), 'utf8').trim();
    base = raw.startsWith('{') ? (JSON.parse(raw).sha || null) : ((raw.match(/\b[0-9a-f]{7,40}\b/) || [])[0] || null);
  } catch { /* never synced */ }
  if (!base) return warn('this project has never taken a kit update', 'say "update the kit": the update-kit skill shows what it brings before applying anything');
  if (await gitOut(root, ['cat-file', '-e', `${base}^{commit}`]) === null) {
    return warn(`.kit-sync names ${base.slice(0, 8)}, which this clone does not have`, `git fetch ${remote}`);
  }
  if (base === target) return ok('current with the template');
  const diff = (await gitOut(root, ['diff', '--no-color', `${base}:CHANGELOG.md`, `${ref}:CHANGELOG.md`])) || '';
  const entries = diff.split('\n').filter((l) => l.startsWith('+## ')).length;
  if (!entries) return ok('no announced kit update since the last one taken');
  return warn(`${entries} kit update(s) not taken yet`, 'say "update the kit": the update-kit skill shows what each brings before applying anything');
}

async function conflicts(root) {
  const r = await exec(process.execPath, [join(HERE, 'check-conflicts.mjs'), '--json'], { cwd: root, timeout: 60_000 });
  let j;
  try { j = JSON.parse(r.stdout); } catch { return warn('check-conflicts did not run', 'node scripts/check-conflicts.mjs'); }
  if (!j.findings.length) return ok('nothing outside this repo instructs the agent');
  const kinds = [...new Set(j.findings.map((f) => f.kind))].join(', ');
  const parkable = j.findings.filter((f) => f.parkable).length;
  return warn(`${j.findings.length} thing(s) outside this repo also instruct the agent (${kinds})`,
    parkable ? `node scripts/check-conflicts.mjs --park moves ${parkable} of them aside, reversibly` : 'node scripts/check-conflicts.mjs, and decide on each one');
}

export const CHECKS = [
  { id: 'tools', label: 'Git and Node', run: tools },
  { id: 'github', label: 'GitHub login', run: github },
  { id: 'identity', label: 'Git identity', run: identity },
  { id: 'map', label: 'Repo map', run: map },
  { id: 'repos', label: 'Clones', run: repos },
  { id: 'guards', label: 'Workspace folder', run: guards },
  { id: 'hooks', label: 'Session-start hooks', run: hooks },
  { id: 'kit', label: 'Kit version', run: kit },
  { id: 'conflicts', label: 'Outside instructions', run: conflicts },
];

/** Every check, in parallel. A check that throws is reported as one that could not run. */
export async function setupStatus(root, { offline = false, only = null } = {}) {
  const template = isTemplateSlug((await originSlug(root)) || '');
  const checks = await Promise.all(CHECKS.filter((c) => !only || only.includes(c.id)).map(async (c) => {
    try { return { id: c.id, label: c.label, ...(await c.run(root, { offline, template })) }; }
    catch (e) { return { id: c.id, label: c.label, ...warn(`could not run: ${e.message}`) }; }
  }));
  const count = (level) => checks.filter((c) => c.level === level).length;
  return {
    ok: count('fail') === 0, at: new Date().toISOString(), root, offline,
    green: count('ok'), orange: count('warn'), red: count('fail'), notApplicable: count('info'), checks,
  };
}

const MARK = { ok: '✓', warn: '▲', fail: '✘', info: '·' };

export function report(result) {
  const width = Math.max(...result.checks.map((c) => c.label.length));
  const out = [];
  for (const c of result.checks) {
    out.push(`  ${MARK[c.level]} ${c.label.padEnd(width)}  ${c.detail}`);
    if (c.fix) out.push(`    ${' '.repeat(width)}  → ${c.fix}`);
  }
  out.push(`\n${result.checks.length} check(s): ${result.green} green, ${result.orange} orange, ${result.red} red` +
    `${result.notApplicable ? `, ${result.notApplicable} not applicable here` : ''}.`);
  return out.join('\n');
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const result = await setupStatus(resolve(HERE, '..'), { offline: args.has('--offline') });
  console.log(args.has('--json') ? JSON.stringify(result, null, 2) : report(result));
  process.exit(result.ok ? 0 : 1);
}
