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
// The checks that do not depend on this kit's layout live in lib/setup-checks.mjs, so a
// kit laid out differently runs the same ones. The four below are this layout's own.
//
// It changes nothing: every fix is a separate command, named in the report.
//
//   node scripts/setup-status.mjs            the table
//   node scripts/setup-status.mjs --json     the same, for a skill or an app
//   node scripts/setup-status.mjs --offline  no fetch, no network check
//
// Exit 1 when a check is red, 0 otherwise. Zero dependencies, Node built-ins and git.

import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTemplateSlug, originSlug } from '../lib/workspace.mjs';
import {
  exec, gitOut, ok, warn, fail, info, tools, github, identity, repos, conflicts, runChecks, report,
} from '../lib/setup-checks.mjs';
import { plan as workspacePlan, Stop } from './install-workspace.mjs';
import * as workspaceSync from './workspace-sync.mjs';

export { report };

const HERE = dirname(fileURLToPath(import.meta.url));
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

async function guards(root, { template }) {
  let steps;
  try { steps = workspacePlan({ routerDir: root }); }
  catch (e) { if (e instanceof Stop) return template ? info(`the template itself: ${e.message}`) : warn(e.message); throw e; }
  const off = steps.filter((s) => s.state !== 'current');
  if (!off.length) return ok('the folder beside this repo loads its guards (send guard, end-of-session check)');
  if (template) return info('the template itself: the workspace folder takes its guards from an organization\'s own repo');
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
  const reopen = 'open the agent on this repo, or on the workspace folder after node scripts/install-workspace.mjs';
  if (!ran) {
    return warn('the session-start hooks have never run on this clone, so sessions here may not be loading this repo\'s settings', reopen);
  }
  if (Date.now() - ran.at > WEEK_MS) {
    return warn(`the session-start hooks last ran on ${ran.day}, so any session opened here since did not load this repo's settings`, reopen);
  }
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

export async function setupStatus(root, { offline = false, only = null, template = null } = {}) {
  const isTemplate = template ?? isTemplateSlug((await originSlug(root)) || '');
  return runChecks(CHECKS.filter((c) => !only || only.includes(c.id)), root, {
    offline, template: isTemplate, scripts: 'scripts', sync: workspaceSync, conflicts: join(HERE, 'check-conflicts.mjs'),
  });
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
