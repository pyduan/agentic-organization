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
// kit laid out differently runs the same ones. The ones below are this layout's own: the map,
// the workspace folder's guards, the hook receipt, the kit version, and the three the setup
// starts with (STACK.md approved row by row, CONNECTORS.md against what is configured here, and
// the intranet built, published and behind a sign-in).
//
// It changes nothing: every fix is a separate command, named in the report.
//
//   node scripts/setup-status.mjs            the table
//   node scripts/setup-status.mjs --json     the same, for a skill or an app
//   node scripts/setup-status.mjs --offline  no fetch, no network check
//   node scripts/setup-status.mjs --next     only the next step of the setup, one line (lib/setup-stage.mjs)
//
// Exit 1 when a check is red, 0 otherwise. Zero dependencies, Node built-ins and git.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTemplateSlug, originSlug } from '../lib/workspace.mjs';
import {
  exec, gitOut, ok, warn, fail, info, tools, github, identity, repos, conflicts, runChecks, report,
} from '../lib/setup-checks.mjs';
import { plan as workspacePlan, Stop } from './install-workspace.mjs';
import { approvalTable, DATED, setupStage } from '../lib/setup-stage.mjs';
import * as workspaceSync from './workspace-sync.mjs';

export { report, approvalTable };

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
  const theirs = off.filter((s) => s.state === 'different');
  if (theirs.length) {
    return warn(`${theirs.map((s) => `${s.target} in the workspace folder lacks ${s.lacks}`).join('; ')}, so a session opened there may skip this repo's guards. ` +
      'It is someone\'s own file, so the installer leaves it: add what it lacks by hand, from docs/workspace/');
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

// ---------------------------------------------------------------- the setup's first steps

const readText = (file) => { try { return readFileSync(file, 'utf8'); } catch { return null; } };

/** STACK.md: has every row been approved, with a date, by someone? */
async function stack(root, { template }) {
  const fix = 'say "walk the stack with me": the setup skill (step 1) takes each row to a yes or a change, dated';
  const text = readText(join(root, 'STACK.md'));
  if (text === null) return warn('there is no STACK.md, so nothing records what runs on what or who chose it', 'update the kit, which brings STACK.md, then ' + fix.slice(4));
  const t = approvalTable(text);
  if (!t || !t.rows.length) return warn('STACK.md has no table of bricks', fix);
  if (!t.hasColumn) return warn('STACK.md has no Approved column, so no row says who chose it and when', fix);
  const open = t.rows.filter((r) => !DATED.test(r.Approved));
  if (template) return info(`the template itself: its ${t.rows.length} rows are proposals an organization approves`);
  if (!open.length) return ok(`${t.rows.length} row(s), each approved with a date`);
  return warn(`${open.length} of ${t.rows.length} row(s) not approved yet: ${open.map((r) => r.Role || r[t.head[0]]).join(', ')}`, fix);
}

/** The MCP servers configured for sessions here, by name only: their settings may hold secrets. */
export function configuredServers(root, { home = homedir() } = {}) {
  const names = new Map(); // name -> where
  const add = (obj, where) => { for (const n of Object.keys((obj && obj.mcpServers) || {})) if (!names.has(n)) names.set(n, where); };
  const json = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
  const user = json(join(home, '.claude.json'));
  add(user, '~/.claude.json');
  const parent = dirname(root);
  for (const dir of [root, parent]) add(user?.projects?.[dir], `~/.claude.json (${dir === root ? 'this repo' : 'the workspace folder'})`);
  add(json(join(home, '.claude', 'settings.json')), '~/.claude/settings.json');
  add(json(join(root, '.mcp.json')), '.mcp.json');
  add(json(join(parent, '.mcp.json')), 'the workspace folder\'s .mcp.json');
  return names;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** The names a row of CONNECTORS.md answers to: the words before any bracket, and every `code` name. */
const rowNames = (cell) => [String(cell).split('(')[0], ...[...String(cell).matchAll(/`([^`]+)`/g)].map((m) => m[1])].map(norm).filter(Boolean);

/** CONNECTORS.md against the servers configured on this machine. */
async function connectors(root, { template, home }) {
  const fix = 'say "walk the connectors with me": the setup skill (step 1) takes each row to a yes or a change, dated';
  const text = readText(join(root, 'CONNECTORS.md'));
  if (text === null) return warn('there is no CONNECTORS.md, so nothing says which connectors the agent may use, or how far', 'update the kit, which brings CONNECTORS.md, then ' + fix.slice(4));
  const t = approvalTable(text);
  if (!t || !t.hasColumn) return warn('CONNECTORS.md has no table with an Approved column', fix);
  const rows = t.rows.map((r) => ({
    label: r.Connector || r[t.head[0]], names: rowNames(r.Connector || r[t.head[0]]),
    status: norm(r.Status), approved: DATED.test(r.Approved),
  }));
  const servers = configuredServers(root, { home });
  const rowFor = (name) => rows.find((r) => r.names.some((n) => n && (norm(name).includes(n) || n.includes(norm(name)))));
  const forbidden = []; const unlisted = []; const pending = [];
  for (const [name, where] of servers) {
    const r = rowFor(name);
    if (!r) unlisted.push(`${name} (${where})`);
    else if (r.status === 'notallowed' && r.approved) forbidden.push(`${name} (${where})`);
    else if (!r.approved || !['authorized', 'recommended'].includes(r.status)) pending.push(`${name} (${where})`);
  }
  const unseen = rows.filter((r) => r.approved && ['authorized', 'recommended'].includes(r.status)
    && ![...servers.keys()].some((n) => rowFor(n) === r)).map((r) => r.label);
  const unsettled = rows.filter((r) => !r.approved).length;
  if (forbidden.length) return fail(`configured although CONNECTORS.md does not allow it: ${forbidden.join(', ')}`, 'remove it from that settings file (claude mcp remove <name>), or change the row with the owner first');
  if (template) return info(`the template itself: its ${rows.length} rows are proposals an organization approves`);
  const notes = [];
  if (unseen.length) notes.push(`approved but not configured on this machine: ${unseen.join(', ')} (a connector enabled in Claude's own settings is not visible from here: try it once)`);
  if (unlisted.length || pending.length) {
    const what = [...(unlisted.length ? [`not on the list: ${unlisted.join(', ')}`] : []), ...(pending.length ? [`listed, not approved: ${pending.join(', ')}`] : [])];
    return warn(`configured here without an approved row in CONNECTORS.md: ${what.join('; ')}${notes.length ? `; ${notes.join('; ')}` : ''}`,
      'add or settle its row with the owner before the next use, or remove it from this machine');
  }
  if (unsettled) return warn(`${unsettled} of ${rows.length} row(s) of CONNECTORS.md not approved yet${notes.length ? `; ${notes.join('; ')}` : ''}`, fix);
  return ok(`every row approved; ${servers.size ? `${servers.size} server(s) configured here, each on an approved row` : 'no MCP server configured on this machine'}${notes.length ? `; ${notes.join('; ')}` : ''}`);
}

/** Where the intranet was published, as the setup records it: the Private pages row, else the brief. */
export function intranetAddress(root) {
  const stackRow = (approvalTable(readText(join(root, 'STACK.md')) || '')?.rows || []).find((r) => /private pages|intranet/i.test(r.Role || ''));
  const inRow = stackRow && Object.values(stackRow).join(' ').match(/https:\/\/[^\s)`|>]+/);
  if (inRow) return inRow[0];
  const line = (readText(join(root, 'source', 'brief.md')) || '').split('\n').find((l) => /intranet|dashboard/i.test(l) && /https:\/\//.test(l));
  return line ? line.match(/https:\/\/[^\s)`|>]+/)[0] : null;
}

/** The intranet: named for publishing, built (and not with --local), published, behind a sign-in. */
async function intranet(root, { template, offline, fetch: get = globalThis.fetch }) {
  if (template) return info('the template itself: the intranet is built and published by each organization');
  const publish = 'say "publish my intranet": the setup skill (step 2) builds it and puts it behind Access';
  const cfg = readText(join(root, 'apps', 'dashboard', 'wrangler.jsonc'));
  if (cfg === null) return warn('there is no apps/dashboard/, so this repo has no intranet', 'update the kit, then ' + publish.slice(4));
  const dist = join(root, 'apps', 'dashboard', 'dist');
  const built = existsSync(join(dist, 'index.html'));
  if (existsSync(join(dist, '.local-build'))) {
    return warn('the last build was made with --local and holds material from local/; it is for this machine and cannot be deployed', 'npm run intranet (without --local) before the next deploy');
  }
  const named = !/"name"\s*:\s*"my-dashboard"/.test(cfg);
  const url = intranetAddress(root);
  if (!url) {
    if (!named) return warn(`not published yet${built ? ' (built on this machine)' : ''}: its Worker still has the template's name`, publish);
    return warn(`${built ? 'built' : 'not built on this machine'}; no address recorded in STACK.md (Private pages) or the brief, so its protection cannot be checked`,
      'write the address in the Private pages row of STACK.md, or ' + publish.slice(4));
  }
  if (offline) return info(`published at ${url}; its sign-in was not checked (offline)`);
  let res;
  try { res = await get(`${url.replace(/\/$/, '')}/?setup-status=${Date.now()}`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) }); }
  catch (e) { return warn(`${url} did not answer (${e.cause?.code || e.message}), so it may not be published`, publish); }
  const where = res.headers.get('location') || '';
  if ([301, 302, 303, 307, 308].includes(res.status) && /cloudflareaccess\.com|\/cdn-cgi\/access\//.test(where)) return ok(`published at ${url}, behind a sign-in`);
  if ([401, 403].includes(res.status)) return ok(`published at ${url}, refused without a sign-in (${res.status})`);
  if (res.status === 200) return fail(`${url} answers without a sign-in: anyone with the address can read it`, 'node scripts/protect-access.mjs --worker=<name> --emails=apps/dashboard/access.txt, then open the address from a browser that is not signed in');
  return warn(`${url} answers ${res.status}${where ? ` towards ${where}` : ''}, which is neither the page nor a sign-in`, publish);
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
  { id: 'stack', label: 'Stack approved', run: stack },
  { id: 'connectors', label: 'Connectors', run: connectors },
  { id: 'intranet', label: 'Intranet', run: intranet },
];

export async function setupStatus(root, { offline = false, only = null, template = null, home = homedir(), fetch = globalThis.fetch } = {}) {
  const isTemplate = template ?? isTemplateSlug((await originSlug(root)) || '');
  return runChecks(CHECKS.filter((c) => !only || only.includes(c.id)), root, {
    offline, template: isTemplate, scripts: 'scripts', sync: workspaceSync, conflicts: join(HERE, 'check-conflicts.mjs'), home, fetch,
  });
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--next')) { console.log(setupStage(resolve(HERE, '..')).next); process.exit(0); }
  const result = await setupStatus(resolve(HERE, '..'), { offline: args.has('--offline') });
  result.next = result.checks.some((c) => c.id === 'stack' && c.level === 'info') ? null : setupStage(result.root).next;
  console.log(args.has('--json') ? JSON.stringify(result, null, 2) : `${report(result)}${result.next ? `\nNext: ${result.next}.` : ''}`);
  process.exit(result.ok ? 0 : 1);
}
