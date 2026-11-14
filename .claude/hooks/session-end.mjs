#!/usr/bin/env node
// Stop hook: the safety net behind "everything is saved and published".
// If the session is about to end with unsaved or unpublished work, ask the AI to finish the
// loop (commit, push, reflect) before stopping. Nontechnical owners won't know to ask for
// this, so the repo does.
//
// A session opened on one repo checks that repo. A session opened on the workspace, the
// folder holding the repos side by side (docs/workspace/), checks every repo in it. In a
// clone several sessions share, most leftovers are a neighbour's: own-changes.mjs keeps only
// what this session produced, and when it cannot decide, everything is kept.
//
// A session that saved and published everything still learned something, and the reflection
// pass used to be asked only when work was left: a session that pushed as it went, or worked
// outside the repo, ended without folding anything into the guides. So a session that wrote (an
// edit, a commit, a push, a deploy, a write through a connector) is asked for the reflection
// once, at its first stop after writing, even with nothing left to save. Brought by an
// organization running the kit, whose corrections were otherwise lost with the session.
//
// Zero dependencies, Node built-ins and git, so it runs wherever Claude Code runs.

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attribute, leftoversOf, readBaseline, reposOf, windows } from './own-changes.mjs';

const HOOKS = dirname(fileURLToPath(import.meta.url));
const ROUTER = resolve(HOOKS, '..', '..');
const LISTED = 12;

const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

const WRITE_TOOLS = /^(Edit|Write|MultiEdit|NotebookEdit)$/;
const WRITE_SHELL = /\bgit\s+(commit|push)\b|\bnpm\s+run\s+[\w:-]*(deploy|publish)|\bwrangler\s+[^;&|\n]*\bdeploy\b/;
const WRITE_MCP = /create|update|send|write|delete|insert|append|batch|post|publish/i;

/** Whether a session wrote anything: an edit, a commit or push, a deploy, a write through a connector. */
export function wrote(transcript) {
  for (const line of String(transcript || '').split('\n')) {
    if (!line.includes('"tool_use"')) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.isSidechain) continue;
    for (const c of e?.message?.content || []) {
      if (c?.type !== 'tool_use') continue;
      if (WRITE_TOOLS.test(c.name)) return true;
      if (c.name === 'Bash' && WRITE_SHELL.test(String(c.input?.command || ''))) return true;
      if (String(c.name).startsWith('mcp__') && WRITE_MCP.test(String(c.name).split('__').slice(2).join('__'))) return true;
    }
  }
  return false;
}

// One mark per session: the reflection is asked once, whichever message asked it.
const markOf = (id) => join(tmpdir(), 'kit-reflection', `${String(id).replace(/[^\w-]/g, '').slice(0, 80)}`);
const reflectionAsked = (id) => Boolean(id) && existsSync(markOf(id));
function markReflection(id) {
  if (!id) return;
  try { mkdirSync(dirname(markOf(id)), { recursive: true }); writeFileSync(markOf(id), new Date().toISOString()); } catch { /* asked again next time */ }
}

/** Where the reflection pass is, named from the folder the agent was opened on. */
function reflectionAt(dir) {
  // The reflection pass is a skill here and a section of the manual where the kit has no
  // skills, named from the folder the agent was opened on.
  let router = relative(real(dir), real(ROUTER));
  if (router.startsWith('..') || isAbsolute(router)) router = real(ROUTER);
  const at = (p) => (router ? `${router.split('\\').join('/')}/${p}` : p);
  return existsSync(join(HOOKS, '..', 'skills', 'reflect', 'SKILL.md'))
    ? `from ${at('.claude/skills/reflect/SKILL.md')}` : `at the end of ${at('AGENTS.md')}`;
}

/** The reason to block the stop, or null when there is nothing to say. */
export function endCheck(event, dir) {
  const reason = leftoverCheck(event, dir);
  if (reason) { markReflection(event.session_id); return reason; }
  if (!event.session_id || reflectionAsked(event.session_id)) return null;
  let transcript = '';
  try { transcript = readFileSync(event.transcript_path, 'utf8'); } catch { return null; }
  if (!wrote(transcript)) return null;
  markReflection(event.session_id);
  return `End-of-session reflection: this session changed things, and everything is saved. Before finishing, run the ` +
    `reflection pass ${reflectionAt(dir)}, once: every correction or preference the owner gave becomes a rule where it ` +
    'will be read (the guides, source/decisions.md, source/quality/incidents.json for a mistake that cost something), ' +
    'and a rule this session proved wrong is fixed or removed. Show what you would write, then commit and push it. ' +
    'If there is nothing to keep, say so in one line ("nothing to keep from this session") and stop.';
}

function leftoverCheck(event, dir) {
  const repos = reposOf(dir);
  const leftovers = [];
  for (const r of repos) {
    try { leftovers.push(...leftoversOf(r.dir)); } catch { /* not readable as a repo */ }
  }
  if (!leftovers.length) return null;

  let mine = leftovers;
  let others = [];
  let decided = false;
  try {
    const spans = windows(readFileSync(event.transcript_path, 'utf8'));
    const baselines = new Map();
    for (const r of repos) {
      const b = readBaseline(r.dir, event.session_id);
      if (b) baselines.set(r.dir, b);
    }
    ({ mine, others } = attribute(leftovers, spans, baselines));
    decided = true;
  } catch { /* the transcript cannot be read: every leftover counts */ }
  if (!mine.length) return null;

  const single = repos.length === 1 && repos[0].name === '.';
  const nameOf = new Map(repos.map((r) => [r.dir, r.name]));
  const where = single ? 'in this repo' : `in: ${[...new Set(mine.map((l) => nameOf.get(l.repo)))].join(', ')}`;
  const label = (l) => {
    const repo = single ? '' : nameOf.get(l.repo);
    if (l.commit && l.branch) return `commit ${l.commit}${repo ? ` in ${repo}` : ''} on ${l.branch}, not on ${l.base}${l.pushed ? '' : ', not pushed'}`;
    if (l.commit) return `commit ${l.commit}${repo ? ` in ${repo}` : ''} not pushed`;
    return `${repo ? `${repo}/` : ''}${l.path}${l.mtime === null ? ' (deleted)' : ''}`;
  };
  const listed = mine.slice(0, LISTED).map(label);
  if (mine.length > LISTED) listed.push(`and ${mine.length - LISTED} more`);
  const whose = decided ? `Yours: ${listed.join(', ')}` : `Left: ${listed.join(', ')}`;
  const neighbours = others.length ? ` (${others.length} change(s) by other sessions left alone)` : '';

  const reflect = reflectionAt(dir);

  // A side branch, even pushed, delivers nothing: only the default branch is read, built and pulled.
  const side = mine.filter((l) => l.branch);
  const branches = [...new Set(side.map((l) => `${l.branch}${single ? '' : ` (${nameOf.get(l.repo)})`}`))].join(', ');
  const push = side.length
    ? `(2) a side branch delivers nothing, pushed or not: ${side.length} commit(s) on ${branches} are not on ` +
      `${side[0].base}. Bring them there (git fetch origin, git rebase origin/${side[0].base}, git push origin HEAD:${side[0].base}), ` +
      `or, if they must stay on the branch (a review was asked, the push to ${side[0].base} is refused), say in your last ` +
      `message that the work stopped on ${branches} and is not live; `
    : '(2) push so the change goes live; ';

  return `End-of-session check: there are unsaved or unpublished changes ${where}. ${whose}${neighbours}. ` +
    'Before finishing: (1) stage the files you touched by name and read the body of git diff --cached, so ' +
    'nothing another session wrote rides along (in a checkout another session commits in, commit from your own ' +
    `worktree); ${push}(3) run the reflection pass ${reflect}, folding anything ` +
    'learned this session into the guides; (4) tell the owner in plain words what was published and saved. ' +
    'If a leftover is not yours to commit, say so to the owner instead of committing blindly.';
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let event = {};
  try { event = JSON.parse(raw || '{}'); } catch { /* an unreadable event: check anyway */ }
  // Don't loop: if we already blocked once this stop, let it through.
  if (event.stop_hook_active === true) process.exit(0);
  const dir = process.env.CLAUDE_PROJECT_DIR || ROUTER;
  let reason = null;
  try { reason = endCheck(event, dir); } catch { reason = null; }
  if (reason) process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
  process.exit(0);
}
