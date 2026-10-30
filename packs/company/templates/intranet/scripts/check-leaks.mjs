#!/usr/bin/env node
// Does anything about to leave the company name a relationship it must not name?
//
// A company that works for several customers, or for two parties who must not learn about each
// other, keeps them apart by habit until the day a name slips into a deck, a document or a page that
// the other side reads. A rule in prose is re-read by someone who already believes it; a list
// checked on every build says no.
//
// Taken from the kit's check of the same name; here the list and the paths follow the
// company's five repos. The terms live in `.leak-terms` in the company folder, the parent of the
// five clones, which is no repo: the list of who must not be named is itself the leak, so it never
// enters a repo, and every machine that builds keeps its own. One term per line, `#` for comments,
// matched whole-word and case-insensitively. A line `scope: <glob>` limits the terms after it to the
// paths that glob matches, relative to the company folder (`scope: customers/decks/**`), so a term
// can be fine at home and refused in what one customer receives.
//
//   node scripts/check-leaks.mjs                 what leaves by default: the decks, the documents
//                                                and the pages for someone outside
//   node scripts/check-leaks.mjs <path>...       these files or folders
//   node scripts/check-leaks.mjs --json
//
// Exit 0 when clean or when no list exists (it says so), 1 on a hit.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const INTRANET = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = resolve(INTRANET, '..');
const LIST = join(FOLDER, '.leak-terms');
const SKIP = new Set(['node_modules', 'dist', '.astro', '.wrangler', '.check', '.git', '_template']);
const TEXT = /\.(md|mdx|astro|html|js|mjs|ts|json|css|txt|svg|csv|yml|yaml)$/i;

/** What leaves the company by default: decks and documents sent to someone, and the outside pages. */
async function outgoing() {
  const { repos } = await import('../config.mjs');
  return [
    join(INTRANET, 'outside'),
    ...[repos.strategy, repos.customers].flatMap((r) => [join(FOLDER, r, 'decks'), join(FOLDER, r, 'documents')]),
  ];
}

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

export function scan(files, rules, root = FOLDER) {
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
    const msg = 'check-leaks: no .leak-terms in the company folder on this machine, nothing checked (see the header of this script)';
    console.log(json ? JSON.stringify({ checked: false, hits: [] }) : msg);
    process.exit(0);
  }
  const rules = parseTerms(readFileSync(LIST, 'utf8'));
  const files = (targets.length ? targets.map((t) => resolve(t)) : await outgoing()).flatMap((t) => walk(t));
  const hits = scan(files, rules);
  if (json) console.log(JSON.stringify({ checked: true, files: files.length, terms: rules.length, hits }, null, 2));
  else {
    for (const h of hits) console.log(`${h.file}:${h.line}: names “${h.term}”`);
    console.log(`check-leaks: ${files.length} file(s), ${rules.length} term(s), ${hits.length} hit(s)`);
  }
  process.exit(hits.length ? 1 : 0);
}
