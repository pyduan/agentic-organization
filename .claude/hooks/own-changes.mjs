#!/usr/bin/env node
// Which of the leftovers the end-of-session check found are this session's own.
//
// session-end.sh blocks a stop while a repo has uncommitted or unpushed work. In a clone
// shared by several sessions, that work is usually somebody else's: on one afternoon four
// sessions setting up the same organization were blocked seventeen times between them,
// nearly always on a neighbour's files, and each time the agent had to stop and explain
// that the files were not its own. A guard that fires on every turn for someone else's
// work teaches everyone to talk past it.
//
// So a leftover counts as this session's when the session could have produced it: a file
// whose modification time falls inside one of its own tool calls, a deleted file it named
// in a tool call, a commit made during one of its tool calls. Everything else belongs to
// someone else and is left alone. Every doubt lands on the safe side, so the cost of a
// wrong guess is an extra reminder, never a lost one:
//   - a call that keeps running after it returns (a background command, a subagent)
//     covers everything up to now;
//   - a transcript that cannot be read makes every leftover this session's;
//   - a neighbour writing while one of this session's commands runs is counted as this
//     session's (tried on a live workspace: of 16 leftovers, 15 were a neighbour's, and the
//     one written during this session's command was claimed);
//   - two seconds of slack on each side of every call.
//
// Called by session-end.sh with the hook's JSON on stdin and the repos as arguments:
//   node own-changes.mjs <repo>…
// prints one line per repo holding leftovers of this session, then `#others <n>`. It exits
// non-zero when it cannot decide, and session-end.sh then blocks on everything as before.

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SLACK = 2000;
// Tools that cannot write a file: their calls are not spans in which this session wrote anything.
const READ_ONLY = new Set(['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'ToolSearch', 'AskUserQuestion']);

/** The time spans of this session's tool calls, from its transcript (JSONL). */
export function windows(transcript, now = Date.now()) {
  const calls = new Map();
  const ended = new Map();
  for (const line of String(transcript).split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const t = Date.parse(o.timestamp);
    const content = o.message?.content;
    if (!Number.isFinite(t) || !Array.isArray(content)) continue;
    for (const c of content) {
      if (c?.type === 'tool_use' && c.id) calls.set(c.id, { start: t, name: c.name, input: c.input || {} });
      if (c?.type === 'tool_result' && c.tool_use_id) ended.set(c.tool_use_id, t);
    }
  }
  const out = [];
  for (const [id, c] of calls) {
    if (READ_ONLY.has(c.name)) continue;
    const background = c.input.run_in_background === true || c.name === 'Agent' || c.name === 'Task';
    const end = background || !ended.has(id) ? now : ended.get(id);
    out.push({ start: c.start - SLACK, end: end + SLACK, text: JSON.stringify(c.input) });
  }
  return out;
}

/**
 * Split leftovers into this session's and the others'. A leftover is
 * { repo, path, mtime } for a file (mtime null when deleted) or { repo, commit, time }.
 */
export function attribute(leftovers, spans) {
  const inside = (ms) => spans.some((w) => ms >= w.start && ms <= w.end);
  const named = (p) => spans.some((w) => w.text.includes(p));
  const mine = [];
  const others = [];
  for (const l of leftovers) {
    const own = l.commit ? inside(l.time) : l.mtime === null ? named(l.path) : inside(l.mtime);
    (own ? mine : others).push(l);
  }
  return { mine, others };
}

/** Uncommitted files and unpushed commits of one repo, with their times. */
export function leftoversOf(repo) {
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const out = [];
  const status = git('status', '--porcelain', '-z', '--untracked-files=all').split('\0');
  for (let i = 0; i < status.length; i++) {
    const e = status[i];
    if (e.length < 4) continue;
    const code = e.slice(0, 2);
    const path = e.slice(3);
    if (code[0] === 'R' || code[0] === 'C') i++; // the next entry is the old name
    let mtime = null;
    try { mtime = statSync(join(repo, path)).mtimeMs; } catch { /* deleted */ }
    out.push({ repo, path, mtime });
  }
  let upstream = true;
  try { git('rev-parse', '--abbrev-ref', '@{upstream}'); } catch { upstream = false; }
  if (upstream) {
    for (const line of git('log', '@{upstream}..HEAD', '--format=%H %ct').split('\n').filter(Boolean)) {
      const [sha, ct] = line.split(' ');
      out.push({ repo, commit: sha.slice(0, 7), time: Number(ct) * 1000 });
    }
  }
  return out;
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  try {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    const event = JSON.parse(raw);
    const spans = windows(readFileSync(event.transcript_path, 'utf8'));
    const leftovers = process.argv.slice(2).flatMap((r) => leftoversOf(r));
    const { mine, others } = attribute(leftovers, spans);
    const repos = [...new Set(mine.map((l) => l.repo))];
    process.stdout.write([...repos, `#others ${others.length}`].join('\n') + '\n');
  } catch {
    process.exit(2);
  }
}
