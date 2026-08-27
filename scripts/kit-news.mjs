#!/usr/bin/env node
// Is there kit news for this project? Said briefly, at session start.
//
// The update-kit skill answers "bring me the newest kit" when the owner asks.
// This script exists for the owners who never ask — which is most of them,
// because they cannot know an update exists. It runs from the SessionStart
// hook, checks the template quietly, and when there is something new it prints
// a short notice the agent reads to the owner. The owner decides; nothing is
// ever applied from here.
//
// It must therefore be a good citizen of session start:
//   - fast: one fetch with a timeout, then local git only
//   - silent when there is nothing to say, silent when offline, silent in the
//     template repo itself
//   - quiet between repeats: the same news is re-announced at most once a week,
//     a NEW template commit is announced immediately
//   - exit 0 always — a broken news check must never break a session
//
// State lives in .git/ (machine-local, never committed): the last announced
// template sha and when.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE = process.env.KIT_REMOTE || 'template';
const BRANCH = process.env.KIT_BRANCH || 'main';
const REF = `${REMOTE}/${BRANCH}`;
const TEMPLATE_URL = 'https://github.com/pyduan/agentic-organization.git';
const REPEAT_MS = 7 * 24 * 60 * 60 * 1000;

const git = (args, opts = {}) => {
  try {
    return execFileSync('git', args, {
      cwd: ROOT, encoding: 'utf8', timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'], ...opts,
    });
  } catch { return null; }
};

// The template repo itself has no template to follow: stay silent there.
const origin = git(['remote', 'get-url', 'origin']) || '';
if (origin.includes('pyduan/agentic-organization')) process.exit(0);

// An instance created before this mechanism has no `template` remote yet.
// Adding it is the one write this script allows itself: additive git config,
// the kit's canonical URL, exactly what update-kit's first step would do.
if (git(['remote', 'get-url', REMOTE]) === null) {
  if (git(['remote', 'add', REMOTE, TEMPLATE_URL]) === null) process.exit(0);
}

// Refresh if the network allows; fall back to whatever was fetched last time.
git(['fetch', '--quiet', REMOTE]);
const target = (git(['rev-parse', REF]) || '').trim();
if (!target) process.exit(0);

// Damping: same news at most once a week, new news right away.
const gitDir = (git(['rev-parse', '--git-dir']) || '').trim();
const seenFile = gitDir ? join(isAbsolute(gitDir) ? gitDir : join(ROOT, gitDir), 'kit-news-seen') : null;
let seen = null;
try { seen = JSON.parse(readFileSync(seenFile, 'utf8')); } catch {}
if (seen && seen.sha === target && Date.now() - seen.at < REPEAT_MS) process.exit(0);

// The baseline this project last took, as .kit-sync records it (sha or JSON).
let base = null;
try {
  const raw = readFileSync(join(ROOT, '.kit-sync'), 'utf8').trim();
  base = raw.startsWith('{') ? (JSON.parse(raw).sha || null) : ((raw.match(/\b[0-9a-f]{7,40}\b/) || [])[0] || null);
} catch {}
if (base && git(['cat-file', '-e', `${base}^{commit}`]) === null) base = null;
if (base === target) process.exit(0);

const mark = () => { try { writeFileSync(seenFile, JSON.stringify({ sha: target, at: Date.now() })); } catch {} };

if (!base) {
  mark();
  console.log('This project has never pulled a kit update, and the template has moved since it was created.');
  console.log('Offer the owner, in plain language, to run the update-kit skill and see what it brings. Never apply it silently.');
  process.exit(0);
}

// Only the entry titles: session start is not the place for the full changelog.
const diff = git(['diff', '--no-color', `${base}:CHANGELOG.md`, `${REF}:CHANGELOG.md`]) || '';
const titles = diff.split('\n')
  .filter((l) => l.startsWith('+## '))
  .map((l) => `  ${l.slice(1)}`);

if (!titles.length) process.exit(0);
mark();
console.log(`The kit this project is built on has ${titles.length} update(s) it has not taken:`);
console.log(titles.join('\n'));
console.log('Tell the owner what these bring, in their language and in plain words, and offer to run');
console.log('the update-kit skill. The owner decides; never apply an update silently. Entries marked');
console.log('MAJOR change behaviour or need an action, so lead with those.');
