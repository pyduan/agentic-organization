#!/usr/bin/env node
// The project's check, run before every push on every machine.
//
// A push whose check fails is refused by the CI, if there is one, minutes later, after the agent
// has told the owner it was published; where there is none, it goes live broken. An organization
// running the kit put the check in a git pre-push hook on each machine, so that what its CI would
// refuse is refused before it leaves. Two halves:
//
//   - scripts/install-workspace.mjs writes .git/hooks/pre-push in every repo of the workspace that
//     has a `check` script (HOOK below, with the router's folder name filled in). A pre-push hook
//     it did not write is never replaced, and a repo whose hooks live elsewhere (core.hooksPath,
//     as husky sets it) is left alone; both are reported.
//   - that hook runs this file from the repo's root: `npm run check`, offline (CHECK_OFFLINE=1:
//     a push must not wait on every link of the site answering), and refuses the push when it
//     fails, with what failed and the instruction for the agent: fix it, commit, push again.
//     Never `--no-verify`, which skips the check rather than passing it.
//
// A push that only deletes a remote branch runs nothing. A repo with no `check` script, or a
// machine where the router is not beside the repo, pushes as before.
//
//   node scripts/pre-push.mjs [<repo>]      run the check of <repo> (default: the current folder)
//
// Zero dependencies, Node built-ins only.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARK = '# pre-push gate written by';

/** The hook for a workspace whose router folder is `router`. */
export const hookText = (router) => `#!/bin/sh
${MARK} ${router}/scripts/install-workspace.mjs: rerun it after a change, never edit this file.
# It runs the repo's check before the push (${router}/scripts/pre-push.mjs). Fix what it refuses; never --no-verify.
root="$(git rev-parse --show-toplevel)"
for t in "$root/../${router}/scripts/pre-push.mjs" "$root/scripts/pre-push.mjs"; do
  if [ -f "$t" ]; then exec node "$t" "$root"; fi
done
exit 0
`;

/** The check a repo runs before a push, as [command, args], or null when it has none. */
export function checkOf(dir) {
  try {
    const p = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    if (typeof p.scripts?.check === 'string' && p.scripts.check.trim()) return ['npm', ['run', '--silent', 'check']];
  } catch { /* no package.json */ }
  return null;
}

/** Whether the refs git hands the hook on stdin only delete remote branches. */
export const onlyDeletes = (stdin) => {
  const lines = String(stdin || '').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((l) => /^\S+ 0{40} /.test(l));
};

export const INSTRUCTION = [
  '',
  'The check refuses this push (scripts/pre-push.mjs).',
  'For the agent: fix what it reports yourself, without asking the owner, then commit and push again.',
  'A value you would have to invent stays empty or marked to confirm. Never git push --no-verify: it',
  'skips the check rather than passing it, and the same failure reaches the site or the CI instead.',
].join('\n');

/** Runs the check of `dir`: { ok, ran, output }. */
export function runCheck(dir, { run = spawnSync } = {}) {
  const check = checkOf(dir);
  if (!check) return { ok: true, ran: false, output: '' };
  const r = run(check[0], check[1], {
    cwd: dir, encoding: 'utf8', shell: process.platform === 'win32', timeout: 10 * 60 * 1000,
    env: { ...process.env, CHECK_OFFLINE: '1' },
  });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  return { ok: r.status === 0, ran: true, output };
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const dir = resolve(process.argv[2] || process.cwd());
  let stdin = '';
  try { if (!process.stdin.isTTY) stdin = readFileSync(0, 'utf8'); } catch { /* none */ }
  if (onlyDeletes(stdin) || !existsSync(join(dir, 'package.json'))) process.exit(0);
  const r = runCheck(dir);
  if (!r.ok) {
    const tail = r.output.trimEnd().split('\n').slice(-60).join('\n');
    console.error(`${tail}\n${INSTRUCTION}`);
    process.exit(1);
  }
}
