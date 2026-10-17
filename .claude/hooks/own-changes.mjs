#!/usr/bin/env node
// Which of the leftovers the end-of-session check found are this session's own.
//
// session-end.mjs blocks a stop while a repo has uncommitted or unpushed work. In a clone
// shared by several sessions, that work is usually somebody else's: sessions setting up the
// same organization were blocked again and again on a neighbour's files, and each time the
// agent had to stop and explain that the files were not its own. A guard that fires on every
// turn for someone else's work teaches everyone to talk past it.
//
// So a leftover counts as this session's when the session could have produced it:
//   - a file whose modification time falls inside one of its own tool calls;
//   - a file, deleted or not, that one of its tool calls named, or whose parent folder one
//     named (`rm -r drafts/`, `cp -p ~/x.pdf inbox/`), matched on whole path segments;
//   - a file that was not dirty when the session started (the baseline taken at
//     SessionStart) and that is now deleted, or carries a date older than the session start
//     (a `mv`, `cp -p`, `rsync -a` or unzip keeps the date of the original);
//   - a commit made during one of its tool calls.
// Everything else belongs to someone else and is left alone. Doubts land on the side of
// asking: a call that keeps running after it returns (a background command, a subagent)
// covers everything up to now, a transcript that cannot be read makes every leftover this
// session's, a neighbour writing while one of this session's commands runs is counted as
// this session's, and every call gets two seconds of slack on each side.
//
// What it still misses: a file already dirty at session start that this session overwrote
// with an older date without naming it or its folder, and, in a session that started without
// a baseline (the SessionStart hook not installed yet), a copy with an old date or a deletion
// that names neither the file nor its folder.
//
// As a SessionStart hook, `node own-changes.mjs --baseline` (the hook's JSON on stdin)
// records the dirty paths of every repo of the session in that repo's git folder,
// .git/own-changes/<session id>.json, kept on a resume, pruned after two weeks.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SLACK = 2000;
const KEEP_MS = 14 * 24 * 3600 * 1000;
// Tools that cannot write a file: their calls are not spans in which this session wrote anything.
const READ_ONLY = new Set(['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'ToolSearch', 'AskUserQuestion']);
// Inputs that are prose (a file's new content, a subagent's brief): a folder named there was
// written about, not written to.
const PROSE = new Set(['content', 'old_string', 'new_string', 'new_source', 'prompt', 'description']);

const strings = (v, key = '') => {
  if (typeof v === 'string') return PROSE.has(key) ? [] : [v];
  if (Array.isArray(v)) return v.flatMap((x) => strings(x, key));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => strings(x, k));
  return [];
};

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
    out.push({ start: c.start - SLACK, end: end + SLACK, text: strings(c.input).join('\n') });
  }
  return out;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BEFORE = '(?:^|[\\s"\'`=:(,;|&<>/\\\\])';
// The token ends there (a trailing slash or a glob may follow): `drafts/2025/` names drafts/2025
// and not drafts, so a deeper path never claims its whole top folder.
const AFTER = '(?=/?(?:$|[\\s"\'`):,;|&<>\\\\*]))';

/** Whether `text` names `path` (relative to its repo) or one of its parent folders, as whole segments. */
export function names(text, path) {
  const parts = path.split('/').filter(Boolean);
  for (let i = parts.length; i > 0; i--) {
    if (new RegExp(BEFORE + escape(parts.slice(0, i).join('/')) + AFTER).test(text)) return true;
  }
  return false;
}

/**
 * Split leftovers into this session's and the others'. A leftover is
 * { repo, path, mtime } for a file (mtime null when deleted) or { repo, commit, time }.
 * `baselines` maps a repo to { at, paths } as taken at session start, when there is one.
 */
export function attribute(leftovers, spans, baselines = new Map()) {
  const inside = (ms) => spans.some((w) => ms >= w.start && ms <= w.end);
  const named = (p) => spans.some((w) => names(w.text, p));
  const mine = [];
  const others = [];
  for (const l of leftovers) {
    let own;
    if (l.commit) own = inside(l.time);
    else if (named(l.path) || (l.mtime !== null && inside(l.mtime))) own = true;
    else {
      const b = baselines.get(l.repo);
      own = Boolean(b) && !b.paths.has(l.path) && (l.mtime === null || l.mtime < b.at);
    }
    (own ? mine : others).push(l);
  }
  return { mine, others };
}

const gitIn = (repo, ...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 });

/** The paths `git status` lists in a repo, relative to its root. */
export function dirtyPaths(repo) {
  const out = [];
  const status = gitIn(repo, 'status', '--porcelain', '-z', '--untracked-files=all').split('\0');
  for (let i = 0; i < status.length; i++) {
    const e = status[i];
    if (e.length < 4) continue;
    if (e[0] === 'R' || e[0] === 'C') i++; // the next entry is the old name
    out.push(e.slice(3));
  }
  return out;
}

/** Uncommitted files and unpushed commits of one repo (its root), with their times. */
export function leftoversOf(repo) {
  const out = dirtyPaths(repo).map((path) => {
    let mtime = null;
    try { mtime = statSync(join(repo, path)).mtimeMs; } catch { /* deleted */ }
    return { repo, path, mtime };
  });
  let upstream = true;
  try { gitIn(repo, 'rev-parse', '--abbrev-ref', '@{upstream}'); } catch { upstream = false; }
  if (upstream) {
    for (const line of gitIn(repo, 'log', '@{upstream}..HEAD', '--format=%H %ct').split('\n').filter(Boolean)) {
      const [sha, ct] = line.split(' ');
      out.push({ repo, commit: sha.slice(0, 7), time: Number(ct) * 1000 });
    }
  }
  return out;
}

/**
 * The repos a session opened on `dir` answers for, as their roots: the one `dir` is in, or,
 * for a workspace folder holding repos side by side, every one of them. Each is { name, dir }.
 */
export function reposOf(dir) {
  try {
    const root = gitIn(dir, 'rev-parse', '--show-toplevel').trim();
    if (root) return [{ name: '.', dir: root }];
  } catch { /* not inside a repo */ }
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, '.git')))
    .map((e) => ({ name: e.name, dir: join(dir, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const safeId = (id) => String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);

function baselineDir(repo) {
  const gitDir = gitIn(repo, 'rev-parse', '--git-dir').trim();
  return join(isAbsolute(gitDir) ? gitDir : resolve(repo, gitDir), 'own-changes');
}

/** Record what is dirty in `repo` now, once per session: a resumed session keeps its first baseline. */
export function takeBaseline(repo, sessionId, now = Date.now()) {
  const id = safeId(sessionId);
  if (!id) return false;
  const dir = baselineDir(repo);
  const file = join(dir, `${id}.json`);
  if (existsSync(file)) return false;
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) {
    try { if (now - statSync(join(dir, f)).mtimeMs > KEEP_MS) unlinkSync(join(dir, f)); } catch { /* gone already */ }
  }
  writeFileSync(file, JSON.stringify({ at: now, paths: dirtyPaths(repo) }));
  return true;
}

/** The baseline a session took in `repo`, as { at, paths: Set }, or null. */
export function readBaseline(repo, sessionId) {
  const id = safeId(sessionId);
  if (!id) return null;
  try {
    const j = JSON.parse(readFileSync(join(baselineDir(repo), `${id}.json`), 'utf8'));
    return Number.isFinite(j.at) && Array.isArray(j.paths) ? { at: j.at, paths: new Set(j.paths) } : null;
  } catch { return null; }
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain && process.argv[2] === '--baseline') {
  // A start-of-session hook never breaks a session: whatever fails, it exits 0 and says nothing.
  try {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    const event = JSON.parse(raw || '{}');
    const dir = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
    for (const r of reposOf(dir)) {
      try { takeBaseline(r.dir, event.session_id); } catch { /* this repo has no baseline */ }
    }
  } catch { /* no baseline this session */ }
}
