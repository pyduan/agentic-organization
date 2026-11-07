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
import { classify, forbiddenTrailers } from '../.claude/hooks/send-guard.mjs';
import { currentTurn, check, checkLanguage, foreignSentences } from '../.claude/hooks/turn-check.mjs';

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

// ------------------------------------------------------------------ commit trailers

const CO = 'Co-Authored-By';
test('a forbidden trailer is found wherever the commit message is written', () => {
  const hits = [
    `git commit -m "Fix the totals" -m "Co-Authored-By: A Tool <tool@example.com>"`,
    `git commit -m "Fix the totals\n\nCo-authored-by: A Tool <tool@example.com>"`,
    `git commit -m "$(cat <<'EOF'\nFix the totals\n\nCo-Authored-By: A Tool <tool@example.com>\nEOF\n)"`,
    `git -C ~/site commit --trailer "Co-authored-by: A Tool <tool@example.com>" -m "Fix"`,
    `cd ~/site && git add a.md && git commit -m $'Fix\\n\\nCo-Authored-By: A Tool'`,
  ];
  for (const cmd of hits) assert.deepEqual(forbiddenTrailers(cmd, [CO]), [CO], cmd);

  const dir = mkdtempSync(join(tmpdir(), 'commit-'));
  writeFileSync(join(dir, 'msg.txt'), 'Fix the totals\n\nCo-Authored-By: A Tool <tool@example.com>\n');
  assert.deepEqual(forbiddenTrailers('git commit -F msg.txt', [CO], dir), [CO]);
  assert.deepEqual(forbiddenTrailers(`git commit --file=${join(dir, 'msg.txt')}`, [CO]), [CO]);
});

test('a commit without the trailer, or a command that is not a commit, goes through', () => {
  const quiet = [
    'git commit -m "Fix the totals"',
    'git log --grep "Co-Authored-By:"',
    'grep -rn "Co-Authored-By:" .git/COMMIT_EDITMSG',
    'git commit -m "Credit the printer in the footer"',
    'echo "Co-Authored-By: x" > note.txt',
  ];
  for (const cmd of quiet) assert.deepEqual(forbiddenTrailers(cmd, [CO]), [], cmd);
  assert.deepEqual(forbiddenTrailers('git commit -m "x" -m "Co-Authored-By: y"', []), [], 'off unless configured');
  assert.deepEqual(forbiddenTrailers('git commit -m "x" -m "Signed-off-by: y"', [CO, 'Signed-off-by']), ['Signed-off-by']);
});

test('the commit guard asks, only in a project that opted in', () => {
  const dir = mkdtempSync(join(tmpdir(), 'commit-'));
  const event = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m "x" -m "Co-Authored-By: y"' }, cwd: dir });
  const run = () => execFileSync('node', [join(HOOKS, 'send-guard.mjs')], { input: event, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  assert.equal(run(), '', 'no config, no question');
  execFileSync('mkdir', ['-p', join(dir, '.claude')]);
  writeFileSync(join(dir, '.claude/turn-checks.json'), JSON.stringify({ commitTrailers: 'forbid' }));
  const j = JSON.parse(run());
  assert.equal(j.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(j.hookSpecificOutput.permissionDecisionReason, /Co-Authored-By/);
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

test('a concordance nobody computed is refused, in French and in English', () => {
  assert.deepEqual(ids(transcript({ answer: 'Les deux relevés se recoupent, aux arrondis près.' })), ['concordance']);
  assert.deepEqual(ids(transcript({ answer: 'The invoice and the statement reconcile exactly.' })), ['concordance']);
  assert.deepEqual(ids(transcript({ answer: 'Les deux relevés concordent.', calls: [{ name: 'Bash', input: { command: 'node -e "console.log(1200-400)"' } }] })), []);
  assert.deepEqual(ids(transcript({ answer: 'Voici les deux relevés, je ne les ai pas encore comparés.' })), []);
});

// ------------------------------------------------------------------ language

/** A turn with narration between calls, as Claude Code writes it. */
function narrated(texts, answer) {
  const L = [{ type: 'user', message: { role: 'user', content: 'la question' } }];
  texts.forEach((t, i) => {
    L.push({ type: 'assistant', message: { content: [{ type: 'text', text: t }, { type: 'tool_use', id: `n${i}`, name: 'Read', input: { file_path: '/d/x.md' } }] } });
    L.push({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `n${i}`, content: 'ok' }] } });
  });
  L.push({ type: 'assistant', message: { content: [{ type: 'text', text: answer }] } });
  return currentTurn(L.map((l) => JSON.stringify(l)).join('\n'));
}

// Realistic French answers, invented, dense in English technical words: none may be flagged.
const FRENCH = [
  "J'ai relancé le build, le commit est passé et le push sur main aussi.",
  'Le hook PreToolUse bloque le merge tant que le check de la CI est rouge.',
  'Le worktree est propre : `git status --porcelain` ne renvoie rien, et le diff est vide.',
  "Le deploy du Worker a échoué sur un timeout ; je le relance avec `wrangler deploy --config apps/todos/wrangler.jsonc`.",
  'La pull request est ouverte, le reviewer est assigné, il reste le changelog à écrire.',
  "Le fichier source/brand/voice.md dit déjà « read the diff before you commit », donc je n'ajoute rien.",
  'Les tests passent : 214 sur 214, et `npm run check` sort avec le code 0.',
  "Pour le dashboard, j'ai mis les stat tiles en haut et le footer avec les liens vers les documents.",
  "Le message d'erreur était \"permission denied (publickey)\", donc la clé SSH n'était pas chargée.",
  "Voici le résultat :\n```\nAll checks passed. Nothing to commit, working tree clean.\n```\nTout est en ordre.",
  "Le script lit le CSV export, fait le matching par email et écrit un JSON par contact.",
  "Le README dit:\n> Run the setup script before you open the app.\nC'est ce que j'ai fait.",
  '| Check | Result |\n|---|---|\n| tests | all green |\nLe tableau ci-dessus résume les contrôles.',
  'OK, je regarde.',
  'Commit 4f2a9c1, poussé.',
];
const ENGLISH = [
  'Now let me check the file.',
  'Let me read it.',
  'The tests pass, so I will push the branch now.',
  'Good, that worked. Next I need to update the changelog.',
  "I'll look at the hook first and then fix the test.",
  'This is the last step before the deploy.',
];

test('the language check flags English sentences in a French turn, narration included, and nothing else', () => {
  for (const t of FRENCH) assert.deepEqual(foreignSentences([t], 'fr'), [], t);
  for (const t of ENGLISH) assert.equal(foreignSentences([t], 'fr').length, 1, t);
  const turn = narrated(['Je lis le fichier.', 'Now let me check the hook.'], 'Le hook est corrigé et les tests passent.');
  const f = checkLanguage(turn, 'fr');
  assert.equal(f.length, 1);
  assert.match(f[0].quote, /Now let me check the hook/);
  assert.deepEqual(checkLanguage(narrated(['Je lis le fichier.'], 'Le hook est corrigé.'), 'fr'), []);
});

test('the language check works the other way round, and ignores a language it does not know', () => {
  assert.equal(foreignSentences(["Je regarde le fichier et je reviens vers vous."], 'en').length, 1);
  assert.deepEqual(foreignSentences(['The owner signed the « bon pour accord » page and the deck went out.'], 'en'), []);
  assert.deepEqual(foreignSentences(['Now let me check the file.'], 'xx'), []);
});

test('the language check is opt-in, through turn-checks.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'turn-'));
  const path = join(dir, 't.jsonl');
  writeFileSync(path, transcript({ answer: 'Now let me summarise the change. Le hook est en place.', calls: [{ name: 'Grep' }] }));
  const run = () => execFileSync('node', [join(HOOKS, 'turn-check.mjs')], {
    input: JSON.stringify({ transcript_path: path, stop_hook_active: false, cwd: dir }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8',
  });
  assert.equal(run(), '', 'off by default');
  execFileSync('mkdir', ['-p', join(dir, '.claude')]);
  writeFileSync(join(dir, '.claude/turn-checks.json'), JSON.stringify({ language: 'fr' }));
  assert.match(JSON.parse(run()).reason, /Now let me summarise the change/);
});

// ------------------------------------------------------------------ ux-pass

test('ux-pass asks once for a new screen piece, and never for an edit, a stamp or a non-UI file', async () => {
  const { isUiFile, reminder } = await import('../.claude/hooks/ux-pass.mjs');
  for (const p of ['site/src/components/Card.astro', 'apps/x/web/src/Panel.jsx', 'src/templates/invoice.html', 'app/views/List.vue'])
    assert.ok(isUiFile(p), p);
  for (const p of ['scripts/build.mjs', 'site/dist/components/a.js', 'src/Card.test.jsx', 'decks/pitch/index.html', 'README.md', 'node_modules/x/Button.tsx'])
    assert.ok(!isUiFile(p), p);
  const base = { rel: 'site/src/components/Card.astro', content: '<div/>', inHead: false, alreadyAsked: false, disabled: false };
  assert.match(reminder(base), /Laws of UX pass/);
  assert.equal(reminder({ ...base, inHead: true }), null, 'an existing file is an edit');
  assert.equal(reminder({ ...base, content: '<!-- ux-pass: 2026-11-07 (Fitts) -->' }), null, 'already stamped');
  assert.equal(reminder({ ...base, alreadyAsked: true }), null, 'once per session');
  assert.equal(reminder({ ...base, disabled: true }), null);
});

test('ux-pass, run as a hook on a new file in a fresh repo, prints the reminder once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uxpass-'));
  execFileSync('git', ['init', '-q', dir]);
  execFileSync('git', ['-C', dir, '-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-q', '--allow-empty', '-m', 'init']);
  const file = join(dir, 'src/components/Card.jsx');
  const run = () => execFileSync('node', [join(HOOKS, 'ux-pass.mjs')], {
    input: JSON.stringify({ session_id: 's1', tool_name: 'Write', tool_input: { file_path: file, content: 'export default 1' } }),
  }).toString();
  const first = run();
  assert.match(JSON.parse(first).hookSpecificOutput.additionalContext, /src\/components\/Card\.jsx/);
  assert.equal(run(), '', 'asked once per session');
});
