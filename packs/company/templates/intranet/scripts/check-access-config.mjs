#!/usr/bin/env node
// Does every Worker in this repo that checks identity fail closed?
//
// The setting that bit several projects does not show in local dev: a Worker with static assets
// serves a matching file before its own code runs, so the identity check in the code never sees the
// request for index.html. The page looks protected, because the API calls behind it are.
//
// Kept apart from the kit's check of the same name because the layout differs: this repo holds the
// intranet's Worker and one Worker per page for someone outside, and both start with empty values
// until Access is in front. So a Worker "checks identity" when its vars declare TEAM_DOMAIN or
// POLICY_AUD (written by scripts/protect-access.mjs --write-vars) or its main file reads one. The
// kit's warning on workers_dev is left out: Access here is attached to the Worker itself, which
// covers its workers.dev address (DECISIONS.md ▸ A generic workers.dev subdomain).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', 'dist', '.astro', '.wrangler', 'public']);
const NAMES = new Set(['wrangler.jsonc', 'wrangler.json']);
const IDENTITY = ['TEAM_DOMAIN', 'POLICY_AUD'];

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

/** The findings for one parsed config; `code` is the text of its main file, when there is one. */
export function inspect(cfg, code = '') {
  const vars = cfg.vars || {};
  const gated = IDENTITY.some((k) => k in vars || new RegExp(`\\b${k}\\b`).test(code));
  if (!gated) return [];
  if (cfg.assets && cfg.assets.run_worker_first !== true) {
    return [{ severity: 'error', detail: 'has assets without "run_worker_first": true, so a matching file is served before the identity check runs' }];
  }
  return [];
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (NAMES.has(e)) out.push(p);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = [];
  const files = walk(ROOT);
  for (const file of files) {
    let cfg;
    try { cfg = parseJsonc(readFileSync(file, 'utf8')); } catch (e) {
      findings.push({ file: relative(ROOT, file), severity: 'error', detail: `does not parse: ${e.message}` });
      continue;
    }
    const main = cfg.main ? join(dirname(file), cfg.main) : null;
    const code = main && existsSync(main) ? readFileSync(main, 'utf8') : '';
    for (const f of inspect(cfg, code)) findings.push({ file: relative(ROOT, file), ...f });
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(findings, null, 2));
  else {
    for (const f of findings) console.log(`✗ ${f.file}: ${f.detail}`);
    console.log(`check-access-config: ${files.length} Worker config(s), ${findings.length} error(s)`);
  }
  process.exit(findings.length ? 1 : 0);
}
