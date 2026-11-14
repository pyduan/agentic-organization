#!/usr/bin/env node
// Stop hook: when this session changed the source of a declared copy, propose its rebuild.
//
// A copy built from a source elsewhere (derived.json, lib/derived.mjs) goes stale the moment its
// source moves, and the session that moved it is the one that knows. The freshness sweep finds
// the gap later, once committed; this says it while the person is still there. It proposes and
// never runs anything: a rebuild often publishes, and publishing waits for a yes.
//
// What the session changed: the files its Write and Edit calls named, the files still modified
// that own-changes.mjs gives to it, and the commits made during its own tool calls, pushed or
// not. A copy the session rebuilt too (it touched the copy's own file) is left out. It speaks
// once per copy and per session (a newly touched copy makes it speak again), never twice in one
// stop (stop_hook_active), and is silent on its own failure and where no derived.json exists.
//
// Brought by an organization whose hook proposed recomputing a dated page whenever a session
// touched one of its sources; here the list of copies is the project's own derived.json.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { attribute, leftoversOf, readBaseline, reposOf, windows } from './own-changes.mjs';

const HOOKS = dirname(fileURLToPath(import.meta.url));
const ROUTER = resolve(HOOKS, '..', '..');
const WRITERS = /^(Edit|Write|MultiEdit|NotebookEdit)$/;
const SHOWN = 4;

const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
const git = (repo, ...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 });

/** What the session changed in each repo: [{ dir, path }]. */
export function sessionTouches(transcript, repos, sessionId) {
  const spans = windows(transcript);
  const start = Math.min(...spans.map((s) => s.start), Date.now());
  const out = [];
  const written = [];
  for (const line of String(transcript).split('\n')) {
    if (!line.includes('"tool_use"')) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    for (const c of e?.message?.content || []) {
      const p = c?.type === 'tool_use' && WRITERS.test(c.name) ? (c.input?.file_path || c.input?.notebook_path) : null;
      if (p && isAbsolute(p)) written.push(real(p));
    }
  }
  for (const dir of repos) {
    const root = real(dir);
    const add = (path) => out.push({ dir, path: path.split('\\').join('/') });
    for (const p of written) {
      const rel = relative(root, p);
      if (rel && !rel.startsWith('..') && !isAbsolute(rel)) add(rel);
    }
    try {
      const b = readBaseline(dir, sessionId);
      const { mine } = attribute(leftoversOf(dir).filter((l) => !l.commit), spans, b ? new Map([[dir, b]]) : new Map());
      for (const l of mine) add(l.path);
    } catch { /* not readable */ }
    try {
      for (const l of git(dir, 'log', '--all', `--since=@${Math.floor(start / 1000) - 5}`, '--format=%H %ct').split('\n').filter(Boolean)) {
        const [sha, ct] = l.split(' ');
        const t = Number(ct) * 1000;
        if (!spans.some((s) => t >= s.start && t <= s.end)) continue;
        for (const f of git(dir, 'diff-tree', '--root', '--no-commit-id', '--name-only', '-r', sha).split('\n').filter(Boolean)) add(f);
      }
    } catch { /* not readable */ }
  }
  return out;
}

export function reason(copies) {
  const lines = ['Copies to rebuild (derived.json). This session changed the source of:'];
  for (const c of copies) {
    const files = c.touched.slice(0, SHOWN).join(', ') + (c.touched.length > SHOWN ? ` and ${c.touched.length - SHOWN} more` : '');
    lines.push(`- ${c.copy}${c.why ? ` (${c.why})` : ''}: changed ${files}.${c.rebuild ? ` Rebuild: \`${c.rebuild}\`, then commit ${c.copy}.` : ''}`);
  }
  lines.push('In your answer, propose the rebuild to the person, naming each copy and why, and run nothing on your own: a rebuilt copy is often public. If the source change is not pushed yet, say that first. If they already said no, or it is done, say so in one line and stop.');
  return lines.join('\n');
}

async function main() {
  let event = {};
  try { event = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return; }
  if (event.stop_hook_active === true || !event.session_id) return;
  const dir = process.env.CLAUDE_PROJECT_DIR || ROUTER;
  const repos = [...new Set([ROUTER, ...reposOf(dir).map((r) => r.dir)].map(real))];
  const { readDerived, touchedCopies } = await import(pathToFileURL(join(ROUTER, 'lib', 'derived.mjs')).href);
  const copies = repos.flatMap((r) => { try { return readDerived(r); } catch { return []; } });
  if (!copies.length) return;
  let transcript = '';
  try { transcript = readFileSync(event.transcript_path, 'utf8'); } catch { return; }
  const sourceRepos = [...new Set([...repos, ...copies.map((c) => real(c.sourceDir))])].filter((r) => existsSync(join(r, '.git')));
  const due = touchedCopies(copies, sessionTouches(transcript, sourceRepos, event.session_id));
  if (!due.length) return;
  const key = (c) => `${real(c.dir)}:${c.copy}`;
  const mark = join(git(ROUTER, 'rev-parse', '--absolute-git-dir').trim(), 'derived-said', `${String(event.session_id).replace(/[^\w-]/g, '')}.json`);
  let said = [];
  try { said = JSON.parse(readFileSync(mark, 'utf8')); } catch { /* first time */ }
  const fresh = due.filter((c) => !said.includes(key(c)));
  if (!fresh.length) return;
  mkdirSync(dirname(mark), { recursive: true });
  writeFileSync(mark, JSON.stringify([...said, ...fresh.map(key)]));
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason: reason(fresh) })}\n`);
}

const isMain = (() => { try { return real(process.argv[1]) === real(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) main().catch(() => {}).finally(() => process.exit(0));
