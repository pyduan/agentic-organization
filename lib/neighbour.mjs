// What another repo lets this one read of it.
//
// The tools that reach beside their own repo (the dashboard, the fleet and workspace
// checks, the workspace sync) used to read whatever they found there. A repo that did
// not want its wording to travel could only ask, with a `dashboard: counts-only` line
// that one tool honoured and the others never looked at: a limit respected by habit,
// which is to say by every caller remembering it. Proposed by an owner running the kit
// across several repos, taken whole: the repo declares, and the ceiling is held here,
// in the one place every read of a neighbour goes through.
//
// A repo declares it in `.read-consent`, at its root, in one word (a `#` starts a
// comment):
//
//   full    neighbours may read its files and its history. The default, with no file.
//   counts  neighbours learn shapes only: whether a file exists, numbers, yes or no,
//           dates and commit ids. Never a word of its text, a name or an address.
//   none    neighbours do not open it.
//
// A file that says anything else counts as `none` and is reported: an unknown value
// never passes on a guess, and the guess that fails open is the one that leaks.
//
// What it does not cover, said here so nobody reads more into it. It holds against a
// script that forgets, not one that tries: a `measure` callback could still copy the
// text into a variable of its own, and a review is what catches that. It binds scripts:
// an agent session that opens the files by hand is held by the repo's CLAUDE.md, not
// by this. And a clone's refs and counts (its origin, its branches, how far it is
// behind) are what keeping a clone current is made of, so the sync still reads them
// at `counts`; at `none` it leaves the repo alone.
//
// The format, for owners: source/formats/read-consent.md.
//
// Zero dependencies, Node built-ins and git.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join } from 'node:path';

export const CONSENT_FILE = '.read-consent';
export const LEVELS = ['full', 'counts', 'none'];

export class ReadRefused extends Error {
  constructor(dir, level, what) {
    super(`${dir} declares \`${level}\` in ${CONSENT_FILE}: ${what} refused`);
    this.name = 'ReadRefused';
    this.level = level;
  }
}

/** The declared level. `{ level, declared, problem }`; a problem means the file was unusable. */
export function readConsent(dir) {
  let raw;
  try { raw = readFileSync(join(dir, CONSENT_FILE), 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') return { level: 'full', declared: false, problem: null };
    return { level: 'none', declared: true, problem: `${CONSENT_FILE} could not be read (${e.code || e.message})` };
  }
  const words = raw.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
  if (words.length === 1 && LEVELS.includes(words[0].toLowerCase())) {
    return { level: words[0].toLowerCase(), declared: true, problem: null };
  }
  return {
    level: 'none', declared: true,
    problem: `${CONSENT_FILE} says ${JSON.stringify(words.join(' ') || '')}, not one of ${LEVELS.join(', ')}: read as none`,
  };
}

// A string a shape may carry: a date, a timestamp or a commit id. Each says when or
// which, and none can hold a word.
const DATE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const SHA = /^[0-9a-f]{7,40}$/;

/** Whether a value carries only shape: numbers, booleans, null, dates, commit ids, and arrays or objects of those. */
export function isShape(v) {
  if (v === null || v === undefined || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return DATE.test(v) || SHA.test(v);
  if (Array.isArray(v)) return v.every(isShape);
  if (typeof v === 'object') return Object.values(v).every(isShape);
  return false;
}

const readText = (path) => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };

function gitLog(dir, args, timeout) {
  return new Promise((ok, fail) => {
    execFile('git', ['-C', dir, 'log', ...args], {
      encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (error, stdout, stderr) => (error ? fail(Object.assign(error, { stderr })) : ok(stdout.trim())));
  });
}

/**
 * A neighbour, opened at the level it declares (`self` for the repo a script runs in). Every method refuses what the level
 * does not allow by throwing ReadRefused, so a caller that forgets to ask cannot
 * read past it.
 *
 *   exists(rel)                      full, counts
 *   text(rel)                        full: the file, or '' when it is missing
 *   folders(rel)                     full: the names of the folders under rel
 *   measure(rel, fn)                 full, counts: fn(text), which at counts must be a shape
 *   measureEach(rel, file, fn)       full, counts: fn(text of <rel>/<sub>/<file>) for every
 *                                    folder under rel, in no particular order, without its name
 *   history(args, fn, { timeout })   full, counts: fn(output of `git log <args>`), a shape at counts
 */
export function neighbour(dir, { self = false } = {}) {
  // A repo reading itself reads everything: its consent is about what leaves it.
  const { level, declared, problem } = self ? { level: 'full', declared: false, problem: null } : readConsent(dir);
  const refuse = (what) => { throw new ReadRefused(dir, level, what); };
  const open = (what) => { if (level === 'none') refuse(what); };
  const shaped = (what, value) => {
    if (level === 'counts' && !isShape(value)) refuse(`${what} returning words`);
    return value;
  };
  return {
    dir, level, declared, problem,
    exists(rel) {
      open(`exists(${rel})`);
      try { statSync(join(dir, rel)); return true; } catch { return false; }
    },
    text(rel) {
      if (level !== 'full') refuse(`text(${rel})`);
      return readText(join(dir, rel));
    },
    folders(rel) {
      if (level !== 'full') refuse(`folders(${rel})`);
      try { return readdirSync(join(dir, rel), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); }
      catch { return []; }
    },
    measure(rel, fn) {
      open(`measure(${rel})`);
      return shaped(`measure(${rel})`, fn(readText(join(dir, rel))));
    },
    measureEach(rel, file, fn) {
      open(`measureEach(${rel})`);
      let subs = [];
      try { subs = readdirSync(join(dir, rel), { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { return []; }
      return subs.map((s) => shaped(`measureEach(${rel})`, fn(readText(join(dir, rel, s.name, file)))));
    },
    async history(args, fn, { timeout = 10_000 } = {}) {
      open('history');
      return shaped('history', fn(await gitLog(dir, args, timeout)));
    },
  };
}
