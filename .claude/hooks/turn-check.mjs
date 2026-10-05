#!/usr/bin/env node
// Stop hook: before a turn ends, check what its answer asserts against what the
// turn actually did. It reads the session's own transcript, so it needs nobody to
// remember anything.
//
// Why a hook and not another rule. A register from a live project counted 37
// incidents that repeated an earlier one, same mechanism, rule already written,
// and on one day ten of thirteen. Its owner's conclusion: a written rule does not
// change the gesture at the moment it is made; the only defences that held were in
// the mechanism, "a hook that blocks the conclusion until the check is done". The
// mistakes it caught most often have a signature in the answer itself:
//
//   absence    "no document says…", "not found", "il me manque…"   no search ran
//   silence    "he never replied", "pas de réponse"                no search ran
//   verified   "verified", "c'est vérifié"                          nothing ran at all
//   failed     "sent", "published", "tests pass"                    the last call errored
//   partial    a file the answer names was read only in part, and never whole
//
// Each fires on the turn's final answer only, and blocks once: the second stop goes
// through (stop_hook_active), so a false alarm costs one look, never a loop. The
// answer to a block is to do the check, or to say exactly what was and was not
// looked at. A project adds or disables checks in `.claude/turn-checks.json`;
// `source/quality/turn-checks.example.json` holds a stricter one for legal claims.
//
// Zero dependencies. Never blocks on its own failure: a hook that cannot read the
// transcript says so on stderr and lets the turn end.

import { readFileSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ the turn

/** The current turn: everything after the last message a person (or a task) sent. */
export function currentTurn(jsonl) {
  const lines = jsonl.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((l) => l && !l.isSidechain && (l.type === 'user' || l.type === 'assistant'));
  const isPrompt = (l) => l.type === 'user' && !l.isMeta && (typeof l.message?.content === 'string'
    || (Array.isArray(l.message?.content) && !l.message.content.some((c) => c.type === 'tool_result')));
  let start = 0;
  for (let i = lines.length - 1; i >= 0; i--) if (isPrompt(lines[i])) { start = i + 1; break; }
  const turn = lines.slice(start);

  const calls = [];
  const byId = new Map();
  let finalText = [];
  for (const l of turn) {
    const content = Array.isArray(l.message?.content) ? l.message.content : [];
    if (l.type === 'assistant') {
      for (const c of content) {
        if (c.type === 'tool_use') {
          const call = { id: c.id, name: c.name, input: c.input || {}, error: false, output: '' };
          calls.push(call); byId.set(c.id, call);
          finalText = [];                       // the answer is what comes after the last call
        } else if (c.type === 'text' && c.text) finalText.push(c.text);
      }
    } else {
      for (const c of content) {
        if (c.type !== 'tool_result') continue;
        const call = byId.get(c.tool_use_id);
        if (!call) continue;
        call.error = Boolean(c.is_error);
        call.output = typeof c.content === 'string' ? c.content
          : Array.isArray(c.content) ? c.content.map((x) => x.text || '').join('\n') : '';
      }
    }
  }
  return { calls, answer: finalText.join('\n') };
}

// ------------------------------------------------------------------ what counts

const SEARCH_TOOLS = /^(Grep|Glob|LS|WebSearch|WebFetch|ToolSearch)$/;
const SEARCH_MCP = /search|query|list|find|get_thread|get_message|read/i;
const SEARCH_SHELL = /\b(grep|rg|ag|find|fd|mdfind|locate|ls|git\s+(log|grep|show)|sqlite3|jq)\b/;

export const isSearch = (c) =>
  SEARCH_TOOLS.test(c.name)
  || (c.name.startsWith('mcp__') && SEARCH_MCP.test(c.name.split('__').slice(2).join('__')))
  || (c.name === 'Bash' && SEARCH_SHELL.test(String(c.input.command || '')));

/** Files a call read, and whether it read them whole. */
export function reads(c) {
  if (c.name === 'Read' && c.input.file_path) {
    const partial = c.input.offset !== undefined || c.input.limit !== undefined || c.input.pages !== undefined;
    return [{ file: c.input.file_path, whole: !partial }];
  }
  if (c.name === 'Bash') {
    const cmd = String(c.input.command || '');
    const out = [];
    for (const m of cmd.matchAll(/\b(head|tail)\b(?:\s+-n?\s*\d+|\s+-\d+)?\s+((?:[\w.\/~-]+\/)?[\w.-]+\.\w+)/g)) out.push({ file: m[2], whole: false });
    for (const m of cmd.matchAll(/\bsed\s+-n\s+'[^']*'\s+((?:[\w.\/~-]+\/)?[\w.-]+\.\w+)/g)) out.push({ file: m[1], whole: false });
    for (const m of cmd.matchAll(/\bcat\s+((?:[\w.\/~-]+\/)?[\w.-]+\.\w+)(?!\s*\|\s*(head|tail|sed))/g)) out.push({ file: m[1], whole: true });
    return out;
  }
  return [];
}

// ------------------------------------------------------------------ the checks

// A shell command that writes a file: a redirect, an in-place edit, a heredoc into python.
const WRITES = /(^|[^>&2])>{1,2}\s*[\w.\/~"'-]|\bsed\s+-i\b|\btee\b|\bwriteFileSync\b|open\([^)]*['"]w['"]|python3?\s+-\s*<</;

// JavaScript's \b only knows ASCII letters, so "trouvé" never ends a word for it and
// a French claim would slip through. Every \b in a pattern is read as a Unicode
// word boundary instead.
const W = '[\\p{L}\\p{N}_]';
const UB = `(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))`;
const re = (s) => new RegExp(s.replaceAll('\\b', UB), 'iu');
// Words that make a sentence lean on a file as its source.
const CITES = re("\\b(selon|d'après|dit que|disent|indique|établit|porte|prévoit|stipule|précise|mentionne|confirme|montre|ne dit|ne mentionne|according to|says|say that|states|shows|indicates|confirms|mentions|provides that|per)\\b");

export const DEFAULT_CHECKS = [
  {
    id: 'absence',
    patterns: [
      "\\b(could ?n[o']t|couldn't|did ?n[o']t|didn't) find\\b", '\\bnot found in\\b',
      "\\bdoes(n't| not) (exist|appear) (in|anywhere)\\b",
      '\\bno (record|trace|mention|document|file|email|e-mail|message|evidence)s? (of|for|about|in)\\b',
      '\\bnowhere in\\b', '\\bmissing from (the|your|their|his|her)\\b',
      "\\baucune? (trace|pièce|mention|document|courriel|mail|message|fichier|preuve)\\b",
      "\\bintrouvable",
      "\\bn'(existe|apparaît|figure) (pas|nulle part) dans (le|la|les|ce|cette|ces|vos|tes|ses|son|sa|leurs?) ",
      "\\b(pas|jamais) (été )?(trouvée?s?|retrouvée?s?)\\b", "\\bje ne (le |la |les )?(trouve|retrouve) pas",
      "\\bil me manque\\b", '\\bnulle part dans\\b',
    ],
    requires: 'look',
    say: 'asserts that something is missing or does not exist, and this turn neither searched nor read anything whole. No search proves ' +
      'an absence, and none was even attempted. Search the whole corpus by question (mail folder names, ' +
      'the inventory, the full text), calibrate on a case you know should appear, then either give what you ' +
      'found or say exactly where you looked: "I did not find it in X and Y" is true, "it does not exist" is not.',
  },
  {
    id: 'silence',
    patterns: [
      "\\b(never|has ?n[o']t|hasn't|did ?n[o']t|didn't) (replied|answered|responded|got back|come back)\\b",
      '\\bno (reply|answer|response) (from|yet)\\b',
      "\\bn'(a|ont) (jamais |pas )?(répondu|réagi|donné suite)", '\\bjamais revenue?s?\\b',
      '\\bpas de (réponse|retour)\\b', '\\bsans (réponse|nouvelles)\\b',
    ],
    requires: 'search',
    say: 'asserts that someone has not answered, and no search ran this turn. Silence on one thread is not ' +
      'silence: open the mailbox (inbox and the folder named for the subject), the messaging threads and the ' +
      'sent items since the date in question before writing it, and never build a grievance on it unchecked.',
  },
  {
    id: 'verified',
    patterns: [
      "(?<!not |never |un)\\b(verified|double-checked|i checked|i confirmed)\\b",
      "(?<!non |pas |pas encore |à )\\b(vérifiée?s?|je confirme|j'ai vérifié)\\b",
    ],
    requires: 'any-call',
    say: 'says something was verified, and this turn ran nothing. A verification is a call whose output you ' +
      'read. Run it, or say it comes from an earlier turn and when.',
  },
  {
    id: 'failed',
    patterns: [
      '\\b(sent|published|deployed|pushed|merged|tests? pass(ed|es)?|all green|is live)\\b',
      '\\b(envoyée?s?|publiée?s?|déployée?s?|poussée?s?|en ligne|tests? (au vert|passent))\\b',
    ],
    requires: 'last-call-ok',
    say: 'announces a success, and the last command of this turn returned an error. Read its output: a ' +
      'confirmation is deduced from the result, never written beside the command.',
  },
  {
    id: 'partial',
    requires: 'whole-read-of-named-files',
    say: 'names a file that this turn read only in part (an offset or limit, head, tail, sed -n) and never ' +
      'whole. A conclusion drawn from part of a source is a conclusion drawn from a summary. Read it whole, ' +
      'or say which part you read and that the rest was not opened.',
  },
];

function loadProjectChecks(dir) {
  try {
    const j = JSON.parse(readFileSync(join(dir, '.claude', 'turn-checks.json'), 'utf8'));
    const off = new Set(j.disable || []);
    return [...DEFAULT_CHECKS.filter((c) => !off.has(c.id)), ...(j.checks || [])];
  } catch { return DEFAULT_CHECKS; }
}

/** The sentence of the answer in which a pattern matched, for quoting back. */
const sentenceAt = (text, index) => {
  const stop = /[.!?](?=\s|$)|\n/g;          // a dot inside a name (file.md) is not a stop
  let start = 0, end = text.length, m;
  while ((m = stop.exec(text))) {
    if (m.index < index) start = m.index + 1;
    else { end = m.index + 1; break; }
  }
  return text.slice(start, end).trim().slice(0, 240);
};

/**
 * Returns the findings for a turn: [{ id, quote, say }]. Pure, so it is tested
 * on fixture transcripts.
 */
export function check({ calls, answer }, checks = DEFAULT_CHECKS) {
  if (!answer.trim()) return [];
  const text = answer.replace(/```[\s\S]*?```/g, ' ');     // code blocks are not claims
  const out = [];
  const searched = calls.some(isSearch);
  for (const c of checks) {
    if (c.requires === 'whole-read-of-named-files') {
      // Naming a file the turn itself edited is reporting the change, not citing a
      // source: it is excluded, or every summary of an edit would be flagged.
      const written = new Set(calls.filter((k) => ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(k.name))
        .map((k) => basename(k.input.file_path || k.input.notebook_path || '')));
      const shellWrites = calls.filter((k) => k.name === 'Bash' && WRITES.test(String(k.input.command || '')))
        .map((k) => String(k.input.command));
      const seen = new Map();
      for (const call of calls) for (const r of reads(call)) {
        const key = basename(r.file);
        seen.set(key, (seen.get(key) || false) || r.whole);
      }
      for (const [name, whole] of seen) {
        if (whole || name.length < 5 || written.has(name) || shellWrites.some((cmd) => cmd.includes(name))) continue;
        // Only a sentence that uses the file as a source: "according to X", "X says…".
        // Naming it to report where something was put is not citing it.
        for (let i = text.indexOf(name); i > -1; i = text.indexOf(name, i + name.length)) {
          const quote = sentenceAt(text, i);
          if (CITES.test(quote)) { out.push({ id: c.id, quote, say: c.say }); break; }
        }
      }
      continue;
    }
    for (const p of c.patterns || []) {
      const m = re(p).exec(text);
      if (!m) continue;
      const quote = sentenceAt(text, m.index);
      if (c.requires === 'search' && searched) break;
      if (c.requires === 'look' && (searched || calls.some((k) => reads(k).some((r) => r.whole)))) break;
      if (c.requires === 'any-call' && calls.length) break;
      if (c.requires === 'last-call-ok' && !(calls.length && calls[calls.length - 1].error)) break;
      if (c.requires === 'cite' && re(c.cite || '$^').test(quote)) break;
      out.push({ id: c.id, quote, say: c.say });
      break;
    }
  }
  return out;
}

// ------------------------------------------------------------------ the hook

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();

if (isMain) {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let event;
  try { event = JSON.parse(raw); } catch { process.exit(0); }
  if (event.stop_hook_active) process.exit(0);           // block once, never loop
  let transcript;
  try { transcript = readFileSync(event.transcript_path, 'utf8'); }
  catch (e) { console.error(`turn-check: could not read the transcript (${e.message}); nothing was checked.`); process.exit(1); }
  const dir = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const findings = check(currentTurn(transcript), loadProjectChecks(dir));
  if (findings.length) {
    const reason = ['Before ending this turn — your answer:', ...findings.map((f) => `• «${f.quote}» ${f.say}`),
      'Do the check now, or rewrite the sentence to say exactly what was and was not looked at.'].join('\n');
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  }
}
