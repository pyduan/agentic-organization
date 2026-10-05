#!/usr/bin/env node
// Does the workspace still match the map?
//
// ORGANIGRAM.md's repo table is the ONE list of repos this organization spans.
// It is prose, written by a human, and it rots quietly: a repo gains a remote, a
// project is renamed, a folder is deleted, a new project appears beside the others
// and nobody adds the row. Nothing turns red when that happens.
//
// So this reads the table, finds each repo on this machine by its origin
// (lib/workspace.mjs), and reports every disagreement. It never writes a second
// copy of the map: the table stays the source of truth and this is the check on it.
//
// Where a repo sits is not part of the map, because it differs from one machine to
// the next. It is found beside this repo, or read from the per-machine file that
// `--at` writes. A map that still carries a "Local folder" column is read as a
// hint, and the report says when the hint describes some other machine.
//
// Zero dependencies, Node built-ins only. Docs: ORGANIGRAM.md ▸ One map.
//
// Usage:  node scripts/check-workspace.mjs [--offline] [--json]
//         node scripts/check-workspace.mjs --at=<owner/repo>=<path>   record where a repo sits here

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
  TEMPLATE_SLUG, expand, isRepoRoot, gitOrigin, originSlug, isTemplateSlug, readMap, locateRows,
  siblingRepos, machineMapPath, rememberRepo, sameSlug,
} from '../lib/workspace.mjs';

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const OFFLINE = args.includes('--offline');
const ROOT = resolve(process.cwd());
const WORKSPACE = dirname(ROOT); // the folder this repo sits in, i.e. where siblings live

const at = (args.find((a) => a.startsWith('--at=')) || '').slice(5);
if (at) {
  const [slug, path] = at.split(/=(.+)/);
  if (!slug || !path || !isRepoRoot(expand(path))) {
    console.error('Usage: --at=<owner/repo>=<path>, where <path> is a git repo on this machine.');
    process.exit(1);
  }
  const found = await originSlug(expand(path));
  if (!sameSlug(found, slug)) {
    console.error(`${path} has origin ${found || '(none)'}, not ${slug}. Nothing recorded.`);
    process.exit(1);
  }
  console.log(`Recorded ${slug} → ${expand(path)} in ${rememberRepo(slug, path)}`);
  process.exit(0);
}

const findings = [];
const add = (severity, what, detail) => findings.push({ severity, what, detail });

// ------------------------------------------------------------ read the map

const map = await readMap(ROOT);
if (!map.exists) add('fail', 'ORGANIGRAM.md', 'missing — the workspace map is this repo\'s only list of repos');
const real = map.rows.filter((r) => !r.isPlaceholder);
if (map.exists && !real.length) {
  add('warn', 'ORGANIGRAM.md', 'the repo table is still the template — run the setup skill so the map describes this organization');
}

// ------------------------------------------------------------ this repo's own remote

const ownOrigin = await gitOrigin(ROOT);
if (isTemplateSlug((await originSlug(ROOT)) || '')) {
  // Two very different situations share one symptom, so tell them apart by whether
  // this repo has been set up: the template itself (and a fresh copy nobody has run
  // setup in) is fine; a working project still pointing there is one push away from
  // publishing its content into someone else's repo.
  let brief = '';
  try { brief = await readFile(join(ROOT, 'source', 'brief.md'), 'utf8'); } catch { /* no brief yet */ }
  const setUp = brief && !/TODO|\{\{/.test(brief);
  if (setUp) add('fail', 'origin', `this project's origin is still the template (${TEMPLATE_SLUG}) — a push from here writes into someone else's repo. Create your own copy (SETUP.md) and repoint origin.`);
  else add('info', 'origin', `points at the template (${TEMPLATE_SLUG}), which is right for the template itself and for a copy that has not run setup yet`);
}

// ------------------------------------------------------------ each declared repo

const located = await locateRows(ROOT, real, { workspace: WORKSPACE });
const machineFile = machineMapPath();

for (const r of located) {
  const id = r.slug || r.label || '(unnamed row)';
  if (!r.slug) { add('fail', id, 'row has no repo slug in backticks — the first backticked value in the first column is read as `owner/repo`'); continue; }

  if (!r.dir) {
    // A folder in the legacy column that exists but has no origin is a local-only
    // repo, which cannot be found by origin anywhere. Say that, not "not cloned".
    if (r.folder && isRepoRoot(expand(r.folder)) && !(await gitOrigin(expand(r.folder)))) {
      add('warn', id, `${r.folder} has no origin remote, so it is local-only and nothing can confirm it is ${r.slug}. Give it a remote, or say in the row that it is local-only.`);
      continue;
    }
    if (r.folder && isRepoRoot(expand(r.folder))) {
      add('fail', id, `the map's folder ${r.folder} holds ${await originSlug(expand(r.folder))}, not ${r.slug} — one of the two is wrong`);
      continue;
    }
    add('info', id, `not on this machine — looked beside this repo (${WORKSPACE})` +
      `${r.folder ? `, at the map's folder ${r.folder}` : ''} and in ${machineFile}. Normal if this machine has no access; ` +
      `clone it beside this repo when a task needs it, or record where it is with --at=${r.slug}=<path>`);
    continue;
  }

  if (r.hintStale) {
    add('info', id, `found at ${r.dir} by its origin; the map's folder column says ${r.folder}, which describes some other machine. ` +
      'Where a repo sits is no longer read from the map: drop the column when convenient.');
  }

  // A sibling kit repo must point home. The map is here; over there we only want a pointer.
  if (r.how !== 'self' && existsSync(join(r.dir, 'CLAUDE.md'))) {
    const guide = await readFile(join(r.dir, 'CLAUDE.md'), 'utf8');
    const homeName = ((await originSlug(ROOT)) || basename(ROOT)).split('/').pop();
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

// A kit project sitting beside this one is not necessarily part of this
// organization: one folder of repos often holds several unrelated ones. Warning
// on every such neighbour asked owners to add other organizations' repos to their
// own map, an alarm nobody could clear without making the map lie (reported
// 2026-09-15). So it warns only when the neighbour says it belongs here, by naming
// this repo in its CLAUDE.md, and otherwise just mentions it.
const declared = new Set([ROOT, ...located.map((r) => r.dir).filter(Boolean)]);
const homeName = ((await originSlug(ROOT)) || basename(ROOT)).split('/').pop();
for (const s of await siblingRepos(WORKSPACE)) {
  if (declared.has(s.dir)) continue;
  const looksLikeKit = existsSync(join(s.dir, 'CLAUDE.md')) && existsSync(join(s.dir, 'source', 'brief.md'));
  if (!looksLikeKit || isTemplateSlug(s.slug || '')) continue;
  let guide = '';
  try { guide = await readFile(join(s.dir, 'CLAUDE.md'), 'utf8'); } catch { /* unreadable */ }
  if (new RegExp(`\\b${homeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(guide)) {
    add('warn', basename(s.dir), `its CLAUDE.md points at ${homeName}, but ORGANIGRAM.md has no row for it — no session here will know it exists`);
  } else {
    add('info', basename(s.dir), `another kit project sits beside this one (${s.slug || s.dir}); if it belongs to this organization, give it a row`);
  }
}

// ------------------------------------------------------------ report

const fails = findings.filter((f) => f.severity === 'fail');
const warns = findings.filter((f) => f.severity === 'warn');
const found = located.filter((r) => r.dir).length;

if (AS_JSON) {
  console.log(JSON.stringify({
    ok: fails.length === 0, fails: fails.length, warns: warns.length,
    repos: located.map(({ slug, dir, how, hintStale }) => ({ slug, dir, how, hintStale })), findings,
  }, null, 2));
} else {
  const icon = { fail: '✘', warn: '▲', info: '·' };
  for (const f of findings) console.log(`  ${icon[f.severity]} ${f.what}\n      ${f.detail}`);
  // The verdict names what it examined, so "agree" cannot be printed over nothing.
  console.log(`\n${fails.length === 0 ? '✓' : '✘'} ${fails.length} failure(s), ${warns.length} warning(s); ` +
    `${real.length} repo(s) on the map, ${found} found on this machine`);
}

process.exit(fails.length ? 1 : 0);
