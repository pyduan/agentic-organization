#!/usr/bin/env node
// Memories make claims about the world. The world changes; they do not.
//
// A memory never says it has aged: it keeps asserting a dead URL, a repo that went
// private or a path that no longer exists with the same confidence. One memory was
// wrong about three facts at once (the repo's visibility, the architecture and the
// deployment URL) and nothing said so.
//
// This script does not reread the prose. It extracts what can be CHECKED and holds it
// against reality: repos, URLs, local paths. The rest is left to a person's judgement,
// and the script says so instead of pretending.
//
//   node scripts/check-memory.mjs                      the workspace folder it runs from
//   node scripts/check-memory.mjs --folder=~/Projects  another folder (repeatable)
//   node scripts/check-memory.mjs --all                every project on this machine
//   node scripts/check-memory.mjs --json
//
// Zero dependencies. `gh` is used when present; without it repos are skipped, and the
// report says they were not checked rather than calling them fine.

import { readdir, readFile } from 'node:fs/promises';
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const HOME = homedir();
const BASE = join(HOME, '.claude', 'projects');
const args = process.argv.slice(2);

// Claude Code keeps each project's memory under ~/.claude/projects/<key>, the key being
// the absolute path of the folder the session opened on, with every character other than
// a letter or a digit replaced by `-` and case kept: /Users/sam/Projects/site becomes
// -Users-sam-Projects-site, /home/sam/.config becomes -home-sam--config.
export const encode = (abs) => abs.replace(/[^A-Za-z0-9]/g, '-');

// By default the sweep covers only the workspace folder it runs from: the folder that
// holds this repo and its siblings, or that folder itself when run from it (it is not a
// repo). ~/.claude/projects holds the memories of every project on the machine, and a
// sweep started from one organization's folder has no business reading another's.
// `--all` widens on purpose; `--folder=<path>` names another folder, and can be given
// several times, for instance with a folder's old name after a rename, whose memories
// stay under the old key.
const CWD = resolve(process.cwd());
const ALL = args.includes('--all');
// The on-disk spelling, so `~/projects` finds the keys of `~/Projects` on a Mac.
const onDisk = (p) => { try { return realpathSync.native(p); } catch { return p; } };
const expand = (p) => onDisk(resolve(p.replace(/^~(?=$|\/)/, HOME)));
const named = args.filter((a) => a.startsWith('--folder=')).map((a) => expand(a.slice(9))).filter(Boolean);
const FOLDERS = ALL ? [] : (named.length ? named : [onDisk(existsSync(join(CWD, '.git')) ? dirname(CWD) : CWD)]);
const AS_JSON = args.includes('--json');

/**
 * Whether a memory key belongs to a folder: the folder itself or anything inside it.
 * The encoding cannot tell /Projects/site-old from /Projects/site/old, so a key that
 * matches a sibling folder existing on disk (site-old beside site) is the sibling's.
 */
export function keyFilter(folder) {
  const own = encode(folder);
  let siblings = [];
  try {
    siblings = readdirSync(dirname(folder))
      .filter((n) => n !== basename(folder))
      .map((n) => join(dirname(folder), n))
      .filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } })
      .map(encode)
      .filter((e) => e.startsWith(`${own}-`));
  } catch { /* the folder's parent is gone: no sibling to tell apart */ }
  const under = (key, enc) => key === enc || key.startsWith(`${enc}-`);
  return (key) => under(key, own) && !siblings.some((s) => under(key, s));
}

// What counts as a date: ISO, dd/mm/yyyy, or a month spelled out (French or English)
// with its year. Memories are written in prose, in whatever language the team speaks.
const MONTHS = 'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre'
  + '|january|february|march|april|may|june|july|august|september|october|november|december';
const DATE = new RegExp(
  String.raw`\b20\d{2}-\d{2}-\d{2}\b` + '|'
  + String.raw`\b\d{1,2}\/\d{1,2}\/20\d{2}\b` + '|'
  + String.raw`\b(?:${MONTHS})\s+20\d{2}\b` + '|'
  + String.raw`\b\d{1,2}(?:er|st|nd|rd|th)?\s+(?:${MONTHS})\s+20\d{2}\b`,
  'i',
);

// A path on this machine or another one: ~/…, /Users/<name>/… (macOS), /home/<name>/… (Linux).
const LOCAL_PATH = /(?:~|\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+)\/[A-Za-z0-9._\/-]+/g;
// Words with which a memory says itself that a path is gone.
const GONE = /quarantaine|quarantine|retir[ée]|removed|doublon|duplicate|archiv|n'existe plus|no longer exists|pas de clone|not cloned|renomm|renamed|déplac|moved|ancien(?:ne)? (?:nom|chemin)|old (?:name|path)/i;

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) await main();

async function main() {
  const findings = [];
  const add = (severity, where, what, detail) => findings.push({ severity, where, what, detail });

  const hasGh = await run('gh', ['--version']).then(() => true).catch(() => false);

  // --- the claims that can be checked ------------------------------------------

  const repoState = new Map();
  async function checkRepo(slug) {
    if (repoState.has(slug)) return repoState.get(slug);
    let state = { unknown: true };
    if (hasGh) {
      try {
        const { stdout } = await run('gh', ['repo', 'view', slug, '--json', 'isArchived,visibility']);
        const j = JSON.parse(stdout);
        state = { archived: j.isArchived, visibility: j.visibility.toLowerCase() };
      } catch { state = { missing: true }; }
    }
    repoState.set(slug, state);
    return state;
  }

  const urlState = new Map();
  async function checkUrl(url) {
    if (urlState.has(url)) return urlState.get(url);
    let s;
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 8000);
      const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: c.signal });
      clearTimeout(t);
      s = { status: r.status };
    } catch (e) { s = { error: e.name === 'AbortError' ? 'timeout' : String(e.message) }; }
    urlState.set(url, s);
    return s;
  }

  // --- the sweep ---------------------------------------------------------------

  let keys = [];
  try {
    keys = (await readdir(BASE, { withFileTypes: true }))
      // An encoded absolute path starts with a dash, /Users/ on a Mac as /home/ on Linux.
      .filter((e) => e.isDirectory() && e.name.startsWith('-'))
      .map((e) => e.name);
  } catch { console.error(`No ${BASE}: Claude Code has kept no memory on this machine.`); process.exit(1); }

  const total = keys.length;
  if (FOLDERS.length) {
    const filters = FOLDERS.map(keyFilter);
    keys = keys.filter((k) => filters.some((f) => f(k)));
  }
  const skipped = total - keys.length;

  // A folder that matches nothing must never come out as "✓ 0 memories". A scheduled
  // sweep once named a folder that did not exist under that name and reported a perfect
  // green for weeks without opening a single file. A check that checked nothing has to
  // say so louder than a check that found nothing.
  if (FOLDERS.length && keys.length === 0) {
    const shown = FOLDERS.join(', ');
    if (named.length) {
      console.error(`✗ No Claude Code project under ${shown}: nothing was swept.`);
      console.error(`  ${BASE} holds ${total} project(s); --all sweeps every one of them.`);
      process.exit(1);
    }
    console.log(`No Claude Code session has opened under ${shown} yet, so there is no memory to sweep (--all sweeps every project on this machine).`);
    return;
  }

  const homeKey = `${encode(HOME)}-`;
  let scanned = 0;
  for (const key of keys.sort()) {
    const dir = join(BASE, key, 'memory');
    let files = [];
    try { files = (await readdir(dir)).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md'); } catch { continue; }

    for (const file of files) {
      scanned++;
      const where = `${key.startsWith(homeKey) ? key.slice(homeKey.length) : key} ▸ ${file}`;
      const text = await readFile(join(dir, file), 'utf8');
      // A line is not a unit of meaning: markdown wraps, so a repo's name and the words
      // about it can sit on two lines. Context is the BLOCK, the bullet or the paragraph.
      const blocks = text.split(/\n(?=\s*[-*]\s|\n)/);

      // Repos: do not guess what the memory meant. Show the real state, and only raise
      // an explicit textual contradiction.
      for (const slug of new Set([...text.matchAll(/\b([A-Za-z0-9-]+\/[A-Za-z0-9._-]+)\b/g)]
          .map((m) => m[1]).filter((s) => !s.includes('.md') && !s.startsWith('/') && s.split('/').length === 2))) {
        const st = await checkRepo(slug);
        if (st.unknown || st.missing) continue;
        const own = blocks.filter((b) => b.includes(slug));
        const near = own.join(' ').toLowerCase();
        const whole = text.toLowerCase();

        // When the block names SEVERAL repos, a word like "public" can no longer be
        // pinned on one of them by vocabulary alone, so the check declines to guess: a
        // false alarm costs more than a miss, because it teaches the reader to skip it.
        const others = new Set(own.join(' ').match(/\b[A-Za-z0-9-]+\/[A-Za-z0-9._-]+\b/g) || []);
        others.delete(slug);
        const ambiguous = [...others].some((o) => !o.includes('.md') && o.split('/').length === 2);

        if (st.archived && !/archiv/i.test(whole)) {
          add('warn', where, slug, 'is ARCHIVED on GitHub and the memory never says so: a session may think it is alive');
        }
        if (!ambiguous && st.visibility === 'private' && /\bpublic\b/.test(near) && !/priv/i.test(near)) {
          add('warn', where, slug, 'is PRIVATE, and the line naming it says "public"');
        }
        if (!ambiguous && st.visibility === 'public' && /\bprivate\b|\bprivé\b/i.test(near) && !/public/i.test(near)) {
          add('warn', where, slug, 'is PUBLIC, and the line naming it says "private": check that nothing sensitive is described in it');
        }
      }

      for (const url of new Set([...text.matchAll(/https?:\/\/[^\s)`>"'\]]+/g)].map((m) => m[0]))) {
        // Markdown glues its punctuation to URLs: **bold**, (parentheses), sentence ends.
        const clean = url.replace(/[*_`)\]}>.,;:!?]+$/, '');
        const st = await checkUrl(clean);

        // A private repo answers 404 to an anonymous client on every PR and issue,
        // whether they exist or not. Calling the link dead is wrong twice: it works for
        // whoever has access, and a report that is always red stops being read.
        const ghRepo = clean.match(/^https:\/\/github\.com\/([A-Za-z0-9-]+\/[A-Za-z0-9._-]+)\//);
        if (ghRepo && (st.status === 404 || st.status === 410)) {
          const r = await checkRepo(ghRepo[1]);
          if (r.visibility === 'private') {
            add('info', where, clean, 'private repo: cannot be checked anonymously, the link may be perfectly valid');
            continue;
          }
        }

        // An API called with POST (`…/v2/entries:list`) answers 404 to a HEAD while
        // alive. The check never POSTs in its place, since a call can have effects: when
        // the block naming the URL says POST, it only notes it.
        const postBlock = blocks.some((b) => b.includes(clean) && /\bPOST\b/.test(b));
        if ((st.status === 404 || st.status === 405) && postBlock) {
          add('info', where, clean, 'endpoint called with POST: an anonymous HEAD proves nothing');
          continue;
        }

        if (st.status === 404 || st.status === 410) add('fail', where, clean, `answers ${st.status}: the memory points to a dead page`);
        else if (st.error) add('info', where, clean, `unreachable (${st.error}): may be normal behind restricted access`);
      }

      for (const p of new Set([...text.matchAll(LOCAL_PATH)].map((m) => m[0]))) {
        const abs = p.replace(/^~/, HOME).replace(/[.,;:`)]+$/, '');
        if (existsSync(abs)) continue;

        // A memory that DOCUMENTS a dead path is not flagged for containing it: that is
        // the drift already recorded, the opposite of drift.
        const ctx = blocks.filter((b) => b.includes(p)).join(' ');
        if (GONE.test(ctx)) {
          add('info', where, p, 'not on disk, and the memory says so: nothing to fix');
          continue;
        }
        add('warn', where, p, 'does not exist on this disk: a stale path, or another machine');
      }

      // A memory with no date is a memory nobody can suspect. Dates written out in
      // words count too: recognizing only ISO dates once flagged five memories out of
      // six that carried one, and a signal that wrong only teaches people to skip it.
      if (!DATE.test(text)) {
        add('info', where, '(no date)', 'nothing says when this was checked, so nothing will say it has aged');
      }
    }
  }

  // --- report ------------------------------------------------------------------

  const fails = findings.filter((f) => f.severity === 'fail');
  const warns = findings.filter((f) => f.severity === 'warn');

  if (AS_JSON) {
    console.log(JSON.stringify({ folders: FOLDERS, scanned, skipped, findings }, null, 2));
  } else {
    let last = '';
    for (const f of [...fails, ...warns, ...findings.filter((x) => x.severity === 'info')]) {
      if (f.where !== last) { console.log(`\n${f.where}`); last = f.where; }
      console.log(`  ${f.severity === 'fail' ? '✗' : f.severity === 'warn' ? '▲' : '·'} ${f.what}\n      ${f.detail}`);
    }
    console.log(`\n${fails.length ? '✗' : '✓'} ${scanned} memory file(s) swept: ${fails.length} dead, ${warns.length} to fix${skipped ? `; ${skipped} project(s) outside ${FOLDERS.join(', ')} not swept (--all, or --folder=<path>)` : ''}`);
    if (!hasGh) console.log('  (gh is not installed: repos were not checked, which is not the same as found fine)');
  }
  process.exitCode = fails.length ? 1 : 0;
}
