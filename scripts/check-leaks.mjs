#!/usr/bin/env node
// Does anything about to leave this repo name a relationship it must not name?
//
// An organization that works for several clients, or for two parties who must not
// learn about each other, keeps them apart by habit until the day a name slips into
// a page, a deck or a shared repo that the other side reads. A rule in prose is
// re-read by someone who already believes it; a list checked on every build says no.
//
// The terms live in `.leak-terms`, which is gitignored: the list of who must not be
// named is itself the leak, so it never enters the repo, and every machine that
// builds keeps its own. One term per line, `#` for comments, matched whole-word and
// case-insensitively. A line `scope: <glob>` limits the terms after it to the paths
// that glob matches (`scope: shared/**`), so a term can be fine at home and refused
// in the folder another party reads.
//
//   node scripts/check-leaks.mjs                 the default outgoing paths
//   node scripts/check-leaks.mjs <path>...       these files or folders
//   node scripts/check-leaks.mjs --json
//
// Exit 0 when clean or when no list exists (it says so), 1 on a hit.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIST = join(ROOT, '.leak-terms');
// What leaves the repo by default: the site, the published decks, the apps' sources,
// and the shared folders a partner reads (source/formats/partner-repo.md).
const DEFAULT = ['site/src', 'site/public', 'decks', 'apps', 'shared'];
const SKIP = new Set(['node_modules', 'dist', '.astro', '.wrangler', '.check', '.git']);
const TEXT = /\.(md|mdx|astro|html|js|mjs|ts|json|css|txt|svg|csv|yml|yaml)$/i;

export function parseTerms(text) {
  const rules = [];
  let scope = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = /^scope:\s*(.+)$/i.exec(line);
    if (m) { scope = m[1].trim() === '*' ? null : m[1].trim(); continue; }
    rules.push({ term: line, scope });
  }
  return rules;
}

const globRe = (glob) => new RegExp('^' + glob.split('**').map((p) =>
  p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
const termRe = (term) => new RegExp(`(?<![\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');

export function scan(files, rules, root = ROOT) {
  const hits = [];
  const compiled = rules.map((r) => ({ ...r, re: termRe(r.term), in: r.scope ? globRe(r.scope) : null }));
  for (const file of files) {
    const rel = relative(root, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    for (const r of compiled) {
      if (r.in && !r.in.test(rel)) continue;
      lines.forEach((l, i) => { if (r.re.test(l)) hits.push({ file: rel, line: i + 1, term: r.term }); });
    }
  }
  return hits;
}

function walk(p, out = []) {
  if (!existsSync(p)) return out;
  const st = statSync(p);
  if (st.isFile()) { if (TEXT.test(p)) out.push(p); return out; }
  for (const e of readdirSync(p)) if (!SKIP.has(e)) walk(join(p, e), out);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const targets = args.filter((a) => !a.startsWith('--'));
  if (!existsSync(LIST)) {
    const msg = 'check-leaks: no .leak-terms on this machine, nothing checked (see the header of this script)';
    console.log(json ? JSON.stringify({ checked: false, hits: [] }) : msg);
    process.exit(0);
  }
  const rules = parseTerms(readFileSync(LIST, 'utf8'));
  const files = (targets.length ? targets : DEFAULT).flatMap((t) => walk(resolve(ROOT, t)));
  const hits = scan(files, rules);
  if (json) console.log(JSON.stringify({ checked: true, files: files.length, terms: rules.length, hits }, null, 2));
  else {
    for (const h of hits) console.log(`${h.file}:${h.line}: names “${h.term}”`);
    console.log(`check-leaks: ${files.length} file(s), ${rules.length} term(s), ${hits.length} hit(s)`);
  }
  process.exit(hits.length ? 1 : 0);
}
