// The incident register: where it is, what is in it, and what is wrong with it.
//
// Three scripts read source/quality/incidents.json and each used to carry its own
// copy of the reading: preflight learned to find a register kept under a translated
// path, error-report never did, and neither checked what the entries said. So an
// agent that started filing incidents under families of its own invention
// ("domain-accuracy", "delivery") produced a register the report silently dropped
// half of. One reader, one schema, here.
//
// Zero dependencies, Node built-ins only.

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** The seven families. Same keys, sections and labels as docs/failure-modes.md. */
export const FAMILIES = [
  { key: 'searched-too-late', section: 1, label: 'Acting before looking' },
  { key: 'status-of-information', section: 2, label: 'Status of information' },
  { key: 'numbers', section: 3, label: 'Producing and reading figures' },
  { key: 'expiry', section: 4, label: 'Silent expiry' },
  { key: 'destructive', section: 5, label: 'Actions on files and the machine' },
  { key: 'handover', section: 6, label: 'Handover and the relationship' },
  { key: 'parallel-sessions', section: 7, label: 'Parallel sessions' },
];
export const FAMILY = Object.fromEntries(FAMILIES.map((f) => [f.key, f]));

export const SEVERITIES = ['critical', 'major', 'minor'];

// A guard either runs and can say no, or depends on someone remembering it.
export const EXECUTABLE = new Set(['check', 'test', 'tool']);
export const WRITTEN = new Set(['rule']);
export const NOTHING = new Set(['none']);
export const guardKind = (i) => (i.guard && i.guard.kind) || 'none';

export const DETECTED_BY = new Set(['owner', 'self', 'another-session', 'check', 'outside-user']);
// Whoever caught it, the question is whether a person had to.
export const HUMAN = new Set(['owner', 'outside-user', 'outside user', 'another-session']);

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.astro', '.wrangler']);

/**
 * The canonical path, else an explicit override, else a bounded walk for a file
 * whose name matches. A workshop may translate the kit's paths, and a hardcoded
 * path made preflight announce "no incidents logged" over a register of 109.
 * Returns { path, how } with how ∈ given | canonical | found | ambiguous | missing.
 */
export async function findFile(root, canonical, matches, override) {
  if (override) return { path: resolve(root, override), how: 'given' };
  if (await readFile(join(root, canonical), 'utf8').then(() => true, () => false)) {
    return { path: join(root, canonical), how: 'canonical' };
  }
  const hits = [];
  const walk = async (dir, depth) => {
    if (depth > 4 || hits.length > 8) return;
    let entries = [];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.claude') continue;
      if (SKIP.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full, depth + 1);
      else if (matches(e.name)) hits.push(full);
    }
  };
  await walk(root, 0);
  if (hits.length === 1) return { path: hits[0], how: 'found' };
  if (hits.length > 1) return { path: null, how: 'ambiguous', hits };
  return { path: null, how: 'missing' };
}

/**
 * Read the register and say which of five outcomes happened. They are never
 * conflated: not found, found but unreadable, parsed but the wrong shape, empty,
 * and holding entries. Collapsing any two of them is how a check reports "all
 * clear" when it simply could not see its input.
 *
 * Returns { path, how, hits, raw, incidents, state, error } where state is
 * missing | ambiguous | unreadable | bare-array | no-incidents | empty | ok.
 */
export async function loadRegister(root, { override = process.env.KIT_REGISTER } = {}) {
  const at = await findFile(
    root,
    'source/quality/incidents.json',
    (n) => /^incidents?\.json$/i.test(n) || /^incidents?[-_].*\.json$/i.test(n),
    override,
  );
  const out = { path: at.path, how: at.how, hits: at.hits || [], raw: null, incidents: [], state: at.how, error: null };
  if (!at.path) return out;
  try { out.raw = JSON.parse(await readFile(at.path, 'utf8')); }
  catch (e) { out.state = 'unreadable'; out.error = e.message; return out; }
  // A bare array is the likely wrong shape: the schema example in
  // source/quality/README.md shows a single entry, so a register started from it
  // by hand comes out as [ … ] rather than { incidents: [ … ] }.
  if (Array.isArray(out.raw)) { out.state = 'bare-array'; return out; }
  if (!Array.isArray(out.raw?.incidents)) { out.state = 'no-incidents'; return out; }
  out.incidents = out.raw.incidents;
  out.state = out.incidents.length ? 'ok' : 'empty';
  return out;
}

/**
 * What in the register the schema does not allow. Each problem names the entry,
 * the field and the value, so it can be fixed rather than read round.
 * Returns [{ id, field, value, why }].
 */
export function validate(incidents) {
  const problems = [];
  const seen = new Set();
  incidents.forEach((i, n) => {
    const id = i.id || `#${n + 1}`;
    const add = (field, value, why) => problems.push({ id, field, value, why });
    if (!i.id) add('id', i.id, 'no id');
    else if (seen.has(i.id)) add('id', i.id, 'the same id is used twice');
    seen.add(i.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date || '')) add('date', i.date, 'not an ISO date');
    if (!FAMILY[i.category]) add('category', i.category, 'not one of the seven families; keep the finer word in `tags`');
    if (!SEVERITIES.includes(i.severity)) add('severity', i.severity, `not one of ${SEVERITIES.join(', ')}`);
    if (!DETECTED_BY.has(i.detected_by)) add('detected_by', i.detected_by, `not one of ${[...DETECTED_BY].join(', ')}`);
    const k = guardKind(i);
    if (!EXECUTABLE.has(k) && !WRITTEN.has(k) && !NOTHING.has(k)) add('guard.kind', k, 'not check, test, tool, rule or none');
    else if (k !== 'none' && !(i.guard && i.guard.where)) add('guard.where', undefined, 'a guard that names no place cannot be checked');
    if (!i.generic || !String(i.generic).trim()) add('generic', undefined, 'no transferable lesson, so the anonymized report carries nothing');
    if (i.tags !== undefined && !Array.isArray(i.tags)) add('tags', i.tags, 'tags is a list of words');
  });
  return problems;
}
