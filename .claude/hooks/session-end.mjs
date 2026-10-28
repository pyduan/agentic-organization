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
// Zero dependencies, Node built-ins and git, so it runs wherever Claude Code runs.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attribute, leftoversOf, readBaseline, reposOf, windows } from './own-changes.mjs';

const HOOKS = dirname(fileURLToPath(import.meta.url));
const ROUTER = resolve(HOOKS, '..', '..');
const LISTED = 12;

const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

/** The reason to block the stop, or null when there is nothing to say. */
export function endCheck(event, dir) {
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
    if (l.commit) return `commit ${l.commit}${repo ? ` in ${repo}` : ''} not pushed`;
    return `${repo ? `${repo}/` : ''}${l.path}${l.mtime === null ? ' (deleted)' : ''}`;
  };
  const listed = mine.slice(0, LISTED).map(label);
  if (mine.length > LISTED) listed.push(`and ${mine.length - LISTED} more`);
  const whose = decided ? `Yours: ${listed.join(', ')}` : `Left: ${listed.join(', ')}`;
  const neighbours = others.length ? ` (${others.length} change(s) by other sessions left alone)` : '';

  // The reflection pass is a skill here and a section of the manual where the kit has no
  // skills, named from the folder the agent was opened on.
  let router = relative(real(dir), real(ROUTER));
  if (router.startsWith('..') || isAbsolute(router)) router = real(ROUTER);
  const at = (p) => (router ? `${router.split('\\').join('/')}/${p}` : p);
  const reflect = existsSync(join(HOOKS, '..', 'skills', 'reflect', 'SKILL.md'))
    ? `from ${at('.claude/skills/reflect/SKILL.md')}` : `at the end of ${at('AGENTS.md')}`;

  return `End-of-session check: there are unsaved or unpublished changes ${where}. ${whose}${neighbours}. ` +
    'Before finishing: (1) stage the files you touched by name and read the body of git diff --cached, so ' +
    'nothing another session wrote rides along (in a checkout another session commits in, commit from your own ' +
    `worktree); (2) push so the change goes live; (3) run the reflection pass ${reflect}, folding anything ` +
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
