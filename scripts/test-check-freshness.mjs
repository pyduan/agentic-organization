// The freshness sweep (scripts/check-freshness.mjs), run offline on a throwaway repo. Every example is invented.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = resolve(import.meta.dirname, 'check-freshness.mjs');
const top = mkdtempSync(join(tmpdir(), 'freshness-'));
after(() => rmSync(top, { recursive: true, force: true }));
const file = (rel, text) => { const p = join(top, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };

const sweep = () => {
  let out;
  try { out = execFileSync('node', [SCRIPT, '--only=stale', '--offline', '--json'], { cwd: top, encoding: 'utf8' }); }
  catch (e) { out = e.stdout; } // exit 1 on a failure still prints the JSON
  return JSON.parse(out).findings.filter((f) => f.pass === 'stale' && f.severity === 'warn').map((f) => f.what);
};

test('agent worktrees under .claude/ are not swept, the rest of .claude/ and a content folder named worktrees are', () => {
  file('.claude/skills/brochure/SKILL.md', 'Send it to {{PRINTER}}.\n');
  file('.claude/worktrees/agent-1/docs/brochure.md', 'Send it to {{PRINTER}}.\n');
  file('notes/worktrees/brochure.md', 'Send it to {{PRINTER}}.\n');
  assert.deepEqual(sweep().sort(), ['.claude/skills/brochure/SKILL.md', 'notes/worktrees/brochure.md']);
});
