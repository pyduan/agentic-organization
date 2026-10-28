// The AI-tells checker (scripts/check-ai-tics.mjs): its own self-test, a draft on stdin, and the
// owner's words read from the voice guide. Every example here is invented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-ai-tics.mjs');
const run = (args, input) => spawnSync(process.execPath, [SCRIPT, ...args], { input, encoding: 'utf8' });

test('every rule fires on its case and stays quiet on the clean one', () => {
  const r = run(['--self-test']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('a draft on stdin: the antithesis is a tell, and --strict fails on it', () => {
  const draft = "It's not just a tool, it's a partner for the whole team.";
  assert.match(run(['--stdin'], draft).stdout, /escalated-antithesis/);
  assert.equal(run(['--stdin', '--strict'], draft).status, 1);
  assert.equal(run(['--stdin', '--strict'], 'The tool keeps every answer with its source.').status, 0);
});

test('a word the voice guide lists is checked without being written into the script', () => {
  assert.match(run(['--stdin'], 'Our journey with the school went well.').stdout, /voice-word/);
});
