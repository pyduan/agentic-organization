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
// This script gives the parent folder, from docs/workspace/ with this repo's folder name filled in:
//   <parent>/CLAUDE.md               sends the agent to this repo's CLAUDE.md (an @import)
//   <parent>/.claude/settings.json   runs this repo's hooks from the parent folder:
//                                    SessionStart  own-changes (baseline), workspace-sync (clones,
//                                                  git identity), kit-news, open-decisions
//                                    PreToolUse    send-guard
//                                    Stop          session-end, turn-check
//
//   node scripts/install-workspace.mjs           write what is missing, add the hooks a settings file lacks
//   node scripts/install-workspace.mjs --check   say what is missing or out of date; change nothing
//
// A file exactly as some earlier version of the template rendered it is ours, and is refreshed.
// A CLAUDE.md someone wrote is left alone; it is enough that it imports this repo's. A
// settings.json someone wrote gets the hooks it lacks, by script name, and loses only the hooks
// pointing at a file this repo retired; everything else in it stays. One that is not valid
// JSON is reported, never rewritten. It refuses the home folder (~/.claude/settings.json there
// is the user's own settings, loaded by every session on the machine) and a parent folder that
// is itself in a repo.
//
// The hooks run in exec form (`node` with its arguments, no shell), so the same file works on
// macOS, Linux and Windows. Zero dependencies, Node built-ins and git.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
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
const hookText = (h) => [h?.command, ...(Array.isArray(h?.args) ? h.args : [])].map((x) => String(x ?? '')).join(' ');

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

/** The hooks a rendered settings template wires, as { event, matcher, hook, script }. */
export function kitHooks(settings) {
  const out = [];
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    for (const g of groups) {
      for (const hook of g.hooks ?? []) {
        const script = (hookText(hook).match(/([\w.-]+\.(?:mjs|js|cjs|sh))\b/) || [])[1];
        if (script) out.push({ event, matcher: g.matcher, hook, script });
      }
    }
  }
  return out;
}

/** The kit hooks a settings object lacks, by script name, wherever in that event it is wired. */
export function lacking(settings, kit) {
  const has = (event, script) => (settings?.hooks?.[event] ?? [])
    .some((g) => (g?.hooks ?? []).some((h) => hookText(h).includes(script)));
  return kit.filter((k) => !has(k.event, k.script));
}

/** Files of the router a hook runs, read from its command and arguments. */
const routerFiles = (hook, router) => [...hookText(hook).matchAll(new RegExp(`CLAUDE_PROJECT_DIR\\}?[/\\\\]${router.replace(/[.]/g, '\\.')}/([^"'\\s]+)`, 'g'))].map((m) => m[1]);

/**
 * `settings` with the hooks pointing at a file the router no longer has taken out, and the kit
 * hooks it lacks added, grouped by event and matcher. Returns { settings, added, removed }.
 */
export function merge(settings, kit, { router, routerDir }) {
  const out = structuredClone(settings);
  out.hooks ??= {};
  const removed = [];
  const wired = new Set(kit.map((k) => k.script));
  for (const [event, groups] of Object.entries(out.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      if (!Array.isArray(g?.hooks)) continue;
      g.hooks = g.hooks.filter((h) => {
        // A file the template still wires is missing here by accident, not retired: keep its hook.
        const gone = routerFiles(h, router).find((f) => !existsSync(join(routerDir, f)) && !wired.has(basename(f)));
        if (gone) removed.push(`${event} ${basename(gone)}`);
        return !gone;
      });
    }
    out.hooks[event] = groups.filter((g) => !Array.isArray(g?.hooks) || g.hooks.length);
    if (!out.hooks[event].length) delete out.hooks[event];
  }
  const added = lacking(out, kit);
  const groups = new Map();
  for (const k of added) {
    const key = `${k.event}|${k.matcher ?? ''}`;
    if (!groups.has(key)) {
      const group = k.matcher ? { matcher: k.matcher, hooks: [] } : { hooks: [] };
      (out.hooks[k.event] ??= []).push(group);
      groups.set(key, group);
    }
    groups.get(key).hooks.push(structuredClone(k.hook));
  }
  return { settings: out, added: added.map((k) => `${k.event} ${k.script}`), removed };
}

/**
 * What would change, without changing it. Each step is { target, path, want, state, lacks? },
 * state being missing, current, stale (an earlier rendering of ours), partial (a settings file
 * that can take the hooks it lacks) or different (a file this script will not touch).
 */
export function plan({ routerDir, home = homedir() }) {
  const router = basename(real(routerDir));
  const workspace = dirname(real(routerDir));
  if (!/^[A-Za-z0-9._-]+$/.test(router)) {
    throw new Stop(`This repo's folder is called "${router}". The workspace files name it in an import and in hook paths, so keep it to letters, digits, dots, dashes and underscores, then rerun.`);
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
    const step = { template, target, path, want };
    if (!existsSync(path)) return { ...step, state: 'missing' };
    const have = readFileSync(path, 'utf8');
    if (have === want) return { ...step, state: 'current' };
    if (pastVersions(routerDir, template).some((t) => render(t, router) === have)) return { ...step, state: 'stale' };
    if (target === 'CLAUDE.md') {
      return have.includes(`@${router}/CLAUDE.md`) ? { ...step, state: 'current' }
        : { ...step, state: 'different', lacks: `a line @${router}/CLAUDE.md, which imports this repo's manual` };
    }
    let parsed = null;
    try { parsed = JSON.parse(have); } catch { /* reported below */ }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...step, state: 'different', lacks: 'valid JSON, so the hooks cannot be added to it' };
    }
    const { settings, added, removed } = merge(parsed, kitHooks(JSON.parse(want)), { router, routerDir });
    if (!added.length && !removed.length) return { ...step, state: 'current' };
    return {
      ...step, state: 'partial', want: `${JSON.stringify(settings, null, 2)}\n`,
      lacks: [added.length ? added.join(', ') : '', removed.length ? `drop ${removed.join(', ')} (no longer in this repo)` : ''].filter(Boolean).join('; '),
    };
  });
}

/** Writes what is missing or ours to refresh, and adds the hooks a settings file lacks. Never touches anything else. */
export function apply(steps) {
  const written = [];
  for (const s of steps) {
    if (!['missing', 'stale', 'partial'].includes(s.state)) continue;
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
  const check = process.argv.includes('--check');
  const routerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let steps;
  try { steps = plan({ routerDir }); } catch (e) {
    if (e instanceof Stop) { console.error(e.message); process.exit(1); }
    throw e;
  }
  const written = check ? [] : apply(steps);
  for (const s of steps) {
    const done = written.includes(s);
    if (done && s.state === 'partial') console.log(`  ✓ ${s.path}: ${s.lacks}`);
    else if (done) console.log(`  ✓ wrote ${s.path}`);
    else if (s.state === 'current') console.log(`  ✓ ${s.target} in place`);
    else if (s.state === 'missing') console.log(`  ▲ ${s.target} missing`);
    else if (s.state === 'stale') console.log(`  ▲ ${s.target} out of date`);
    else if (s.state === 'partial') console.log(`  ▲ ${s.target} lacks ${s.lacks}`);
    else console.log(`  ▲ ${s.path} exists and lacks ${s.lacks}. It is someone's file: add that by hand, from ${s.template}.`);
  }
  if (written.length) {
    console.log(`\nOpen the agent on ${dirname(real(routerDir))} and say "check my setup": the session-start hooks line turns green once they have run there. A start with every clone current says nothing about them, since the sync runs quiet.`);
  }
  const left = steps.filter((s) => s.state !== 'current' && !written.includes(s));
  process.exit(left.length ? 1 : 0);
}
