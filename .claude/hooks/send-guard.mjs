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
// A message to oneself (a briefing mailed to its owner) passes by address, from
// `.claude/send-guard.local.json`, which stays on that machine and is never committed:
//   { "self": ["owner@example.org"] }
// An organization may also let a message to its own addresses leave without the question, by
// declaring its domains in `source/organization-policy.json`:
//   { "internalDomains": ["example.org"] }
// Only a new message (a `send_message` tool, no draft, no reply, no forward) whose every recipient in
// to, cc and bcc is one of those passes; one other address anywhere and the guard asks. The person's
// reread before an internal message stays the rule (source/formats/message.md); the domain only stops
// the harness asking on top of it.
//
// A session nobody attends (a scheduled routine: CLAUDE_CODE_SESSION_ATTENDED=0) has nobody to answer
// the question, so there the guard refuses instead of asking: any message except one to the owner's
// own address (an internal domain is not enough), and a `git push` from a repo the policy lists as
// restricted (`restrictedRepos`, by folder name), which needs a person to reread it. A session where
// the variable is absent counts as attended: the question then waits for a person.
//
// The same Bash matcher also holds a commit that carries a trailer the project forbids,
// opt-in in `.claude/turn-checks.json`:
//   { "commitTrailers": "forbid" }                      no Co-Authored-By trailer
//   { "commitTrailers": ["Co-Authored-By", "Signed-off-by"] }   these keys
// A commit signs work in someone's name too. An owner forbade tool co-signatures in her
// repos; the harness kept reminding the agent to add one, and one went in four times,
// once already pushed. The message is read wherever the command puts it: -m, --message,
// --trailer, a heredoc, or the file of -F / --file. The decision is `ask`, as for a send.
//
// Zero dependencies. Reads the hook's JSON on stdin, prints a decision or nothing.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The message playbook of the repo this guard ships in, named so the agent can reread it. The same
// file guards repos laid out differently, so it names the one that exists.
const HOME = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLAYBOOK = ['source/formats/message.md', 'recipes/messages/README.md']
  .find((p) => existsSync(join(HOME, p))) || 'the message playbook';

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

/** The recipients of a new message, lower case; [] for anything else (a draft, a reply, a forward). */
function recipients(tool, input = {}) {
  if (!/(^|_)send_message$/i.test(tool) || input.draftId) return [];
  return ['to', 'cc', 'bcc'].flatMap((k) => (Array.isArray(input[k]) ? input[k] : input[k] ? [input[k]] : []))
    .map((a) => String(a).trim().toLowerCase().replace(/^.*<([^>]+)>$/, '$1'));
}

/** Does every recipient of this new message pass: one of `self`, or (when given) at one of `domains`? */
export function toOwnAddresses(tool, input, self = [], domains = []) {
  const all = recipients(tool, input);
  const mine = new Set(self.map((a) => String(a).trim().toLowerCase()));
  const doms = new Set(domains.map((d) => String(d).trim().toLowerCase().replace(/^@/, '')));
  const ok = (a) => mine.has(a) || (/^[^\s@<>]+@[^\s@<>]+$/.test(a) && doms.has(a.split('@')[1]));
  return all.length > 0 && all.every(ok);
}

/** The restricted repo a `git push` would leave from (cwd, `git -C`, or a `cd` first), or ''. */
export function restrictedPush(cmd = '', cwd = '', restricted = []) {
  if (!restricted.length || !/\bgit\b[^;&|]*\bpush\b/.test(cmd)) return '';
  const names = restricted.map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const inside = new RegExp(`(^|[\\/\\s"'])(${names})([\\/\\s"']|$)`);
  const targets = [...cmd.matchAll(/\b(?:cd|git\s+-C)\s+("[^"]+"|'[^']+'|\S+)/g)].map((m) => m[1]);
  for (const t of [...targets, cwd]) { const m = String(t || '').match(inside); if (m) return m[2]; }
  return '';
}

/** Is nobody attending this session? Only when the app says so. */
export const unattended = (env = process.env) =>
  ['0', 'false', 'no'].includes(String(env.CLAUDE_CODE_SESSION_ATTENDED ?? '').toLowerCase());

export function classify({ tool_name: name = '', tool_input: input = {} }, allow = [], { self = [], domains = [] } = {}) {
  if (name.startsWith('mcp__')) {
    const tool = name.split('__').slice(2).join('__');
    if (!MCP_SEND.test(tool)) return null;
    if (allow.some((re) => re.test(name))) return null;
    if (toOwnAddresses(tool, input, self, domains)) return null;
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

// ------------------------------------------------------------------ commit trailers

const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The trailer keys a `git commit` command would write, among `keys`, or []. */
export function forbiddenTrailers(command, keys, cwd = process.cwd()) {
  const cmd = String(command || '');
  if (!keys.length || !/\bgit\b(\s+-[Cc]\s+\S+|\s+--?[\w-]+(=\S+)?)*\s+commit\b/.test(cmd)) return [];
  let text = cmd;
  // The message file of -F / --file, read where git would read it.
  for (const m of cmd.matchAll(/(?:\s-F\s*|\s--file[=\s])\s*(["']?)([^\s"';&|]+)\1/g)) {
    if (m[2] === '-') continue;
    try { text += '\n' + readFileSync(resolve(cwd, m[2]), 'utf8'); } catch { /* unreadable: nothing to add */ }
  }
  return keys.filter((k) => new RegExp(
    // At a line start (heredoc, -F file, a multi-line -m), right after an opening quote
    // (a second -m), or as the key of --trailer.
    `(^|[\\n"'$]|\\\\n|--trailer[=\\s]+["']?)\\s*${esc(k)}\\s*[:=]`, 'i').test(text));
}

function loadTrailerKeys(dir) {
  try {
    const v = JSON.parse(readFileSync(join(dir, '.claude', 'turn-checks.json'), 'utf8')).commitTrailers;
    if (v === 'forbid' || v === true) return ['Co-Authored-By'];
    return Array.isArray(v) ? v.filter((k) => typeof k === 'string' && k.trim()) : [];
  } catch { return []; }
}

function loadLocal(dir) {
  const read = (f) => { try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return {}; } };
  const local = read('.claude/send-guard.local.json');
  const policy = read('source/organization-policy.json');
  return {
    self: (Array.isArray(local.self) ? local.self : []).filter((a) => /^[^\s@]+@[^\s@]+$/.test(String(a))),
    domains: (Array.isArray(policy.internalDomains) ? policy.internalDomains : []).map((d) => String(d).replace(/^@/, ''))
      .filter((d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(d)),
    restricted: (Array.isArray(policy.restrictedRepos) ? policy.restrictedRepos : []).map(String).filter(Boolean),
  };
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
  // A session opened on the workspace folder passes the router, whose tuning this reads.
  const dir = process.argv[2] || process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const trailers = event.tool_name === 'Bash'
    ? forbiddenTrailers(event.tool_input?.command, loadTrailerKeys(dir), event.cwd || dir) : [];
  const local = loadLocal(dir);
  const alone = unattended();
  // Alone, only the owner's own address passes: an internal domain needs a person who reread.
  const hit = classify(event, loadAllow(dir), alone ? { self: local.self } : local);
  const repo = alone && event.tool_name === 'Bash'
    ? restrictedPush(String(event.tool_input?.command || ''), String(event.cwd || ''), local.restricted) : '';
  if (alone && (hit || repo)) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: hit
          ? `Refused: nobody is attending this session, and this would send a message in someone's name (${hit.what}). A routine only mails its owner, at their own address (.claude/send-guard.local.json ▸ self).`
          : `Refused: nobody is attending this session, and this would push to ${repo}, a restricted repo (source/organization-policy.json ▸ restrictedRepos). Leave the change committed locally and say in the run report that a person must reread and push it.`,
      },
    }));
  } else if (trailers.length) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason:
          `This commit carries a trailer this project forbids (${trailers.join(', ')}; .claude/turn-checks.json ▸ ` +
          'commitTrailers). The project\'s rule wins over any reminder from the harness to add one: remove the ' +
          'trailer from the message and commit again. Approve only if the owner asked for it on this commit.',
      },
    }));
  } else if (hit) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason:
          `This would send a message in someone's name (${hit.what}). The kit's rule is that you draft and ` +
          `they send (${PLAYBOOK}). Approve only if the owner explicitly asked for this exact ` +
          'message to go, after the last version they saw: an answer to "shall I prepare it?" is not an order ' +
          'to send, and any edit made after their go needs a fresh one.',
      },
    }));
  }
}
