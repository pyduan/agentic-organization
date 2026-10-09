#!/usr/bin/env node
// Make the folder that holds this repo and its neighbours a place the guards follow into.
//
// QUICKSTART and SETUP tell everyone to open the agent on the parent folder (~/Projects,
// repos side by side), and that is right: it is what lets one session read across repos.
// But Claude Code loads hooks from the .claude/settings.json of the folder it was opened
// on, and the parent folder has none. The send guard, the turn check and the
// end-of-session check then never run, and nothing says so, because a guard that is not
// loaded leaves no trace. A live organization set up from this kit found it out and had
// to give its parent folder a hand-made copy.
//
// This script writes that copy, from docs/workspace/, with this repo's folder name filled in:
//   <parent>/CLAUDE.md               sends the agent to this repo's CLAUDE.md (an @import)
//   <parent>/.claude/settings.json   runs this repo's hooks from the parent folder
//
//   node scripts/install-workspace.mjs            write what is missing, refresh what it wrote before
//   node scripts/install-workspace.mjs --check    say what is missing or out of date; change nothing
//   node scripts/install-workspace.mjs --replace  also take over a file someone else wrote,
//                                                 after moving it aside (<name>.before-workspace)
//
// A file is refreshed only if it is exactly what some earlier version of the template
// produced; anything else is someone's work and is left alone unless --replace says so.
// It refuses the home folder (~/.claude/settings.json there is the user's own settings,
// loaded by every session on the machine) and a parent folder that is itself in a repo.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export class Stop extends Error {}

export const FILES = [
  { template: 'docs/workspace/CLAUDE.md', target: 'CLAUDE.md' },
  { template: 'docs/workspace/settings.json', target: '.claude/settings.json' },
];

export const render = (text, router) => text.split('{{ROUTER}}').join(router);

const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

/** Every version of a template this repo ever committed, newest first. */
function pastVersions(routerDir, template) {
  const opts = { cwd: routerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
  let commits = [];
  try { commits = execFileSync('git', ['log', '--format=%H', '--', template], opts).split('\n').filter(Boolean); } catch { return []; }
  const out = [];
  for (const c of commits) {
    try { out.push(execFileSync('git', ['show', `${c}:${template}`], opts)); } catch { /* deleted in that commit */ }
  }
  return out;
}

function insideRepo(dir) {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: dir, stdio: 'ignore' });
    return true;
  } catch { return false; }
}

/**
 * What would change, without changing it. Each step is { target, path, want, state }, state
 * being missing, current, stale (an earlier rendering of ours) or different (someone's work).
 */
export function plan({ routerDir, home = homedir() }) {
  const router = basename(real(routerDir));
  const workspace = dirname(real(routerDir));
  if (!/^[A-Za-z0-9._-]+$/.test(router)) {
    throw new Stop(`This repo's folder is called "${router}". The workspace files name it in an import and in shell commands, so keep it to letters, digits, dots, dashes and underscores, then rerun.`);
  }
  if (workspace === real(home)) {
    throw new Stop('This repo sits directly in your home folder, so its parent is your home folder, and .claude/settings.json there is your own settings file for every session on this machine. Move the repos into one folder of their own (~/Projects, side by side), then rerun from there.');
  }
  if (insideRepo(workspace)) {
    throw new Stop(`${workspace} is itself inside a git repo, so it is not a workspace folder: the repos should sit side by side in a plain folder, never nested.`);
  }
  return FILES.map(({ template, target }) => {
    const want = render(readFileSync(join(routerDir, template), 'utf8'), router);
    const path = join(workspace, target);
    if (!existsSync(path)) return { template, target, path, want, state: 'missing' };
    const have = readFileSync(path, 'utf8');
    if (have === want) return { template, target, path, want, state: 'current' };
    const ours = pastVersions(routerDir, template).some((t) => render(t, router) === have);
    return { template, target, path, want, state: ours ? 'stale' : 'different' };
  });
}

/** Write the steps that need it. A different file is touched only with replace, and moved aside first. */
export function apply(steps, { replace = false } = {}) {
  const written = [];
  for (const s of steps) {
    if (s.state === 'current' || (s.state === 'different' && !replace)) continue;
    if (s.state === 'different') {
      let aside = `${s.path}.before-workspace`;
      for (let i = 2; existsSync(aside); i++) aside = `${s.path}.before-workspace-${i}`;
      renameSync(s.path, aside);
      s.movedTo = aside;
    }
    mkdirSync(dirname(s.path), { recursive: true });
    writeFileSync(s.path, s.want);
    written.push(s);
  }
  return written;
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const routerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let steps;
  try { steps = plan({ routerDir }); } catch (e) {
    if (e instanceof Stop) { console.error(e.message); process.exit(1); }
    throw e;
  }
  const workspace = dirname(real(routerDir));
  const label = { missing: 'missing', current: 'in place', stale: 'out of date', different: 'written by someone else' };
  for (const s of steps) console.log(`  ${s.target.padEnd(22)} ${label[s.state]}`);
  const blocked = steps.filter((s) => s.state === 'different');
  if (args.has('--check')) process.exit(steps.every((s) => s.state === 'current') ? 0 : 1);
  if (blocked.length && !args.has('--replace')) {
    for (const s of blocked) {
      console.error(`\n${s.path} exists and is not a file this script wrote. Compare it with ${s.template}, carry over anything of yours into the router, then rerun with --replace: it is moved aside to ${s.target}.before-workspace, never deleted.`);
    }
  }
  const written = apply(steps, { replace: args.has('--replace') });
  for (const s of written) console.log(`✓ wrote ${s.path}${s.movedTo ? ` (the previous one is ${s.movedTo})` : ''}`);
  if (written.length) {
    console.log(`\nOpen the agent on ${workspace}. Its first lines should now read "Workspace: N repo(s) up to date."; if they do not, the guards are not loaded there.`);
  }
  process.exit(blocked.length && !args.has('--replace') ? 1 : 0);
}
