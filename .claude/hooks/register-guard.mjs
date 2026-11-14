#!/usr/bin/env node
// PostToolUse hook: an entry written into the incident register is checked against
// the schema the moment it is written, and the write is sent back while it is wrong.
//
// `scripts/check-register.mjs` already lists every field the schema does not allow,
// but only when someone runs it, and the register drifted between runs: an agent
// graded new entries "high" instead of "major", named the detector "Sam" instead of
// "owner", and the error report counted them in nothing for a week. The schema is
// closed (seven families, three severities, five detectors, five guard kinds), so a
// value outside it is always a mistake and this check has no false positive to tune.
//
// On Write, Edit or MultiEdit of the register (found as lib/register.mjs finds it:
// source/quality/incidents.json, KIT_REGISTER, or the one incidents*.json below the
// project), it runs `validate()` and blocks with the list of problems. A register
// that no longer parses blocks too. Anything else passes in silence.
//
// Zero dependencies. Never blocks on its own failure.

import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTER_NAME = /^incidents?([-_].*)?\.json$/i;
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

/**
 * The block reason for a write to `file` in the project at `dir`, or '' when the
 * write is not to the register or the register is within the schema.
 */
export async function verdict(file, dir, { lib = join(HERE, '..', '..', 'lib', 'register.mjs'), env = process.env } = {}) {
  if (!file || (!REGISTER_NAME.test(basename(file)) && !env.KIT_REGISTER)) return '';
  if (!existsSync(lib)) return '';
  const { loadRegister, validate } = await import(pathToFileURL(lib).href);
  const reg = await loadRegister(dir, env.KIT_REGISTER ? { override: env.KIT_REGISTER } : {});
  if (!reg.path || real(reg.path) !== real(resolve(dir, file))) return '';
  const where = reg.path.startsWith(dir + '/') ? reg.path.slice(dir.length + 1) : reg.path;
  const shape = {
    unreadable: `${where} no longer parses (${reg.error}).`,
    'bare-array': `${where} is now a bare array; the entries belong under { "version": 1, "incidents": [ … ] }.`,
    'no-incidents': `${where} has no \`incidents\` array any more.`,
  }[reg.state];
  if (shape) return `The incident register was just written and ${shape} Fix it before going on.`;
  const problems = validate(reg.incidents);
  if (!problems.length) return '';
  const schema = join(dirname(where), 'README.md');
  return [
    `The incident register (${where}) was just written with ${problems.length} value(s) outside its schema (${schema}):`,
    ...problems.slice(0, 15).map((p) => `  ✘ ${p.id}  ${p.field}${p.value !== undefined ? ` = ${JSON.stringify(p.value)}` : ''} — ${p.why}`),
    ...(problems.length > 15 ? [`  … and ${problems.length - 15} more (node scripts/check-register.mjs)`] : []),
    'The schema is closed: an entry outside it is counted in no figure of the error report. Correct the values ' +
    '(keep a finer word in `tags`), then go on.',
  ].join('\n');
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let event;
  try { event = JSON.parse(raw); } catch { process.exit(0); }
  if (!['Write', 'Edit', 'MultiEdit'].includes(event.tool_name)) process.exit(0);
  const dir = process.argv[2] || process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  try {
    const reason = await verdict(event.tool_input?.file_path, resolve(dir));
    if (reason) process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  } catch (e) {
    console.error(`register-guard: could not check the register (${e.message}); nothing was checked.`);
  }
}
