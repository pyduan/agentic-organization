// A machine's own settings, brought up to date on their own, without overwriting what the person set.
//
// A `.claude/*.local.json` file stays on one machine (gitignored), so a `git pull` never changes it.
// When the organization adds a rule that needs a key there (an internal mail domain, a routine everyone
// runs), the rule reaches the machines installed before it only if something writes that key. That is
// this module, run by scripts/workspace-sync.mjs at every session start and by
// scripts/install-workspace.mjs at install. Learned on an instance where a new mail rule reached the
// new machines and none of the old ones, though every one of them had pulled.
//
// Two kinds of change, both additive:
//   - a migration has an id, runs once, and is recorded in the file's `migrations` list; it may add a
//     missing key, never replace a value. The kit's own are below; an instance adds its own in
//     source/local-migrations.mjs (`export const MIGRATIONS = [...]`), outside every path kit-sync owns.
//   - the policy reconcile runs every time: each routine the organization's policy
//     (source/organization-policy.json ▸ policy) names is recorded on the machine as `to-install`
//     until it is installed, and the backfill as `to-do` until it has run.
//
// `pending()` turns that state into the lines a session start shows the agent, in an attended session
// only: a scheduled routine never installs another routine and never starts a backfill.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const POLICY_FILE = 'source/organization-policy.json';
export const INSTANCE_MIGRATIONS = 'source/local-migrations.mjs';
export const MACHINE_FILE = 'machine.local.json';
const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return undefined; } };
const isObject = (j) => Boolean(j) && typeof j === 'object' && !Array.isArray(j);

/** The organization's policy file, or {}. Its keys: internalDomains, restrictedRepos, policy. */
export function readPolicy(root) {
  const j = readJson(join(root, POLICY_FILE));
  return isObject(j) ? j : {};
}

/** The internal mail domains the policy declares, lower case, without `@`. */
export function internalDomains(policy) {
  return (Array.isArray(policy.internalDomains) ? policy.internalDomains : [])
    .map((d) => String(d).trim().toLowerCase().replace(/^@/, ''))
    .filter((d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d));
}

/** Is nobody attending this session? Only when the app says so (a scheduled routine). */
export const unattended = (env = process.env) =>
  ['0', 'false', 'no'].includes(String(env.CLAUDE_CODE_SESSION_ATTENDED ?? '').toLowerCase());

/**
 * The kit's migrations, in order. `file` is relative to `.claude/`. `apply(j, ctx)` returns the
 * changed object, or null when there is nothing to do on this machine (it is then not recorded and
 * will be tried again). `create(ctx)` returns the content of an absent file, or null to leave it absent.
 */
export const KIT_MIGRATIONS = [
  {
    id: '2026-11-06-send-guard-self',
    file: 'send-guard.local.json',
    what: 'your own address, so a briefing you mail to yourself leaves without a question',
    create: ({ email, domains }) => (isInternal(email, domains) ? { self: [email.toLowerCase()] } : null),
    apply: (j, { email, domains }) => {
      if (Array.isArray(j.self) && j.self.length) return j;
      return isInternal(email, domains) ? { ...j, self: [email.toLowerCase()] } : null;
    },
  },
];

const isInternal = (email, domains) =>
  ADDRESS.test(email || '') && domains.includes(String(email).toLowerCase().split('@')[1]);

/** The machine's git address, or ''. */
export function gitEmail(cwd) {
  try { return execFileSync('git', ['config', 'user.email'], { cwd, encoding: 'utf8', timeout: 5000 }).trim(); } catch { return ''; }
}

/** The instance's own migrations, from source/local-migrations.mjs, or []. */
export async function instanceMigrations(root) {
  const f = join(root, INSTANCE_MIGRATIONS);
  if (!existsSync(f)) return [];
  const mod = await import(pathToFileURL(f).href);
  return Array.isArray(mod.MIGRATIONS) ? mod.MIGRATIONS : [];
}

/**
 * The machine state the policy asks for, merged into what is there: a routine already recorded keeps
 * its state (installed, or anything the person wrote), a new one is `to-install`. Returns null when
 * nothing changes.
 */
export function reconcile(machine, policy) {
  const p = isObject(policy.policy) ? policy.policy : null;
  if (!p) return null;
  const out = structuredClone(machine);
  let changed = false;
  for (const slug of Array.isArray(p.routines) ? p.routines : []) {
    out.routines ||= {};
    if (!(slug in out.routines)) { out.routines[slug] = 'to-install'; changed = true; }
  }
  if (p.backfill && !out.backfill) { out.backfill = { state: 'to-do' }; changed = true; }
  if (p.inviteHomes && !('home' in out)) { out.home = 'to-invite'; changed = true; }
  return changed ? out : null;
}

/**
 * Apply what is missing in `<root>/.claude/`. Returns { done: [{ id, file, what, created }], problems }.
 * An unreadable file is never rewritten, only reported.
 */
export function migrate(root, { email = gitEmail(root), write = true, migrations = KIT_MIGRATIONS, policy = readPolicy(root) } = {}) {
  const done = []; const problems = [];
  const ctx = { email, domains: internalDomains(policy), policy };
  const save = (f, j) => { if (write) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, `${JSON.stringify(j, null, 2)}\n`); } };
  for (const m of migrations) {
    const f = join(root, '.claude', m.file);
    let j; let created = false;
    if (existsSync(f)) {
      j = readJson(f);
      if (!isObject(j)) { problems.push(`${m.file} is not readable JSON: left as it is`); continue; }
    } else {
      const fresh = m.create?.(ctx);
      if (!fresh) continue;
      j = fresh; created = true;
    }
    if ((j.migrations || []).includes(m.id)) continue;
    const after = m.apply(structuredClone(j), ctx);
    if (!after) continue;
    save(f, { ...after, migrations: [...new Set([...(after.migrations || []), m.id])] });
    done.push({ id: m.id, file: m.file, what: m.what, created });
  }
  const mf = join(root, '.claude', MACHINE_FILE);
  const machine = existsSync(mf) ? readJson(mf) : {};
  if (!isObject(machine)) problems.push(`${MACHINE_FILE} is not readable JSON: left as it is`);
  else {
    const after = reconcile(machine, policy);
    if (after) { save(mf, after); done.push({ id: 'policy', file: MACHINE_FILE, what: 'what the organization policy runs on every machine', created: !existsSync(mf) }); }
  }
  return { done, problems };
}

/** The line a session start prints, or '' when nothing changed. */
export function summary({ done, problems }, { check = false } = {}) {
  const out = [];
  if (done.length) out.push(`Machine settings ${check ? 'to update' : 'updated'}: ${done.map((x) => `${x.file}${x.created ? ' (created)' : ''}: ${x.what}`).join('; ')}.`);
  if (problems.length) out.push(`Machine settings: ${problems.join('; ')}.`);
  return out.join('\n');
}

/**
 * What waits on this machine, as lines for the agent at the start of an attended session. Under a
 * written policy the routines install and the backfill starts without asking; without one, each is
 * offered in one sentence and waits for a yes (routines/README.md ▸ Offered, never installed on its own).
 */
export function pending(root, { env = process.env, policy = readPolicy(root) } = {}) {
  if (unattended(env)) return [];
  const m = readJson(join(root, '.claude', MACHINE_FILE));
  if (!isObject(m)) return [];
  const p = isObject(policy.policy) ? policy.policy : {};
  const ruled = p.decidedBy && p.date;
  const why = ruled ? ` (policy decided by ${p.decidedBy} on ${p.date}${p.record ? `, ${p.record}` : ''})` : '';
  const out = [];
  const toInstall = Object.entries(m.routines || {}).filter(([, v]) => v === 'to-install').map(([k]) => k);
  if (toInstall.length) {
    const list = toInstall.map((k) => `routines/${k}/SKILL.md`).join(', ');
    out.push(ruled
      ? `Routines to install on this machine: ${list}. Install them now in auto mode, without asking${why}; say so in one sentence, then write "installed" for each in .claude/${MACHINE_FILE}.`
      : `Routines the organization runs, not yet on this machine: ${list}. Offer them in one sentence and install on a yes; then write "installed" (or "declined") in .claude/${MACHINE_FILE}.`);
  }
  const b = m.backfill || {};
  if (b.state === 'to-do') out.push(ruled
    ? `This person's backfill has not run on this machine: start it now, without asking${why}, saying so in one sentence (.claude/skills/backfill/SKILL.md), after their own request if it is urgent.`
    : `This person's backfill has not run: offer it in one sentence (.claude/skills/backfill/SKILL.md).`);
  if (b.state === 'in-progress') out.push(`Backfill in progress on this machine${b.batch ? ` (last batch: ${b.batch})` : ''}: resume it where it stopped (.claude/skills/backfill/SKILL.md ▸ Resuming).`);
  if (m.home === 'to-invite') out.push(`If this person heads a unit, invite them once, in one sentence, to make their intranet home their own portal (what they want to see first: their alerts, an app, the state of their unit), then write home: "invited" (or "not-applicable") in .claude/${MACHINE_FILE}. Never by mail.`);
  return out;
}
