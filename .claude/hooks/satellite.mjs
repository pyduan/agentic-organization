#!/usr/bin/env node
// A session opened in a satellite runs the hooks the workspace runs.
//
// Claude Code loads hooks from the .claude/settings.json of the folder a session is opened on.
// A satellite (docs/one-repo-or-several.md ▸ the star) had none, so a person whose work lives in
// one satellite, and who opened the agent there, got no pull at the start, no send guard, no
// end-of-session check, and nothing said so: a guard that is not loaded leaves no trace. A
// satellite must not copy the router's hooks either (rule 3 of the star). So its settings file,
// written by `node scripts/install-workspace.mjs --satellites`, holds one hook per event: a few
// lines of node that find the router beside the satellite and run this file, or, at session
// start, say that the router is missing and do nothing else.
//
// For that event, this file runs every hook the workspace settings template wires
// (docs/workspace/settings.json), with the router's path filled in, all at once as Claude Code
// would, and merges what they print into one answer: text and added context joined, a block from
// any of them a block, the strictest permission decision. A hook the router adds to the workspace
// therefore reaches every satellite with the next pull, and no satellite file has to change.
//
//   node .claude/hooks/satellite.mjs <event> [<matcher>]      the hook's JSON on stdin
//
// The hooks run with the satellite as CLAUDE_PROJECT_DIR, so the end-of-session check looks at
// the satellite, and with the router's own tuning (send-guard.json, turn-checks.json).
//
// Zero dependencies, Node built-ins only. Never breaks a session on its own failure.

import { spawn } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(fileURLToPath(import.meta.url));
const ROUTER = resolve(HOOKS, '..', '..');
const TIMEOUT_MS = 55_000;
// Events whose plain output Claude Code reads as context for the agent.
const CONTEXT = new Set(['SessionStart', 'UserPromptSubmit', 'PostToolUse']);

const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

/** The hooks the workspace template wires for one event and matcher, as { command, args, shell }. */
export function chain(routerDir, event, matcher = '') {
  const dir = real(routerDir);
  const name = basename(dir);
  const fill = (s) => String(s)
    .split('${CLAUDE_PROJECT_DIR}/{{ROUTER}}').join(dir)
    .split('$CLAUDE_PROJECT_DIR/{{ROUTER}}').join(dir)
    .split('{{ROUTER}}').join(name)
    .split('${CLAUDE_PROJECT_DIR}').join(dirname(dir))
    .split('$CLAUDE_PROJECT_DIR').join(dirname(dir));
  let template;
  try { template = JSON.parse(readFileSync(join(dir, 'docs', 'workspace', 'settings.json'), 'utf8')); } catch { return []; }
  return (template.hooks?.[event] ?? [])
    .filter((g) => (g?.matcher ?? '') === matcher)
    .flatMap((g) => g.hooks ?? [])
    .filter((h) => h?.type === 'command' && h.command)
    .map((h) => (Array.isArray(h.args)
      ? { command: fill(h.command), args: h.args.map(fill), shell: false }
      : { command: fill(h.command), args: [], shell: true }));
}

const parse = (out) => {
  const t = String(out || '').trim();
  if (!t) return null;
  try {
    const j = JSON.parse(t);
    if (j && typeof j === 'object' && !Array.isArray(j)) return { json: j };
  } catch { /* plain text */ }
  return { text: t };
};
const RANK = { allow: 1, ask: 2, deny: 3 };

/** One answer from several hooks' standard outputs, in the shape Claude Code expects for `event`. */
export function merge(event, outputs) {
  const parsed = outputs.map(parse).filter(Boolean);
  const texts = parsed.filter((p) => p.text).map((p) => p.text);
  const jsons = parsed.filter((p) => p.json).map((p) => p.json);
  if (!jsons.length) return texts.join('\n');

  const out = {};
  const blocks = jsons.filter((j) => j.decision === 'block');
  if (blocks.length) {
    out.decision = 'block';
    out.reason = blocks.map((j) => j.reason).filter(Boolean).join('\n\n');
  }
  if (jsons.some((j) => j.continue === false)) {
    out.continue = false;
    const why = jsons.map((j) => j.stopReason).filter(Boolean);
    if (why.length) out.stopReason = why.join('\n');
  }
  const system = jsons.map((j) => j.systemMessage).filter(Boolean);
  if (system.length) out.systemMessage = system.join('\n');

  const specific = jsons.map((j) => j.hookSpecificOutput).filter(Boolean);
  const context = [...specific.map((h) => h.additionalContext).filter(Boolean), ...(CONTEXT.has(event) ? texts : [])];
  const decided = specific.filter((h) => RANK[h.permissionDecision]).sort((a, b) => RANK[b.permissionDecision] - RANK[a.permissionDecision]);
  if (context.length || decided.length) {
    const h = { hookEventName: event };
    if (decided.length) {
      const top = decided[0].permissionDecision;
      h.permissionDecision = top;
      const why = decided.filter((x) => x.permissionDecision === top).map((x) => x.permissionDecisionReason).filter(Boolean);
      if (why.length) h.permissionDecisionReason = why.join('\n\n');
    }
    if (context.length) h.additionalContext = context.join('\n\n');
    out.hookSpecificOutput = h;
  }
  return JSON.stringify(out);
}

/** Runs one hook with the event on its stdin. Resolves { stdout, stderr, status }. */
function runOne(hook, input) {
  return new Promise((done) => {
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = hook.shell
        ? spawn(hook.command, { shell: true, windowsHide: true })
        : spawn(hook.command === 'node' ? process.execPath : hook.command, hook.args, { windowsHide: true });
    } catch (e) { done({ stdout: '', stderr: String(e.message), status: 1 }); return; }
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { clearTimeout(timer); done({ stdout, stderr: stderr + e.message, status: 1 }); });
    child.on('close', (status) => { clearTimeout(timer); done({ stdout, stderr, status }); });
    child.stdin.on('error', () => { /* a hook that never reads its input */ });
    child.stdin.end(input);
  });
}

/** Runs the chain for an event and returns { stdout, stderr, status } for the satellite's hook. */
export async function run(routerDir, event, matcher, input) {
  const hooks = chain(routerDir, event, matcher);
  const results = await Promise.all(hooks.map((h) => runOne(h, input)));
  const blocking = results.filter((r) => r.status === 2);
  if (blocking.length) return { stdout: '', stderr: blocking.map((r) => r.stderr.trim()).filter(Boolean).join('\n'), status: 2 };
  return { stdout: merge(event, results.map((r) => r.stdout)), stderr: '', status: 0 };
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  const [event = '', matcher = ''] = process.argv.slice(2);
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let result = { stdout: '', stderr: '', status: 0 };
  try { result = await run(ROUTER, event, matcher, raw); } catch (e) {
    result = { stdout: '', stderr: `satellite.mjs: ${e.message}`, status: 0 };
  }
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exit(result.status);
}
