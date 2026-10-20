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
//                                                  git identity), kit-news, open-decisions,
//                                                  check-workspace (the map against the disk)
//                                    PreToolUse    send-guard
//                                    Stop          session-end, turn-check
//   <parent>/.claude/skills/<name>/  one relay per skill of this repo and of the repos beside it.
//                                    Claude Code loads the skills of the folder a session opens
//                                    on, and those of a subfolder only once the agent has read a
//                                    file there, so from the parent folder no skill was in the
//                                    / menu and none triggered on its description. A relay
//                                    carries the skill's name and description and sends the
//                                    agent to the real file; the first repo to define a name
//                                    wins, this one first.
//
// And, with --satellites, each repo the map (ORGANIGRAM.md) declares a `satellite` gets
// <satellite>/.claude/settings.json: one hook per event of the workspace template, which finds
// this repo beside the satellite and runs .claude/hooks/satellite.mjs, so a session opened in
// the satellite runs the same hooks as one opened on the parent folder. If this repo is not
// beside it, the session is told so at its start and nothing else happens. That file is in the
// satellite's repo: commit it there.
//
//   node scripts/install-workspace.mjs               write what is missing, add the hooks a settings file lacks
//   node scripts/install-workspace.mjs --satellites  the same, and wire the satellites
//   node scripts/install-workspace.mjs --check       say what is missing or out of date; change nothing
//
// A file exactly as some earlier version of the template rendered it is ours, and is refreshed.
// A CLAUDE.md someone wrote is left alone; it is enough that it imports this repo's. A
// settings.json someone wrote gets the hooks it lacks, by script name, and loses only the hooks
// pointing at a file this repo retired; everything else in it stays. One that is not valid
// JSON is reported, never rewritten. A skill folder in the parent that is not a relay is
// someone's own and is never touched; a relay whose skill is gone is removed. It refuses the
// home folder (~/.claude/settings.json there is the user's own settings, loaded by every
// session on the machine) and a parent folder that is itself in a repo.
//
// The hooks run in exec form (`node` with its arguments, no shell), so the same file works on
// macOS, Linux and Windows. Zero dependencies, Node built-ins and git.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
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

// ------------------------------------------------------------------ skill relays

// The marker every relay carries: a skill folder without it is someone's own, never touched.
export const RELAY = 'Relay written by';
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
// A repo of its own: `.git` is a folder. A linked worktree beside the router is a second checkout
// of some repo, and relaying its skills would offer each one twice.
const isRepo = (dir) => isDir(join(dir, '.git'));

/** A relay for one skill: its front matter, then where the real file is and what its paths mean. */
export function relayText(source, { name, from, base, writer }) {
  const m = String(source).match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  const front = m ? m[1] : `name: ${name}`;
  return `---\n${front}\n---\n<!-- ${RELAY} ${writer}: rerun it after a change, never edit this file. -->\n\n` +
    `This skill lives in \`${from}\`. Read that file whole and follow it. This copy only makes it reachable ` +
    'from a session opened on the folder that holds the repos, where Claude Code does not look inside them ' +
    `for skills. Every path that file names is relative to \`${base}/\`.\n`;
}

/** The skills to relay into the workspace: this repo's first, then each repo beside it, by folder name. */
export function skillSources(routerDir) {
  const dir = real(routerDir);
  const router = basename(dir);
  const workspace = dirname(dir);
  let others = [];
  try { others = readdirSync(workspace).filter((n) => n !== router && !n.startsWith('.') && isRepo(join(workspace, n))).sort(); } catch { /* unreadable */ }
  const out = new Map();
  for (const repo of [router, ...others]) {
    const skills = join(workspace, repo, '.claude', 'skills');
    let names = [];
    try { names = readdirSync(skills).filter((n) => !n.startsWith('.')).sort(); } catch { continue; }
    for (const name of names) {
      const file = join(skills, name, 'SKILL.md');
      if (out.has(name) || !existsSync(file)) continue;
      out.set(name, { repo, name, text: readFileSync(file, 'utf8') });
    }
  }
  return [...out.values()];
}

function relaySteps(routerDir) {
  const dir = real(routerDir);
  const router = basename(dir);
  const workspace = dirname(dir);
  const writer = `${router}/scripts/install-workspace.mjs`;
  const sources = skillSources(dir);
  const steps = sources.map(({ repo, name, text }) => {
    const target = `.claude/skills/${name}/SKILL.md`;
    const path = join(workspace, target);
    const want = relayText(text, { name, from: `${repo}/.claude/skills/${name}/SKILL.md`, base: repo, writer });
    const step = { kind: 'relay', template: `${repo}/.claude/skills/${name}/SKILL.md`, target, path, want };
    if (!existsSync(path)) return { ...step, state: 'missing' };
    const have = readFileSync(path, 'utf8');
    if (have === want) return { ...step, state: 'current' };
    if (have.includes(RELAY)) return { ...step, state: 'stale' };
    return { ...step, state: 'different', lacks: 'its own skill of that name, which is left as it is' };
  });
  // A relay whose skill is gone is removed: it would send the agent to a file that is not there.
  const wanted = new Set(sources.map((s) => s.name));
  let present = [];
  try { present = readdirSync(join(workspace, '.claude', 'skills')); } catch { /* none yet */ }
  for (const name of present.filter((n) => !wanted.has(n)).sort()) {
    const path = join(workspace, '.claude', 'skills', name, 'SKILL.md');
    let have = '';
    try { have = readFileSync(path, 'utf8'); } catch { continue; }
    if (have.includes(RELAY)) steps.push({ kind: 'relay', template: null, target: `.claude/skills/${name}/SKILL.md`, path, want: null, state: 'orphan' });
  }
  return steps;
}

/**
 * What would change, without changing it. Each step is { target, path, want, state, lacks? },
 * state being missing, current, stale (an earlier rendering of ours), partial (a settings file
 * that can take the hooks it lacks), different (a file this script will not touch) or orphan (a
 * relay whose skill is gone).
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
  const files = FILES.map(({ template, target }) => {
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
  return [...files, ...relaySteps(routerDir)];
}

// ------------------------------------------------------------------ satellites

// What a satellite's hook runs: find the router beside the satellite by its folder name, else any
// folder beside it that carries .claude/hooks/satellite.mjs (a clone under an older name), and run
// that file for the event. Without one, say so at session start and stop there: a hook that fails
// on a missing file would print an error on every tool call, and a person who cloned only the
// satellite would learn nothing from it. Plain CommonJS for `node -e`, no double quote, so it
// survives JSON and Windows quoting unchanged.
export const BOOT = [
  'const [d, n, ...a] = process.argv.slice(1);',
  "const p = require('path'), f = require('fs'), c = require('child_process');",
  "const w = p.dirname(p.resolve(d)), h = p.join('.claude', 'hooks', 'satellite.mjs');",
  'let r = p.join(w, n);',
  'if (!f.existsSync(p.join(r, h))) { try { r = f.readdirSync(w).map((x) => p.join(w, x)).find((x) => f.existsSync(p.join(x, h))); } catch { r = undefined; } }',
  'if (!r) {',
  "  if (a[0] === 'SessionStart') {",
  "    let u = '';",
  "    try { u = ' (git clone ' + c.execFileSync('git', ['-C', d, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim().replace(/[^/:]+$/, n) + ')'; } catch {}",
  "    console.log('Router missing: ' + n + ' is not beside this repo, in ' + w + ', so this session runs none of its hooks: no pull at the start, no send guard, no end-of-session check. Clone it there' + u + ', then start a new session.');",
  '  }',
  '  process.exit(0);',
  '}',
  "const k = c.spawnSync(process.execPath, [p.join(r, h), ...a], { stdio: 'inherit' });",
  'process.exit(k.status === null ? 0 : k.status);',
].join(' ');

const isBoot = (h) => h?.command === 'node' && Array.isArray(h.args) && h.args[0] === '-e' && String(h.args[1] ?? '').includes('satellite.mjs');
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** A satellite's settings: the workspace template's permissions, and one relay hook per event and matcher. */
export function satelliteSettings(template, router) {
  const out = {};
  if (template.permissions) out.permissions = structuredClone(template.permissions);
  out.hooks = {};
  for (const [event, groups] of Object.entries(template.hooks ?? {})) {
    const matchers = [...new Set((groups ?? []).map((g) => g?.matcher ?? ''))];
    out.hooks[event] = matchers.map((m) => ({
      ...(m ? { matcher: m } : {}),
      hooks: [{ type: 'command', command: 'node', args: ['-e', BOOT, '${CLAUDE_PROJECT_DIR}', router, event, ...(m ? [m] : [])] }],
    }));
  }
  return out;
}

/** `have` with the relay hooks of `want` put in or brought up to date, everything else kept. */
export function mergeSatellite(have, want) {
  const out = structuredClone(have);
  out.hooks = out.hooks && typeof out.hooks === 'object' ? out.hooks : {};
  const added = [];
  const keep = new Set();
  for (const [event, groups] of Object.entries(want.hooks)) {
    for (const g of groups) {
      const m = g.matcher ?? '';
      keep.add(`${event}|${m}`);
      const list = Array.isArray(out.hooks[event]) ? out.hooks[event] : (out.hooks[event] = []);
      let found = false;
      for (const og of list) {
        if ((og?.matcher ?? '') !== m || !Array.isArray(og.hooks)) continue;
        og.hooks = og.hooks.map((h) => {
          if (!isBoot(h)) return h;
          found = true;
          return structuredClone(g.hooks[0]);
        });
      }
      if (!found) { list.push(structuredClone(g)); added.push(`${event}${m ? ` ${m}` : ''}`); }
    }
  }
  // A relay hook for an event the template no longer wires comes out.
  for (const [event, groups] of Object.entries(out.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      if (Array.isArray(g?.hooks) && !keep.has(`${event}|${g.matcher ?? ''}`)) g.hooks = g.hooks.filter((h) => !isBoot(h));
    }
    out.hooks[event] = groups.filter((g) => !Array.isArray(g?.hooks) || g.hooks.length);
    if (!out.hooks[event].length) delete out.hooks[event];
  }
  return { settings: out, added };
}

/** Whether a settings object holds nothing but what satelliteSettings() would write: then it is ours to refresh. */
const ours = (have, want) => Object.keys(have).every((k) => ['permissions', 'hooks'].includes(k))
  && (have.permissions === undefined || sameJson(have.permissions, want.permissions))
  && Object.values(have.hooks ?? {}).every((gs) => Array.isArray(gs) && gs.every((g) => Array.isArray(g?.hooks) && g.hooks.every(isBoot)));

/**
 * The satellites of the map found on this machine, and what their .claude/settings.json needs:
 * steps shaped like plan()'s, with `repo` added.
 */
export async function planSatellites({ routerDir }) {
  const dir = real(routerDir);
  const router = basename(dir);
  const { locatedRepos } = await import('../lib/workspace.mjs');
  const { rows } = await locatedRepos(dir);
  const template = JSON.parse(render(readFileSync(join(dir, 'docs/workspace/settings.json'), 'utf8'), router));
  const want = satelliteSettings(template, router);
  const text = `${JSON.stringify(want, null, 2)}\n`;
  return rows.filter((r) => r.kind === 'satellite' && r.dir && real(r.dir) !== dir).map((r) => {
    const repo = basename(r.dir);
    const path = join(r.dir, '.claude', 'settings.json');
    const step = { kind: 'satellite', repo, template: 'docs/workspace/settings.json', target: `${repo}/.claude/settings.json`, path, want: text };
    if (!existsSync(path)) return { ...step, state: 'missing' };
    const have = readFileSync(path, 'utf8');
    let parsed = null;
    try { parsed = JSON.parse(have); } catch { /* reported below */ }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...step, state: 'different', lacks: 'valid JSON, so the hooks cannot be added to it' };
    }
    if (sameJson(parsed, want)) return { ...step, state: 'current' };
    if (ours(parsed, want)) return { ...step, state: 'stale' };
    const { settings, added } = mergeSatellite(parsed, want);
    if (sameJson(settings, parsed)) return { ...step, state: 'current' };
    return { ...step, state: 'partial', want: `${JSON.stringify(settings, null, 2)}\n`, lacks: added.length ? `the router's hooks for ${added.join(', ')}` : 'an up-to-date relay to the router' };
  });
}

/** Writes what is missing or ours to refresh, adds the hooks a settings file lacks, removes orphan relays. Never touches anything else. */
export function apply(steps) {
  const written = [];
  for (const s of steps) {
    if (s.state === 'orphan') {
      try { unlinkSync(s.path); rmdirSync(dirname(s.path)); } catch { /* someone put more in that folder: it stays */ }
      written.push(s);
      continue;
    }
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
  const wire = process.argv.includes('--satellites');
  const routerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let steps;
  try { steps = plan({ routerDir }); } catch (e) {
    if (e instanceof Stop) { console.error(e.message); process.exit(1); }
    throw e;
  }
  const written = check ? [] : apply(steps);
  for (const s of steps.filter((x) => x.kind !== 'relay')) {
    const done = written.includes(s);
    if (done && s.state === 'partial') console.log(`  ✓ ${s.path}: ${s.lacks}`);
    else if (done) console.log(`  ✓ wrote ${s.path}`);
    else if (s.state === 'current') console.log(`  ✓ ${s.target} in place`);
    else if (s.state === 'missing') console.log(`  ▲ ${s.target} missing`);
    else if (s.state === 'stale') console.log(`  ▲ ${s.target} out of date`);
    else if (s.state === 'partial') console.log(`  ▲ ${s.target} lacks ${s.lacks}`);
    else console.log(`  ▲ ${s.path} exists and lacks ${s.lacks}. It is someone's file: add that by hand, from ${s.template}.`);
  }
  const relays = steps.filter((x) => x.kind === 'relay');
  const relayDone = relays.filter((s) => written.includes(s));
  const relayLeft = relays.filter((s) => s.state !== 'current' && s.state !== 'different' && !written.includes(s));
  const skillCount = relays.filter((s) => s.state !== 'orphan').length;
  if (relayDone.length) console.log(`  ✓ .claude/skills: ${relayDone.map((s) => `${s.state === 'orphan' ? 'removed' : 'wrote'} ${s.target.split('/')[2]}`).join(', ')}`);
  if (relayLeft.length) console.log(`  ▲ .claude/skills: ${relayLeft.map((s) => `${s.target.split('/')[2]} ${s.state === 'orphan' ? 'to remove' : s.state}`).join(', ')}`);
  if (!relayDone.length && !relayLeft.length && skillCount) console.log(`  ✓ .claude/skills: ${skillCount} skill(s) reachable from ${dirname(real(routerDir))}`);
  for (const s of relays.filter((x) => x.state === 'different')) console.log(`  · ${s.path} is a skill of its own, so ${s.template} is not reachable under that name from the workspace`);

  const sats = await planSatellites({ routerDir });
  const satDone = check || !wire ? [] : apply(sats);
  for (const s of sats) {
    if (satDone.includes(s)) console.log(`  ✓ wrote ${s.path}: commit it in ${s.repo}`);
    else if (s.state === 'current') console.log(`  ✓ ${s.target} runs the router's hooks`);
    else if (s.state === 'different') console.log(`  ▲ ${s.path} exists and lacks ${s.lacks}. It is someone's file: add the hooks by hand, as --satellites writes them for a repo that has none.`);
    else console.log(`  ▲ ${s.target} ${s.state === 'missing' ? 'missing: a session opened in it runs none of the router\'s hooks' : `lacks ${s.lacks || 'an up-to-date relay to the router'}`}.${wire ? '' : ' Rerun with --satellites to write it, then commit it there.'}`);
  }

  if (written.some((s) => s.kind !== 'relay')) {
    console.log(`\nOpen the agent on ${dirname(real(routerDir))}: a repo it could not bring up to date, and anything else that needs a person, is named in its first lines.`);
  }
  const left = [...steps, ...(check || wire ? sats : [])]
    .filter((s) => !['current', ...(s.kind === 'relay' ? ['different'] : [])].includes(s.state) && !written.includes(s) && !satDone.includes(s));
  process.exit(left.length ? 1 : 0);
}
