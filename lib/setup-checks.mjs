// The setup checks any kit built on this one can run, whatever its layout.
//
// scripts/setup-status.mjs composes them with the checks only this kit's layout has (the
// map, the workspace folder's guards, the hook receipt, the kit version). A kit laid out
// differently composes the same ones with its own, and imports this file unchanged: its
// fixes name the scripts folder it is given, never a document only one kit ships.
//
// A check is async (root, ctx) → { level, detail, fix }, level being ok, warn, fail or info
// (does not apply here). ctx carries { offline, siblings, scripts }: no network, repos
// beside this one included, and how a fix should name this repo's scripts folder.
//
// Zero dependencies, Node built-ins and git.

import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATTENTION, run as repoStatus } from '../scripts/workspace-sync.mjs';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
// Astro, which builds the sites, needs 22.12; wrangler needs 22.
const MIN_NODE = [22, 12];

export function exec(cmd, args, { cwd, timeout = 15_000 } = {}) {
  return new Promise((done) => {
    execFile(cmd, args, {
      cwd, timeout, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (error, stdout, stderr) => done({
      code: error ? (typeof error.code === 'number' ? error.code : -1) : 0,
      missing: error?.code === 'ENOENT', killed: Boolean(error?.killed),
      stdout: String(stdout || '').trim(), stderr: String(stderr || '').trim(),
    }));
  });
}

export const gitOut = async (root, args, timeout) => {
  const r = await exec('git', ['-C', root, ...args], { timeout });
  return r.code === 0 ? r.stdout : null;
};

export const ok = (detail, fix = null) => ({ level: 'ok', detail, fix });
export const warn = (detail, fix = null) => ({ level: 'warn', detail, fix });
export const fail = (detail, fix = null) => ({ level: 'fail', detail, fix });
export const info = (detail) => ({ level: 'info', detail, fix: null });

const node = (ctx, script, args = '') => `node ${ctx.scripts || 'scripts'}/${script}${args ? ` ${args}` : ''}`;

export async function tools() {
  const g = await exec('git', ['--version']);
  if (g.missing || g.code !== 0) return fail('git is not installed', 'install git, then run this check again');
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
    return fail(`Node ${process.versions.node} is too old (Astro and wrangler need ${MIN_NODE.join('.')} or later)`, 'install Node 24, the current LTS');
  }
  return ok(`${g.stdout.replace(/^git version /, 'git ')}, Node ${process.versions.node}`);
}

export async function github() {
  const r = await exec('gh', ['auth', 'status']);
  if (r.missing) return warn('the GitHub CLI is not installed: creating and cloning private repos goes through it', 'install the GitHub CLI (cli.github.com), then gh auth login --web');
  if (r.killed) return warn('GitHub did not answer in time, so the login could not be checked');
  if (r.code !== 0) return fail('not logged into GitHub: pushes and clones of private repos will fail', 'gh auth login --web (a browser window, one click)');
  const who = `${r.stdout}\n${r.stderr}`.match(/account\s+(\S+)/i) || `${r.stdout}\n${r.stderr}`.match(/as\s+(\S+)/i);
  return ok(who ? `logged in as ${who[1]}` : 'logged in');
}

export async function identity(root) {
  const email = (await gitOut(root, ['config', 'user.email'])) || '';
  const name = (await gitOut(root, ['config', 'user.name'])) || '';
  // The same test as the workspace hook: an address git made up from the computer's name.
  if (!email || /@[^@]*\.(local|home|lan|localdomain|internal)$/i.test(email)) {
    return fail('git has no identity here: commits go out signed with the computer\'s name, tied to no account',
      'git config --global user.name "…" and git config --global user.email "…", the address of the GitHub account');
  }
  return ok(`commits are signed ${name ? `${name} <${email}>` : email}`);
}

export async function repos(root, ctx) {
  const r = await repoStatus(root, { command: 'status', fetch: !ctx.offline, siblings: Boolean(ctx.siblings) });
  const flag = ctx.siblings ? '--siblings' : '';
  const behind = r.repos.filter((x) => x.state === 'behind');
  const attention = r.repos.filter((x) => ATTENTION.has(x.state));
  const where = ctx.offline ? 'as last fetched' : 'fetched just now';
  if (attention.length) {
    return warn(`${attention.map((x) => `${x.name}: ${x.detail}`).join('; ')} (${where})`,
      `${node(ctx, 'workspace-sync.mjs', `status ${flag}`.trim())}, then deal with each one; never discard changes to do it`);
  }
  if (behind.length) {
    return warn(`${behind.map((x) => `${x.name}: ${x.detail}`).join('; ')} (${where})`, node(ctx, 'workspace-sync.mjs', `sync ${flag}`.trim()));
  }
  return ok(`${r.repos.length} clone(s) up to date (${where})`);
}

export async function conflicts(root, ctx) {
  const r = await exec(process.execPath, [join(SCRIPTS, 'check-conflicts.mjs'), '--json'], { cwd: root, timeout: 60_000 });
  let j;
  try { j = JSON.parse(r.stdout); } catch { return warn('check-conflicts did not run', node(ctx, 'check-conflicts.mjs')); }
  if (!j.findings.length) return ok('nothing outside this repo instructs the agent');
  const kinds = [...new Set(j.findings.map((f) => f.kind))].join(', ');
  const parkable = j.findings.filter((f) => f.parkable).length;
  return warn(`${j.findings.length} thing(s) outside this repo also instruct the agent (${kinds})`,
    parkable ? `${node(ctx, 'check-conflicts.mjs', '--park')} moves ${parkable} of them aside, reversibly` : `${node(ctx, 'check-conflicts.mjs')}, and decide on each one`);
}

/** Every check, in parallel. A check that throws is reported as one that could not run. */
export async function runChecks(checks, root, ctx = {}) {
  const rows = await Promise.all(checks.map(async (c) => {
    try { return { id: c.id, label: c.label, ...(await c.run(root, ctx)) }; }
    catch (e) { return { id: c.id, label: c.label, ...warn(`could not run: ${e.message}`) }; }
  }));
  const count = (level) => rows.filter((c) => c.level === level).length;
  return {
    ok: count('fail') === 0, at: new Date().toISOString(), root, offline: Boolean(ctx.offline),
    green: count('ok'), orange: count('warn'), red: count('fail'), notApplicable: count('info'), checks: rows,
  };
}

const MARK = { ok: '✓', warn: '▲', fail: '✘', info: '·' };

/** The table a person reads. The verdict line is counted from the rows, never written ahead. */
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
