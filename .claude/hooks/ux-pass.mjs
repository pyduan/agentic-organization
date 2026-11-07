#!/usr/bin/env node
// The Laws of UX pass, asked for once per new screen piece, and never in CI.
//
// A pass over Jon Yablonski's Laws of UX catches what a build cannot (two buttons with the same
// name, a save bar under a floating button, a choice of twelve where three would do), but run on
// every change it becomes noise, and run in CI it cannot see a screen at all. So it is asked for
// at the one moment it pays: when a session creates a component, a template, a layout or a page
// that did not exist in the last commit. Editing an existing one asks nothing.
//
// As a PostToolUse hook on Write: if the file is a new UI file and carries no `ux-pass:` stamp,
// the agent is told, once per file per session, to run the pass on the running screen and to
// stamp the file (`ux-pass: <date>`, with the laws that raised something). A stamped file is done;
// removing the stamp asks again on the next rewrite, for a redesign. `"uxPass": false` in
// .claude/turn-checks.json turns it off. Rules: source/formats/webapp.md ▸ The Laws of UX pass.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_EXT = /\.(astro|jsx|tsx|vue|svelte)$/i;
const UI_DIR = /(^|\/)(components|templates|layouts|pages|views|screens)\//i;
const SKIP = /(^|\/)(node_modules|dist|build|\.astro|vendor|decks)\/|\.(test|spec|stories)\.[a-z]+$/i;
const STAMP = /ux-pass\s*:/i;

/** Whether a repo-relative path is a piece of screen worth the pass. */
export function isUiFile(rel) {
  const p = String(rel).replace(/\\/g, '/');
  if (!p || SKIP.test(p)) return false;
  return UI_EXT.test(p) || (UI_DIR.test(p) && /\.(html|mjs|js|css)$/i.test(p));
}

/** The reminder for one file, or null when nothing is asked. */
export function reminder({ rel, content, inHead, alreadyAsked, disabled }) {
  if (disabled || alreadyAsked || inHead || !isUiFile(rel) || STAMP.test(String(content || ''))) return null;
  return [
    `New screen piece: ${rel}. Before handing it over, run the Laws of UX pass once, on the running screen`,
    '(a screenshot at ~390px and at desktop, not the code): source/formats/webapp.md ▸ The Laws of UX pass.',
    'One question per law; fix each "no" or name it in the delivery. Then stamp the file with a comment',
    `\`ux-pass: ${new Date().toISOString().slice(0, 10)}\` and the laws that raised something, so the pass is not asked again.`,
  ].join(' ');
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}

function main() {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { return; }
  if (input?.tool_name !== 'Write') return;
  const file = input.tool_input?.file_path;
  if (!file) return;
  let root;
  // The nearest folder that exists: a hook test, or a write that failed, leaves no file behind.
  let from = dirname(resolve(file));
  while (!existsSync(from) && dirname(from) !== from) from = dirname(from);
  try { root = git(from, ['rev-parse', '--show-toplevel']); } catch { return; }
  const rel = relative(root, resolve(file)).replace(/\\/g, '/');
  if (!isUiFile(rel)) return;

  let disabled = false;
  try { disabled = JSON.parse(readFileSync(join(root, '.claude/turn-checks.json'), 'utf8')).uxPass === false; } catch { /* no config */ }
  let inHead = true;
  try { git(root, ['cat-file', '-e', `HEAD:${rel}`]); } catch { inHead = false; }

  // Once per file per session, in the repo's git folder: rewriting a new file ten times asks once.
  let seenFile = null, seen = [];
  try {
    const gitDir = resolve(root, git(root, ['rev-parse', '--git-dir']));
    seenFile = join(gitDir, 'ux-pass', `${String(input.session_id || 'session').replace(/[^\w.-]/g, '_')}.json`);
    if (existsSync(seenFile)) seen = JSON.parse(readFileSync(seenFile, 'utf8'));
  } catch { /* asked again, which is harmless */ }

  const content = input.tool_input?.content ?? (existsSync(file) ? readFileSync(file, 'utf8') : '');
  const text = reminder({ rel, content, inHead, alreadyAsked: seen.includes(rel), disabled });
  if (!text) return;
  if (seenFile) {
    try { mkdirSync(dirname(seenFile), { recursive: true }); writeFileSync(seenFile, JSON.stringify([...seen, rel])); } catch { /* best effort */ }
  }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
