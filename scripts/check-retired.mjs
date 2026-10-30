#!/usr/bin/env node
// Does a guide still describe a route we retired?
//
// A decision moves the work; nothing moves the sentences that describe the old work, and a session
// follows the sentence it reads. On a live project, the routing table kept saying for three weeks
// where a kind of page used to be built: a teammate built one there, because that is what he was
// told, and a sweep the same day found dozens of such sentences across several repos.
//
// So a route that is retired leaves its old wording in source/quality/retired-claims.json, in the
// same change as the decision: a `pattern` precise enough to match the instruction and not its
// history, an `unless` for lines that mention it as history ("until", "used to"), the `decision`
// that retired it, and what to `say` instead. `allow` lists files that quote it on purpose.
// This reads every guide of the repo; the dated logs (decisions, journal, changelog) are history
// and are not read.
//
//   node scripts/check-retired.mjs [--json]
//
// Exit 1 on a hit, 0 otherwise.

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIST = join(ROOT, 'source', 'quality', 'retired-claims.json');
const GUIDES = ['AGENTS.md', 'CLAUDE.md', 'FEATURES.md', 'README.md', 'QUICKSTART.md', 'SETUP.md', 'ORGANIGRAM.md', 'STACK.md', 'CONNECTORS.md', 'docs', 'source/formats',
  'source/brand', 'source/brief.md', '.claude/skills', 'routines', 'projects'];
const HISTORY = /(?:^|\/)(?:CHANGELOG|decisions|journal|DECISIONS|JOURNAL)\.md$/;
const SKIP = new Set(['node_modules', 'dist', '.git', 'assets']);

function walk(p, out = []) {
  if (!existsSync(p)) return out;
  if (statSync(p).isFile()) { if (/\.md$/.test(p)) out.push(p); return out; }
  for (const e of readdirSync(p)) if (!SKIP.has(e)) walk(join(p, e), out);
  return out;
}

/** The hits of every claim in the given files: [{ file, line, id, say, text }]. */
export function scan(claims, files, root = ROOT) {
  const hits = [];
  for (const c of claims) {
    const re = new RegExp(c.pattern, 'i');
    const unless = c.unless ? new RegExp(c.unless, 'i') : null;
    const allow = new Set(c.allow || []);
    for (const f of files) {
      const rel = relative(root, f);
      if (HISTORY.test(rel) || allow.has(rel)) continue;
      readFileSync(f, 'utf8').split('\n').forEach((text, i) => {
        if (re.test(text) && !(unless && unless.test(text))) hits.push({ file: rel, line: i + 1, id: c.id, say: c.say, text: text.trim() });
      });
    }
  }
  return hits;
}

export function claimsOf(text) {
  const spec = JSON.parse(text);
  for (const c of spec.claims || []) {
    for (const k of ['id', 'pattern', 'say']) if (!c[k]) throw new Error(`retired-claims.json: a claim without "${k}"`);
    new RegExp(c.pattern); // refuse a pattern that does not compile, before it silently matches nothing
  }
  return spec.claims || [];
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const claims = existsSync(LIST) ? claimsOf(readFileSync(LIST, 'utf8')) : [];
  const files = GUIDES.flatMap((g) => walk(join(ROOT, g)));
  const hits = scan(claims, files);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ claims: claims.length, files: files.length, hits }, null, 2));
  else {
    for (const h of hits) console.log(`${h.file}:${h.line}: a retired route (${h.id})\n    ${h.text.slice(0, 160)}\n    say instead: ${h.say}`);
    console.log(`check-retired: ${claims.length} retired claim(s), ${files.length} guide(s), ${hits.length} hit(s)`);
  }
  process.exit(hits.length ? 1 : 0);
}
