#!/usr/bin/env node
// PreToolUse hook: anything that would send a message in someone's name waits for
// a person to approve it, at the moment it would leave.
//
// `source/formats/message.md` says "you draft, they send" in fifteen argued lines,
// and on a live project a mail still left in the owner's name while she was still
// correcting the draft: an instruction about one sentence was read as the order to
// send the whole. A second session, the same week, took "yes, prepare it" as "yes,
// send it". The rule existed both times and was broken by interpretation, which no
// amount of further prose fixes. So the harness asks, every time, and the person
// sees the exact call before it runs.
//
// What counts as sending: an MCP tool named like send/reply/forward/post a message
// or create a draft, on any server, and a shell command that mails or messages
// (osascript telling Mail or Messages to send, sendmail and its cousins, a mail or
// chat API called with curl, a project script named send-…). The decision is `ask`,
// never `deny`: the owner can approve a message they asked for, and the approval
// covers that call and nothing after it.
//
// A channel whose only recipient is the owner (an alert script that mails them
// their own report) can be exempted, by pattern, in `.claude/send-guard.json`:
//   { "allow": ["scripts/alert-owner\\.sh"] }
// Never add a pattern that can reach someone else.
//
// Zero dependencies. Reads the hook's JSON on stdin, prints a decision or nothing.

import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MCP_SEND = /(^|_)(send|reply|forward)(_|$)|post_?message|chat_?post|create_draft|update_draft|send_draft|schedule_send/i;
const SHELL_SEND = [
  /\bosascript\b[\s\S]*\b(send|envoyer)\b/i,                                  // Mail / Messages via AppleScript
  /\bosascript\b\s+\S*send\S*/i,                                              // osascript send-mail.applescript
  /\b(sendmail|mailx|msmtp|mutt|swaks|neomutt)\b/,
  /(^|[;&|]\s*)mail\s+-s\b/,
  /\bcurl\b[\s\S]*(sendgrid\.com|api\.mailgun\.net|postmarkapp\.com|api\.resend\.com|api\.brevo\.com|sendinblue|api\.telegram\.org\/bot[^\s]*\/send|slack\.com\/api\/chat\.post|hooks\.slack\.com|gmail\/v1\/users\/[^/\s]+\/(messages|drafts)\/send|graph\.microsoft\.com\/[^\s]*\/sendMail)/i,
  // A project's own send script, when it is run (not read, not this guard itself).
  /(^|[;&|(]\s*|\s)(node|bash|sh|zsh|python3?|ruby|deno|bun|osascript)\s+(-\S+\s+)*[\w.\/~-]*send(?!-guard)[\w-]*\.(mjs|js|cjs|sh|py|rb|applescript|scpt)\b/i,
  /(^|[;&|(]\s*)\.{0,2}\/[\w.\/~-]*send(?!-guard)[\w-]*\.(sh|py|rb|mjs|js)\b/i,
];

export function classify({ tool_name: name = '', tool_input: input = {} }, allow = []) {
  if (name.startsWith('mcp__')) {
    const tool = name.split('__').slice(2).join('__');
    if (!MCP_SEND.test(tool)) return null;
    if (allow.some((re) => re.test(name))) return null;
    return { what: `the ${tool} tool of ${name.split('__')[1]}` };
  }
  if (name === 'Bash') {
    const cmd = String(input.command || '');
    if (!SHELL_SEND.some((re) => re.test(cmd))) return null;
    if (allow.some((re) => re.test(cmd))) return null;
    return { what: 'a shell command that sends a message' };
  }
  return null;
}

function loadAllow(dir) {
  try {
    const j = JSON.parse(readFileSync(join(dir, '.claude', 'send-guard.json'), 'utf8'));
    return (j.allow || []).map((p) => new RegExp(p));
  } catch { return []; }
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let event;
  try { event = JSON.parse(raw); } catch { process.exit(0); }
  const dir = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const hit = classify(event, loadAllow(dir));
  if (hit) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason:
          `This would send a message in someone's name (${hit.what}). The kit's rule is that you draft and ` +
          'they send (source/formats/message.md). Approve only if the owner explicitly asked for this exact ' +
          'message to go, after the last version they saw: an answer to "shall I prepare it?" is not an order ' +
          'to send, and any edit made after their go needs a fresh one.',
      },
    }));
  }
}
