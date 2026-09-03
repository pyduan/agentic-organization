#!/usr/bin/env node
// What else is instructing this agent?
//
// The kit assumes one source of truth: this repo. An agent opened in it reads
// CLAUDE.md, the guides, the skills here, and behaves the way the owner expects.
// What breaks that assumption is everything installed OUTSIDE the repo and still
// loaded on every session: a user-level CLAUDE.md written for a different project,
// plugins and skills installed months ago and frozen at that day's version, MCP
// servers declared globally, scheduled tasks nobody remembers registering. None of
// them announce themselves, all of them outrank nothing and contradict quietly, and
// the owner cannot see any of it — they see an agent that ignores an instruction it
// clearly reads.
//
// Found on a first onboarding: a newcomer's very first session behaved unlike every
// other, and the cause was a stack of leftovers from earlier experiments, none of
// which they knew were still there.
//
// So this looks, and says what it found. It NEVER deletes: --park moves a leftover
// aside into a dated folder with a manifest that says how to put it back, which is
// instant, costs no disk, and keeps the mistake reversible. Anything that cannot be
// moved safely (a settings file that also holds preferences, a scheduled task) is
// reported with the exact line to read, and left alone for the owner to decide.
//
// Zero dependencies, Node built-ins only.
//
// Usage:
//   node scripts/check-conflicts.mjs              # look and report
//   node scripts/check-conflicts.mjs --park       # move the safe ones aside
//   node scripts/check-conflicts.mjs --json
//   node scripts/check-conflicts.mjs --workspace=~/Projects

import { readFile, readdir, mkdir, rename, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const PARK = args.includes('--park');
const HOME = homedir();
const ROOT = resolve(process.cwd());
const expand = (p) => resolve(p.replace(/^~/, HOME));
const wsArg = args.find((a) => a.startsWith('--workspace='));
const WORKSPACE = wsArg ? expand(wsArg.split('=')[1]) : dirname(ROOT);

// A finding is: what it is, where, why it matters, and whether it can be parked.
const findings = [];
const add = (f) => findings.push(f);
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const countFiles = async (p) => { try { return (await readdir(p)).filter((n) => !n.startsWith('.')).length } catch { return 0 } };

// ---------------------------------------------------------------- user-level files

const CLAUDE_DIR = join(HOME, '.claude');

const userMemory = join(CLAUDE_DIR, 'CLAUDE.md');
if (existsSync(userMemory)) {
  const body = await readFile(userMemory, 'utf8').catch(() => '');
  add({
    kind: 'user memory', path: userMemory, parkable: true,
    why: 'loaded on every session in every folder, so it instructs the agent here too',
    detail: `${body.split('\n').filter(Boolean).length} non-empty line(s)`,
  });
}

for (const [dir, why] of [
  ['plugins', 'an installed plugin is frozen at its install day and cannot be updated by pulling this repo'],
  ['skills', 'a globally installed skill shadows the ones in .claude/skills here'],
  ['agents', 'globally installed subagents are loaded here too'],
  ['commands', 'global slash commands are offered here too'],
]) {
  const p = join(CLAUDE_DIR, dir);
  if (isDir(p)) {
    const n = await countFiles(p);
    if (n > 0) add({ kind: `global ${dir}`, path: p, parkable: true, why, detail: `${n} entr${n === 1 ? 'y' : 'ies'}` });
  }
}

// Settings hold real preferences (theme, model, permissions) alongside the things
// that instruct: hooks and MCP servers. Moving the whole file would take the
// preferences with it, so this reports the instructing keys and leaves the file.
for (const file of [join(CLAUDE_DIR, 'settings.json'), join(HOME, '.claude.json')]) {
  if (!existsSync(file)) continue;
  let cfg = {};
  try { cfg = JSON.parse(await readFile(file, 'utf8')) } catch { continue }
  const mcp = Object.keys(cfg.mcpServers || {});
  const hooks = Object.keys(cfg.hooks || {});
  if (mcp.length) add({
    kind: 'global MCP servers', path: file, parkable: false,
    why: 'declared for every project, so a tool meant for one job is reachable in all of them',
    detail: mcp.join(', '),
  });
  if (hooks.length) add({
    kind: 'global hooks', path: file, parkable: false,
    why: 'runs on every session here, including hooks written for another project',
    detail: hooks.join(', '),
  });
}

// ---------------------------------------------------------------- scheduled work

// Never touched automatically: a scheduled task can be someone's actual job running
// every morning. Reported with enough to identify it.
if (platform() !== 'win32') {
  const cron = await run('crontab', ['-l']).then((r) => r.stdout).catch(() => '');
  const lines = cron.split('\n').filter((l) => /claude/i.test(l) && !l.trim().startsWith('#'));
  if (lines.length) add({
    kind: 'scheduled tasks (cron)', path: 'crontab -l', parkable: false,
    why: 'runs the agent on its own schedule, in a folder you are not watching',
    detail: lines.map((l) => l.trim()).join(' ⏎ '),
  });
  const agentsDir = join(HOME, 'Library', 'LaunchAgents');
  if (isDir(agentsDir)) {
    const plists = (await readdir(agentsDir)).filter((n) => /claude/i.test(n));
    if (plists.length) add({
      kind: 'scheduled tasks (launchd)', path: agentsDir, parkable: false,
      why: 'runs the agent on its own schedule, in a folder you are not watching',
      detail: plists.join(', '),
    });
  }
}

// ---------------------------------------------------------------- stray clones

// A second clone of the same project is the quietest failure of all: two folders,
// one of them behind, and the owner reads whichever they opened. Look in the places
// people actually drop things, plus the workspace itself.
const gitRemote = async (dir) => {
  try {
    const { stdout } = await run('git', ['-C', dir, 'remote', 'get-url', 'origin']);
    return stdout.trim();
  } catch { return null }
};
const originHere = await gitRemote(ROOT);
const searched = [WORKSPACE, join(HOME, 'Desktop'), join(HOME, 'Downloads'), join(HOME, 'Documents'), HOME];
const seen = new Set([ROOT]);
for (const dir of searched) {
  if (!isDir(dir)) continue;
  let children = [];
  try { children = await readdir(dir) } catch { continue }
  for (const name of children) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (seen.has(p) || !isDir(p) || !existsSync(join(p, '.git'))) continue;
    seen.add(p);
    const remote = await gitRemote(p);
    if (!remote) continue;
    const sameProject = originHere && remote.replace(/\.git$/, '') === originHere.replace(/\.git$/, '');
    const isKit = /agentic-organization/.test(remote);
    if (sameProject) add({
      kind: 'second clone of this project', path: p, parkable: false,
      why: 'two folders of the same repo: work done in one is invisible in the other until it is pushed and pulled',
      detail: remote,
    });
    else if (isKit && dir !== WORKSPACE) add({
      kind: 'a copy of the template', path: p, parkable: false,
      why: 'the template itself, cloned outside the workspace: easy to open by mistake and edit instead of your project',
      detail: remote,
    });
  }
}

// ---------------------------------------------------------------- report

if (AS_JSON) {
  console.log(JSON.stringify({ findings, workspace: WORKSPACE, parked: null }, null, 2));
  process.exit(0);
}

if (!findings.length) {
  console.log('✓ nothing else is instructing this agent: no user-level memory, plugins, global skills, global MCP servers, scheduled tasks or stray clones');
  process.exit(0);
}

console.log(`Found ${findings.length} thing(s) outside this repo that also instruct the agent:\n`);
for (const f of findings) {
  console.log(`  ${f.parkable ? '▸' : '·'} ${f.kind} — ${f.path}`);
  console.log(`      ${f.why}`);
  if (f.detail) console.log(`      ${f.detail}`);
}

const parkable = findings.filter((f) => f.parkable);
if (!PARK) {
  console.log('');
  if (parkable.length) console.log(`  ${parkable.length} of them (▸) can be moved aside: node scripts/check-conflicts.mjs --park`);
  console.log('  The rest (·) are left for you to decide on: a scheduled task may be doing real work,');
  console.log('  and a settings file holds your preferences alongside the parts that instruct.');
  process.exit(0);
}

// --park: move aside, never delete, and write down how to undo it.
if (!parkable.length) {
  console.log('\nNothing here can be moved aside safely; the rest is yours to decide on.');
  process.exit(0);
}
const now = new Date().toISOString();
const stamp = `${now.slice(0, 10)}-${now.slice(11, 16).replace(':', '')}`;
const parkDir = join(CLAUDE_DIR, `parked-${stamp}`);
await mkdir(parkDir, { recursive: true });
const moved = [];
for (const f of parkable) {
  const dest = join(parkDir, basename(f.path));
  try { await rename(f.path, dest); moved.push([f.path, dest]) }
  catch (e) { console.log(`  ▲ could not move ${f.path}: ${e.message}`) }
}
await writeFile(join(parkDir, 'RESTORE.md'), [
  `# Parked ${new Date().toISOString().slice(0, 10)}`,
  '',
  'Moved aside by `scripts/check-conflicts.mjs --park`, from a project that wants one source',
  'of truth. Nothing was deleted. To put any of it back, move it to the path on the left:',
  '',
  ...moved.map(([from, to]) => `- \`${from}\` ← \`${to}\``),
  '',
  'If nothing has missed them after a few weeks, they can go.',
  '',
].join('\n'));
console.log(`\n✓ moved ${moved.length} aside into ${parkDir} (nothing deleted; RESTORE.md says how to put it back)`);
