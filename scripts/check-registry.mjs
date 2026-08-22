#!/usr/bin/env node
// Does the workspace map still match the workspace?
//
// Two files describe the same organization: ORGANIGRAM.md (prose, for the AI and for
// you) and one .agentic/manifest.json per repo (structured, for tools). Both are
// hand-written, so both drift — a repo gets a remote, an area is renamed, a folder is
// deleted — and nothing turns red when they stop agreeing. This walks the workspace
// and reports every disagreement it can see.
//
// Zero dependencies, Node built-ins only. Docs: docs/registry.md.
//
// Usage:  node scripts/check-registry.mjs [--root=~/projects] [--offline] [--json]

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const OFFLINE = args.includes('--offline');
const REPO = resolve(process.cwd());

const rawRoot = (args.find((a) => a.startsWith('--root=')) || '').slice(7);
const ROOT = rawRoot
  ? resolve(rawRoot.replace(/^~/, homedir()))
  : dirname(REPO); // default: the folder this repo sits in, i.e. the workspace

const findings = [];
const add = (severity, what, detail) => findings.push({ severity, what, detail });

const KINDS = new Set(['org', 'project', 'toolbox', 'area']);
const SENSITIVITIES = new Set(['open', 'confidential']);
const VISIBILITIES = new Set(['public', 'private', 'local-only']);
const APP_TARGETS = new Set(['pages', 'private-worker', 'none']);
const LEVELS = new Set(['full', 'pointers', 'none']);

// ------------------------------------------------------------ collect manifests

const manifests = [];
let entries = [];
try {
  entries = await readdir(ROOT, { withFileTypes: true });
} catch {
  add('fail', ROOT, 'workspace root cannot be read');
}

for (const e of entries) {
  if (!e.isDirectory() || e.name.startsWith('.')) continue;
  const dir = join(ROOT, e.name);
  const path = join(dir, '.agentic', 'manifest.json');
  if (!existsSync(path)) {
    // A folder with a repo in it but no manifest is invisible to every tool here.
    if (existsSync(join(dir, '.git')) || existsSync(join(dir, 'CLAUDE.md'))) {
      add('warn', e.name, 'looks like a project but has no .agentic/manifest.json — no tool can see it');
    }
    continue;
  }
  try {
    manifests.push({ dir, path, m: JSON.parse(await readFile(path, 'utf8')) });
  } catch (err) {
    add('fail', e.name, `.agentic/manifest.json is not valid JSON: ${err.message}`);
  }
}

// ------------------------------------------------------------ validate each one

const seen = new Map();

for (const { dir, m } of manifests) {
  const id = m.slug || dir;

  // An untouched template manifest is not a broken one, it is an unfinished setup.
  // Say that once, the way the kit says it about a brief.md full of placeholders,
  // instead of three cryptic failures about a repo that does not exist yet.
  if (JSON.stringify(m).includes('TODO')) {
    add('warn', id, 'manifest is still the template — run the setup skill in that repo');
    continue;
  }
  const need = (field, value, allowed) => {
    if (value === undefined || value === null || value === '') add('fail', id, `missing "${field}"`);
    else if (allowed && !allowed.has(value)) add('fail', id, `"${field}" is "${value}", expected one of ${[...allowed].join(' · ')}`);
  };

  if (m.manifest_version !== 1) add('warn', id, `manifest_version is ${m.manifest_version}, this checker knows version 1`);
  need('slug', m.slug);
  need('name', m.name);
  need('kind', m.kind, KINDS);
  need('sensitivity', m.sensitivity, SENSITIVITIES);
  need('summary', m.summary);

  if (seen.has(m.slug)) add('fail', id, `slug also used by ${seen.get(m.slug)} — slugs must be unique`);
  else seen.set(m.slug, dir);

  const repo = m.repo || {};
  need('repo.visibility', repo.visibility, VISIBILITIES);
  if (repo.path) {
    const declared = resolve(repo.path.replace(/^~/, homedir()));
    if (declared !== dir) add('fail', id, `repo.path says ${repo.path} but the manifest is in ${dir}`);
  } else add('fail', id, 'missing "repo.path"');

  const publish = m.publish || {};
  need('publish.apps', publish.apps, APP_TARGETS);

  const expose = m.expose || {};
  need('expose.level', expose.level, LEVELS);
  if (m.sensitivity === 'confidential' && expose.level === 'full') {
    add('warn', id, 'confidential repo exposes "full" — content may be copied out automatically; docs/registry.md says this needs a dated decision');
  }
  for (const entry of expose.todos || []) {
    const rel = typeof entry === 'string' ? entry : entry?.path;
    if (!rel) { add('fail', id, 'an expose.todos entry has no path'); continue; }
    if (!existsSync(join(dir, rel))) add('fail', id, `expose.todos points at ${rel}, which does not exist`);
  }

  // The claim that rots fastest: what git actually says about the remote.
  let origin = null;
  try {
    const { stdout } = await run('git', ['-C', dir, 'remote', 'get-url', 'origin']);
    origin = stdout.trim();
  } catch { /* no remote, or not a repo */ }

  if (origin && repo.visibility === 'local-only') {
    add('fail', id, `visibility says local-only but git has a remote: ${origin}`);
  }
  if (!origin && repo.visibility !== 'local-only' && m.kind !== 'area') {
    add('warn', id, `visibility says ${repo.visibility} but git has no remote`);
  }
  if (origin && repo.remote && origin !== repo.remote) {
    add('fail', id, `repo.remote says ${repo.remote} but git says ${origin}`);
  }
  if (origin && /github\.com[:/]([^/]+)\//.test(origin) && m.kind !== 'area') {
    const owner = origin.match(/github\.com[:/]([^/]+)\//)[1];
    if (m.upstream_template && owner === m.upstream_template) {
      add('fail', id, `origin still points at the template owner (${owner}) — pushing would publish to someone else's repo`);
    }
  }
}

// ------------------------------------------------------------ cross-check the prose

const organigram = join(REPO, 'ORGANIGRAM.md');
if (existsSync(organigram)) {
  const text = await readFile(organigram, 'utf8');
  for (const { m } of manifests) {
    if (m.slug && !text.includes(m.slug)) {
      add('fail', m.slug, 'has a manifest but no row in ORGANIGRAM.md — the human map is missing a repo');
    }
  }
  // Rows name repos in backticks; anything named there should have a manifest.
  const named = new Set([...text.matchAll(/^\|\s*\*\*`([^`]+)`\*\*/gm)].map((x) => x[1]));
  for (const slug of named) {
    if (!seen.has(slug)) add('warn', slug, 'listed in ORGANIGRAM.md but no manifest found in the workspace');
  }
} else {
  add('warn', 'ORGANIGRAM.md', 'not found in this repo — nothing to cross-check the manifests against');
}

// ------------------------------------------------------------ is the site still up

if (!OFFLINE) {
  for (const { m } of manifests) {
    const url = m.publish?.site;
    if (!url) continue;
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
      if (!res.ok) add('warn', m.slug, `publish.site ${url} answered ${res.status}`);
    } catch (err) {
      add('warn', m.slug, `publish.site ${url} did not answer (${err.message})`);
    }
  }
}

// ------------------------------------------------------------ report

const rank = { fail: 0, warn: 1, info: 2 };
findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

if (AS_JSON) {
  console.log(JSON.stringify({ root: ROOT, repos: manifests.length, findings }, null, 2));
} else {
  console.log(`Workspace: ${ROOT}  ·  ${manifests.length} repo(s) with a manifest\n`);
  if (!findings.length) console.log('Everything agrees: manifests, ORGANIGRAM.md, and git.');
  for (const f of findings) {
    const mark = f.severity === 'fail' ? 'FAIL' : f.severity === 'warn' ? 'warn' : 'info';
    console.log(`${mark.padEnd(5)} ${f.what}: ${f.detail}`);
  }
}

process.exit(findings.some((f) => f.severity === 'fail') ? 1 : 0);
