// The send guard's own-address rules and its limits when nobody attends the session
// (.claude/hooks/send-guard.mjs, source/organization-policy.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { classify, toOwnAddresses, restrictedPush } from '../.claude/hooks/send-guard.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', '.claude', 'hooks', 'send-guard.mjs');
const send = (to, extra = {}) => ({ tool_name: 'mcp__mail__send_message', tool_input: { to, ...extra } });

test('a new message to oneself passes, anything else to anyone else asks', () => {
  const own = { self: ['sam@example.org'] };
  assert.equal(classify(send(['sam@example.org']), [], own), null);
  assert.ok(classify(send(['sam@example.org'], { cc: ['lee@other.net'] }), [], own));
  assert.ok(classify(send(['sam@example.org'], { draftId: 'd1' }), [], own), 'a draft is not a new message');
  assert.ok(classify({ tool_name: 'mcp__mail__reply', tool_input: { to: ['sam@example.org'] } }, [], own));
  assert.ok(classify(send([]), [], own), 'no recipient, no exemption');
});

test('an internal domain passes only when the policy declares it', () => {
  assert.ok(classify(send(['lee@example.org']), [], {}));
  assert.equal(toOwnAddresses('send_message', { to: ['Lee <lee@example.org>'] }, [], ['example.org']), true);
  assert.equal(toOwnAddresses('send_message', { to: ['lee@example.org.evil.net'] }, [], ['example.org']), false);
});

test('a push is matched to a restricted repo by cwd, -C or cd', () => {
  const r = ['acme-finance'];
  assert.equal(restrictedPush('git push origin main', '/w/acme-finance', r), 'acme-finance');
  assert.equal(restrictedPush('git -C ../acme-finance push', '/w/site', r), 'acme-finance');
  assert.equal(restrictedPush('cd ~/w/acme-finance && git push', '/w/site', r), 'acme-finance');
  assert.equal(restrictedPush('git push', '/w/acme-finance-public', r), '');
  assert.equal(restrictedPush('git status', '/w/acme-finance', r), '');
});

const run = (event, env, dir) => {
  const out = execFileSync('node', [HOOK, dir], { input: JSON.stringify(event), env: { ...process.env, ...env }, encoding: 'utf8' });
  return out ? JSON.parse(out).hookSpecificOutput.permissionDecision : 'none';
};

test('with nobody attending: own address passes, internal and others are refused, restricted push refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sg-'));
  mkdirSync(join(dir, '.claude')); mkdirSync(join(dir, 'source'));
  writeFileSync(join(dir, '.claude', 'send-guard.local.json'), JSON.stringify({ self: ['sam@example.org'] }));
  writeFileSync(join(dir, 'source', 'organization-policy.json'), JSON.stringify({ internalDomains: ['example.org'], restrictedRepos: ['acme-finance'] }));
  const alone = { CLAUDE_CODE_SESSION_ATTENDED: '0' };
  assert.equal(run(send(['sam@example.org']), alone, dir), 'none');
  assert.equal(run(send(['lee@example.org']), alone, dir), 'deny');
  assert.equal(run(send(['lee@example.org']), {}, dir), 'none', 'attended, an internal message leaves after the reread');
  assert.equal(run(send(['x@other.net']), {}, dir), 'ask');
  const push = { tool_name: 'Bash', tool_input: { command: 'git push' }, cwd: '/w/acme-finance' };
  assert.equal(run(push, alone, dir), 'deny');
  assert.equal(run(push, {}, dir), 'none', 'attended, the push is the person\'s');
  rmSync(dir, { recursive: true });
});
