#!/usr/bin/env node
// Does the workspace still match the map?
//
// ORGANIGRAM.md's repo table is the ONE list of repos this organization spans.
// It is prose, written by a human, and it rots quietly: a repo gains a remote, a
// project is renamed, a folder is deleted, a new project appears beside the others
// and nobody adds the row. Nothing turns red when that happens.
//
// So this reads the table, then looks at the disk and at what git actually says,
// and reports every disagreement. It never writes a second copy of the map: the
// table stays the source of truth and this is the check on it.
//
// Zero dependencies, Node built-ins only. Docs: ORGANIGRAM.md ▸ One map.
//
// Usage:  node scripts/check-workspace.mjs [--offline] [--json]

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const OFFLINE = args.includes('--offline');
const ROOT = resolve(process.cwd());
const WORKSPACE = dirname(ROOT); // the folder this repo sits in, i.e. where siblings live
const TEMPLATE = 'pyduan/agentic-organization';

const findings = [];
const add = (severity, what, detail) => findings.push({ severity, what, detail });
const expand = (p) => resolve(p.replace(/^~/, homedir()));

// ------------------------------------------------------------ read the map

const MAP = join(ROOT, 'ORGANIGRAM.md');
if (!existsSync(MAP)) {
  add('fail', 'ORGANIGRAM.md', 'missing — the workspace map is this repo\'s only list of repos');
}

const rows = [];
if (existsSync(MAP)) {
  const lines = (await readFile(MAP, 'utf8')).split('\n');
  let inTable = false;
  for (const line of lines) {
    if (/^\|\s*Repo\s*\|/i.test(line)) { inTable = true; continue; }
    if (inTable && !line.startsWith('|')) { if (rows.length) break; else continue; }
    if (!inTable || /^\|\s*-+/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const ticked = (c) => [...c.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const [slug] = ticked(cells[0]);
    const [folder] = ticked(cells[1]);
    // A row still carrying the template's placeholders is an unfinished setup, not a lie.
    const isPlaceholder = /add a row|<owner>|<repo>|<other>/i.test(cells[0] + cells[1]);
    const url = (cells.join(' ').match(/https?:\/\/[^\s|)]+/) || [])[0];
    const isSelf = /this one/i.test(cells[0]);
    rows.push({ slug, folder, url, isSelf, isPlaceholder, raw: cells[0] });
  }
}

const real = rows.filter((r) => !r.isPlaceholder);
if (!real.length) {
  add('warn', 'ORGANIGRAM.md', 'the repo table is still the template — run the setup skill so the map describes this organization');
}

// ------------------------------------------------------------ this repo's own remote

const gitOrigin = async (dir) => {
  try {
    const { stdout } = await run('git', ['-C', dir, 'remote', 'get-url', 'origin']);
    return stdout.trim();
  } catch { return null; }
};
const slugOf = (url) => (url ? (url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/) || [])[1] || null : null);

const ownOrigin = await gitOrigin(ROOT);
if (ownOrigin && slugOf(ownOrigin) === TEMPLATE) {
  // Two very different situations share one symptom, so tell them apart by whether
  // this repo has been set up: the template itself (and a fresh copy nobody has run
  // setup in) is fine; a working project still pointing there is one push away from
  // publishing its content into someone else's repo.
  let brief = '';
  try { brief = await readFile(join(ROOT, 'source', 'brief.md'), 'utf8'); } catch { /* no brief yet */ }
  const setUp = brief && !/TODO|\{\{/.test(brief);
  if (setUp) add('fail', 'origin', `this project's origin is still the template (${TEMPLATE}) — a push from here writes into someone else's repo. Create your own copy (SETUP.md) and repoint origin.`);
  else add('info', 'origin', `points at the template (${TEMPLATE}), which is right for the template itself and for a copy that has not run setup yet`);
}

// ------------------------------------------------------------ each declared repo

for (const r of real) {
  const id = r.slug || r.raw || '(unnamed row)';
  if (!r.slug) { add('fail', id, 'row has no repo slug in backticks — check-workspace reads the first backticked value'); continue; }
  if (!r.folder) { add('warn', id, 'row has no local folder in backticks — the AI cannot tell where to clone or pull it'); continue; }

  const dir = expand(r.folder);
  if (!existsSync(dir)) {
    add('info', id, `listed but not cloned here (${r.folder}) — normal if this machine has no access; clone it when a task needs it`);
    continue;
  }
  if (!existsSync(join(dir, '.git'))) { add('fail', id, `${r.folder} exists but is not a git repo`); continue; }

  const origin = await gitOrigin(dir);
  const found = slugOf(origin);
  if (!origin) add('warn', id, `${r.folder} has no origin remote, so it is local-only. Say so in the row, or give it a remote.`);
  else if (found && r.slug && found.toLowerCase() !== r.slug.toLowerCase()) {
    add('fail', id, `the row says \`${r.slug}\` but ${r.folder}'s origin is \`${found}\` — one of the two is wrong`);
  }

  // A sibling kit repo must point home. The map is here; over there we only want a pointer.
  if (!r.isSelf && existsSync(join(dir, 'CLAUDE.md'))) {
    const guide = await readFile(join(dir, 'CLAUDE.md'), 'utf8');
    const homeSlug = slugOf(ownOrigin) || basename(ROOT);
    const homeName = homeSlug.split('/').pop();
    if (!new RegExp(`(where this repo sits|${homeName})`, 'i').test(guide)) {
      add('warn', id, `its CLAUDE.md never mentions ${homeName} — add a "Where this repo sits" pointer so a session starting there knows which repo holds the shared guides and the map`);
    }
    if (/^\|\s*Repo\s*\|/im.test(guide)) {
      add('warn', id, 'its CLAUDE.md contains its own repo table — that is a second copy of the map and will drift. Keep a pointer, delete the copy.');
    }
  }

  if (r.url && !OFFLINE) {
    try {
      const res = await fetch(r.url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10000) });
      if (!res.ok) add('warn', id, `${r.url} answered ${res.status}`);
    } catch (e) {
      add('warn', id, `${r.url} did not answer (${e.name === 'TimeoutError' ? 'timeout' : e.message})`);
    }
  }
}

// ------------------------------------------------------------ what is on disk but not on the map

const declared = new Set(real.map((r) => (r.folder ? expand(r.folder) : null)).filter(Boolean));
declared.add(ROOT);
let siblings = [];
try { siblings = await readdir(WORKSPACE, { withFileTypes: true }); } catch { /* workspace unreadable: nothing to say */ }
for (const e of siblings) {
  if (!e.isDirectory() || e.name.startsWith('.')) continue;
  const dir = join(WORKSPACE, e.name);
  if (declared.has(dir)) continue;
  const looksLikeKit = existsSync(join(dir, 'CLAUDE.md')) && existsSync(join(dir, 'source', 'brief.md'));
  if (looksLikeKit) {
    add('warn', e.name, `runs this kit at ${dir} but has no row in ORGANIGRAM.md — no session will know it exists`);
  }
}

// ------------------------------------------------------------ report

const fails = findings.filter((f) => f.severity === 'fail');
const warns = findings.filter((f) => f.severity === 'warn');

if (AS_JSON) {
  console.log(JSON.stringify({ ok: fails.length === 0, fails: fails.length, warns: warns.length, findings }, null, 2));
} else {
  const icon = { fail: '✘', warn: '▲', info: '·' };
  if (!findings.length) console.log('✓ the map and the workspace agree');
  for (const f of findings) console.log(`  ${icon[f.severity]} ${f.what}\n      ${f.detail}`);
  if (findings.length) console.log(`\n${fails.length === 0 ? '✓' : '✘'} ${fails.length} failure(s), ${warns.length} warning(s), ${real.length} repo(s) on the map`);
}

process.exit(fails.length ? 1 : 0);
