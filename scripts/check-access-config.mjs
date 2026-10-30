#!/usr/bin/env node
// Does every Worker that checks identity fail closed?
//
// Three settings decide whether a gated app is actually gated, and none of them shows
// in local dev (source/formats/webapp.md ▸ The config that keeps the gate shut). The
// one that bit several projects: a Worker with static assets serves a matching file
// before its own code runs, so the identity check in the code never sees the request
// for index.html. The page looks protected, because the API calls behind it are.
//
// A Worker "checks identity" when its config declares TEAM_DOMAIN or POLICY_AUD
// (lib/access.mjs). For each one found under the repo:
//   error    assets without run_worker_first: true
//   warning  workers_dev not set to false (fine only if Access is attached to the Worker)
//
//   node scripts/check-access-config.mjs [--json]
//
// Exit 1 on an error, 0 otherwise.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', 'dist', '.astro', '.wrangler']);
const NAMES = new Set(['wrangler.jsonc', 'wrangler.json']);

/** JSONC to JSON: comments and trailing commas out, strings left alone. */
export function parseJsonc(text) {
  let out = '', i = 0, inStr = false;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (inStr) { out += c; if (c === '\\') { out += n; i += 2; continue; } if (c === '"') inStr = false; i++; continue; }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i = text.indexOf('*/', i + 2) + 2; continue; }
    out += c; i++;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/** The findings for one parsed config. */
export function inspect(cfg) {
  const vars = cfg.vars || {};
  const gated = 'TEAM_DOMAIN' in vars || 'POLICY_AUD' in vars;
  if (!gated) return [];
  const out = [];
  if (cfg.assets && cfg.assets.run_worker_first !== true) {
    out.push({ severity: 'error', detail: 'has assets without "run_worker_first": true, so a matching file is served before the identity check runs' });
  }
  if (cfg.workers_dev !== false) {
    out.push({ severity: 'warning', detail: '"workers_dev" is not false: the workers.dev address escapes an Access application set on a hostname' });
  }
  return out;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    // A pack's templates/ are the files it writes into other repos, not Workers deployed from here;
    // they are checked where they land (the company pack's intranet runs its own copy of this check).
    if (e === 'templates' && /^packs\/[^/]+$/.test(relative(ROOT, dir))) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (NAMES.has(e)) out.push(p);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = [];
  for (const file of walk(ROOT)) {
    let cfg;
    try { cfg = parseJsonc(readFileSync(file, 'utf8')); } catch (e) {
      findings.push({ file: relative(ROOT, file), severity: 'error', detail: `does not parse: ${e.message}` });
      continue;
    }
    for (const f of inspect(cfg)) findings.push({ file: relative(ROOT, file), ...f });
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(findings, null, 2));
  else {
    for (const f of findings) console.log(`${f.severity === 'error' ? '✗' : '!'} ${f.file}: ${f.detail}`);
    console.log(`check-access-config: ${findings.filter((f) => f.severity === 'error').length} error(s), ${findings.filter((f) => f.severity === 'warning').length} warning(s)`);
  }
  process.exit(findings.some((f) => f.severity === 'error') ? 1 : 0);
}
