// The two guards in .claude/hooks, tested on fixture tool calls and transcripts.
//
// send-guard must stop a message leaving in someone's name until a person says
// so, on any MCP server and from the shell, and stay silent on everything else.
// turn-check must refuse an answer that claims an absence nobody searched for, a
// verification nobody ran, or a source it read only in part, and must block once,
// never in a loop.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../.claude/hooks/send-guard.mjs';
import { currentTurn, check } from '../.claude/hooks/turn-check.mjs';

const HOOKS = resolve(dirname(fileURLToPath(import.meta.url)), '../.claude/hooks');

// ------------------------------------------------------------------ send-guard

test('send-guard asks before any tool or command that sends a message', () => {
  const asks = [
    { tool_name: 'mcp__00bc223b__send_message', tool_input: {} },
    { tool_name: 'mcp__gmail__reply', tool_input: {} },
    { tool_name: 'mcp__gmail__forward', tool_input: {} },
    { tool_name: 'mcp__gmail__create_draft', tool_input: {} },
    { tool_name: 'mcp__slack__slack_post_message', tool_input: {} },
    { tool_name: 'Bash', tool_input: { command: `osascript -e 'tell application "Mail" to send theMessage'` } },
    { tool_name: 'Bash', tool_input: { command: 'osascript scripts/send-mail.applescript' } },
    { tool_name: 'Bash', tool_input: { command: 'node scripts/send-report.mjs --to=x@y' } },
    { tool_name: 'Bash', tool_input: { command: 'cd x && ./scripts/send-alert.sh' } },
    { tool_name: 'Bash', tool_input: { command: 'echo hi | mail -s "subject" someone@example.com' } },
    { tool_name: 'Bash', tool_input: { command: 'curl -X POST https://api.telegram.org/bot123/sendMessage -d text=hi' } },
  ];
  for (const e of asks) assert.ok(classify(e), `should ask: ${e.tool_name} ${e.tool_input.command || ''}`);
});

test('send-guard stays silent on reading, searching and ordinary commands', () => {
  const quiet = [
    { tool_name: 'mcp__gmail__search_threads', tool_input: {} },
    { tool_name: 'mcp__gmail__get_thread', tool_input: {} },
    { tool_name: 'mcp__gmail__list_drafts', tool_input: {} },
    { tool_name: 'Bash', tool_input: { command: 'git push origin main' } },
    { tool_name: 'Bash', tool_input: { command: 'grep -rn "send" docs/' } },
    { tool_name: 'Bash', tool_input: { command: 'npm test' } },
    { tool_name: 'Read', tool_input: { file_path: '/x/send-mail.applescript' } },
    { tool_name: 'Bash', tool_input: { command: 'cat scripts/send-report.mjs' } },
    { tool_name: 'Bash', tool_input: { command: 'node --check .claude/hooks/send-guard.mjs' } },
    { tool_name: 'Bash', tool_input: { command: 'grep -n byOwner scripts/send-report.mjs' } },
  ];
  for (const e of quiet) assert.equal(classify(e), null, `should stay silent: ${e.tool_name} ${e.tool_input.command || ''}`);
});

test('send-guard honours an allow pattern for a channel that reaches only the owner', () => {
  const e = { tool_name: 'Bash', tool_input: { command: 'bash scripts/send-owner-alert.sh' } };
  assert.ok(classify(e));
  assert.equal(classify(e, [/scripts\/send-owner-alert\.sh/]), null);
});

test('send-guard speaks the PreToolUse protocol', () => {
  const out = execFileSync('node', [join(HOOKS, 'send-guard.mjs')], {
    input: JSON.stringify({ tool_name: 'mcp__gmail__send_message', tool_input: {}, cwd: tmpdir() }), encoding: 'utf8',
  });
  const j = JSON.parse(out);
  assert.equal(j.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(j.hookSpecificOutput.permissionDecision, 'ask');
});

// ------------------------------------------------------------------ turn-check

/** A transcript: a prompt, then assistant tool calls with results, then a final answer. */
function transcript({ calls = [], answer }) {
  const L = [{ type: 'user', message: { role: 'user', content: 'earlier prompt' } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Il me manque les dates.' }] } },
    { type: 'user', message: { role: 'user', content: 'the prompt of this turn' } }];
  calls.forEach((c, i) => {
    L.push({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `t${i}`, name: c.name, input: c.input || {} }] } });
    L.push({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `t${i}`, content: c.output || 'ok', is_error: Boolean(c.error) }] } });
  });
  L.push({ type: 'assistant', message: { content: [{ type: 'text', text: answer }] } });
  return L.map((l) => JSON.stringify(l)).join('\n');
}
const ids = (t) => check(currentTurn(t)).map((f) => f.id);

test('an absence nobody searched for is refused, in French and in English', () => {
  assert.deepEqual(ids(transcript({ answer: "Aucune pièce du dossier ne fixe ce montant." })), ['absence']);
  assert.deepEqual(ids(transcript({ answer: "Je ne l'ai pas trouvé : il me manque l'avenant." })), ['absence']);
  assert.deepEqual(ids(transcript({ answer: 'There is no record of that payment in your files.' })), ['absence']);
  assert.deepEqual(ids(transcript({ answer: 'Aucune pièce ne le dit.', calls: [{ name: 'Grep' }] })), []);
  assert.deepEqual(ids(transcript({ answer: 'Aucune pièce ne le dit.', calls: [{ name: 'Bash', input: { command: 'rg -n avenant ~/dossier' } }] })), []);
});

test('a silence nobody checked is refused', () => {
  assert.deepEqual(ids(transcript({ answer: "L'associé n'a jamais répondu à cet engagement." })), ['silence']);
  assert.deepEqual(ids(transcript({ answer: "L'associé n'a jamais répondu.", calls: [{ name: 'mcp__mail__search_threads' }] })), []);
});

test('a verification nobody ran is refused; one that ran, or a disclaimer, is not', () => {
  assert.deepEqual(ids(transcript({ answer: "C'est vérifié, tout est en ordre." })), ['verified']);
  assert.deepEqual(ids(transcript({ answer: "C'est vérifié.", calls: [{ name: 'Bash', input: { command: 'npm test' } }] })), []);
  assert.deepEqual(ids(transcript({ answer: 'Ce point reste non vérifié.' })), []);
});

test('a success announced over a failing last command is refused', () => {
  assert.deepEqual(ids(transcript({ answer: 'Le courriel est envoyé.', calls: [{ name: 'Bash', input: { command: 'node x.mjs' }, error: true }] })), ['failed']);
  assert.deepEqual(ids(transcript({ answer: 'Le courriel est envoyé.', calls: [{ name: 'Bash', input: { command: 'node x.mjs' } }] })), []);
});

test('a source cited after a partial read is refused, unless it was read whole or written this turn', () => {
  const partial = { name: 'Read', input: { file_path: '/d/promesse.md', offset: 1, limit: 40 } };
  assert.deepEqual(ids(transcript({ answer: 'Selon promesse.md, la date est un plafond.', calls: [partial] })), ['partial']);
  assert.deepEqual(ids(transcript({ answer: 'Selon promesse.md, la date est un plafond.', calls: [partial, { name: 'Read', input: { file_path: '/d/promesse.md' } }] })), []);
  assert.deepEqual(ids(transcript({ answer: "J'ai mis la date dans promesse.md.", calls: [partial] })), [], 'naming is not citing');
  assert.deepEqual(ids(transcript({ answer: 'Selon promesse.md, la date est un plafond.', calls: [partial, { name: 'Edit', input: { file_path: '/d/promesse.md' } }] })), []);
  assert.deepEqual(ids(transcript({ answer: "D'après notes.txt, rien n'a bougé.", calls: [{ name: 'Bash', input: { command: 'head -20 notes.txt' } }] })), ['partial']);
});

test('only the current turn and its final answer are judged', () => {
  // The earlier turn's "Il me manque les dates" must not count against this one.
  assert.deepEqual(ids(transcript({ answer: 'Voici le compte rendu de la réunion.' })), []);
  // Text before the last call is narration, not the answer.
  const t = transcript({ calls: [{ name: 'Read', input: { file_path: '/d/a.md' } }], answer: 'Fait.' })
    .replace('"name":"Read"', '"name":"Read"');
  assert.deepEqual(ids(t), []);
});

test('the hook blocks once and never loops', () => {
  const dir = mkdtempSync(join(tmpdir(), 'turn-'));
  const path = join(dir, 't.jsonl');
  writeFileSync(path, transcript({ answer: "Aucune pièce du dossier ne le dit." }));
  const run = (active) => execFileSync('node', [join(HOOKS, 'turn-check.mjs')], {
    input: JSON.stringify({ transcript_path: path, stop_hook_active: active, cwd: dir }), encoding: 'utf8',
  });
  const first = JSON.parse(run(false));
  assert.equal(first.decision, 'block');
  assert.match(first.reason, /Aucune pièce du dossier ne le dit/);
  assert.equal(run(true), '', 'the second stop goes through');
});

test('a project can disable a check or add its own', () => {
  const dir = mkdtempSync(join(tmpdir(), 'turn-'));
  const path = join(dir, 't.jsonl');
  writeFileSync(path, transcript({ answer: "L'apport déclenche l'impôt sur le gain. Aucune pièce ne le dit." }));
  execFileSync('mkdir', ['-p', join(dir, '.claude')]);
  writeFileSync(join(dir, '.claude/turn-checks.json'), JSON.stringify({
    disable: ['absence'],
    checks: [{ id: 'law', patterns: ["\\bdéclenche l'impôt\\b"], requires: 'cite', cite: '\\b(article|BOFiP|selon|à vérifier)\\b', say: 'cite the text.' }],
  }));
  const out = JSON.parse(execFileSync('node', [join(HOOKS, 'turn-check.mjs')], {
    input: JSON.stringify({ transcript_path: path, stop_hook_active: false, cwd: dir }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8',
  }));
  assert.match(out.reason, /cite the text/);
  assert.doesNotMatch(out.reason, /missing or does not exist/);
});
