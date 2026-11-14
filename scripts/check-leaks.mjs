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
// A second pass needs no list: what a public page must never carry whoever it names. A path
// into the repo, a command, a markdown file's name, a to-do line's ^id, an HTML comment, a marker
// left unfilled (TODO, {{NAME}}, "seed, to confirm") all say "internal draft" to a reader, and
// none breaks a build. A sharing site built from an organization's intranet showed three of them
// in one page's script, a repo slug, an `npm run` command and a script path, read by the people
// the page was for. It reads the public pages (PUBLIC below: the site's pages, content and public
// folder, and its build when there is one), or the pages given as arguments. A page that names
// these on purpose (a how-to, a placeholder telling the owner where to drop files) says so once,
// anywhere in it: `check-leaks: internals-ok`, in a comment or the front matter, or
// <meta name="check-leaks" content="internals-ok">.
//
//   node scripts/check-leaks.mjs                 the default outgoing paths, and the public pages
//   node scripts/check-leaks.mjs <path>...       these files or folders, for both
//   node scripts/check-leaks.mjs --json
//   node scripts/check-leaks.mjs --no-internals  the list of terms only
//
// Exit 0 when clean (a missing list is said, and only skips the terms), 1 on a hit.

import { execFileSync } from 'node:child_process';
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
// What a visitor reads: the site's pages and content, its public folder (published decks
// included), and its build.
export const PUBLIC = ['site/src/pages', 'site/src/content', 'site/public', 'site/dist'];
const PAGE = /\.(html?|astro|mdx?)$/i;

// [pattern, what it is]. Read line by line, after the URLs are taken out: a link to a public
// repository's README is a link, not a leak.
export const INTERNALS = [
  [/(?<![\w/.-])(?:source|scripts|lib|packs|\.claude)\/[\w.-]+/, 'a path into the repo'],
  [/(?<![\w/.-])[\w-]+(?:\/[\w.-]+)*\.mdx?\b/, 'a markdown file\'s name'],
  [/\bnpm run\b|\bnpx [\w@]|\bnode (?:--\S+ )*(?:scripts|lib|\.claude)\//, 'a command'],
  [/(?:^|\s)\^[a-z0-9]{4,8}\b/i, 'a to-do line\'s ^id'],
  [/\bTODO\b|\bFIXME\b|\{\{\s*[A-Z][A-Z0-9_ .-]*\s*\}\}|seed, to confirm|\(to confirm\)/, 'a marker left unfilled'],
];
const OPT_OUT = /check-leaks:\s*internals-ok|name=["']check-leaks["'][^>]*content=["']internals-ok/;

/** The repo's own `owner/name`, from its origin, as one more internal a page must not name. */
export function slugPattern(root = ROOT) {
  let url = '';
  try { url = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
  const m = url.replace(/\.git$/, '').match(/([\w.-]+)\/([\w.-]+)$/);
  return m ? [new RegExp(`(?<![\\w./-])${`${m[1]}/${m[2]}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i'), 'the repo\'s name'] : null;
}

const blank = (m) => m.replace(/[^\n]/g, '');
const lineAt = (text, i) => text.slice(0, i).split('\n').length;

/** What internal a page carries: [{ line, what, text }], or [] when it opts out. */
export function internals(text, file = '', extra = []) {
  if (OPT_OUT.test(text)) return [];
  const hits = [];
  let body = text;
  if (/\.astro$/i.test(file)) {
    // What the build drops never reaches a visitor: the front matter (server code), the HTML and
    // JS comments, and the styles, whose comments the minifier removes. Measured on ten sites
    // built from the kit, their built pages carried none of the 103 comments in their sources.
    body = body.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?=\r?\n|$)/, blank)
      .replace(/<!--[\s\S]*?-->|<style\b[\s\S]*?<\/style>|\{\/\*[\s\S]*?\*\/\}/g, blank);
  } else {
    // An HTML comment ships. In markdown it is a note to self (`<!-- verify -->`); in a page, one
    // that holds a sentence is, while a deck's section labels (`<!-- COVER -->`, `<!-- PAGE 3 ·
    // the team and the plan -->`) say nothing: on ten sites built from the kit, the labels
    // were all under eight words or in capitals.
    const md = /\.mdx?$/i.test(file);
    const note = (c) => (c.match(/[\p{L}\p{N}'’-]+/gu) || []).length >= 8 && c.replace(/[^\p{Ll}]/gu, '').length > c.replace(/[^\p{Lu}]/gu, '').length;
    for (const m of body.matchAll(/<!--([\s\S]*?)(?:-->|$)/g)) {
      if (md || note(m[1])) {
        hits.push({ line: lineAt(body, m.index), what: 'an HTML comment', text: m[0].replace(/\s+/g, ' ').slice(0, 80) });
      }
    }
    body = body.replace(/<!--[\s\S]*?(?:-->|$)/g, blank);
  }
  body.split('\n').forEach((raw, i) => {
    const l = raw.replace(/\bhttps?:\/\/[^\s"'<>)]+/g, ' ');
    for (const [re, what] of [...INTERNALS, ...extra]) {
      const m = re.exec(l);
      if (m) hits.push({ line: i + 1, what, text: m[0].trim() });
    }
  });
  return hits.sort((a, b) => a.line - b.line);
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
  const listed = existsSync(LIST);
  const rules = listed ? parseTerms(readFileSync(LIST, 'utf8')) : [];
  const files = (targets.length ? targets : DEFAULT).flatMap((t) => walk(resolve(ROOT, t)));
  const hits = listed ? scan(files, rules) : [];
  const pages = args.includes('--no-internals') ? []
    : [...new Set((targets.length ? targets : PUBLIC).flatMap((t) => walk(resolve(ROOT, t))))].filter((f) => PAGE.test(f));
  const slug = slugPattern();
  const inside = pages.flatMap((f) => internals(readFileSync(f, 'utf8'), f, slug ? [slug] : []).map((h) => ({ file: relative(ROOT, f), ...h })));
  if (json) {
    console.log(JSON.stringify({ checked: listed, files: files.length, terms: rules.length, hits, pages: pages.length, internals: inside }, null, 2));
  } else {
    for (const h of hits) console.log(`${h.file}:${h.line}: names “${h.term}”`);
    for (const h of inside) console.log(`${h.file}:${h.line}: ${h.what} on a public page: “${h.text}”`);
    if (inside.length) {
      console.log('  Take it out of the page, or, if the page names it on purpose, mark the page `check-leaks: internals-ok` (see the header of this script).');
    }
    console.log(listed ? `check-leaks: ${files.length} file(s), ${rules.length} term(s), ${hits.length} hit(s)`
      : 'check-leaks: no .leak-terms on this machine, no names checked (see the header of this script)');
    if (!args.includes('--no-internals')) console.log(`check-leaks: ${pages.length} public page(s), ${inside.length} internal(s) showing`);
  }
  process.exit(hits.length || inside.length ? 1 : 0);
}
