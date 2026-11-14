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
// mistakes it caught most often have a signature in the answer itself. This is the
// one enumerated list of the checks; `node .claude/hooks/turn-check.mjs --list [dir]`
// prints the ones active in a project (these defaults, less what it disables, plus its
// own), and a test fails when a default is missing here.
//
//   absence      "no document says…", "not found", "il me manque…"
//                → no search ran and no file was read whole
//   silence      "he never replied", "pas de réponse"       → no search ran
//   verified     "verified", "c'est vérifié"
//                → nothing ran at all, or, after an Edit or Write, nothing ran after
//                the last one but searches and rereads
//   concordance  "they reconcile exactly", "se recoupent"
//                → nothing computed (node -e, python, awk, bc, jq, a project script)
//   failed       "pushed", "deployed", "tests pass", "sent"
//                → the call that claim is about failed: the last git push, the last
//                deploy, the last test run (or a test run piped into grep, tail or
//                head, whose exit code is the filter's); otherwise the last call
//   empty-check  "intact", "all green", "aucune anomalie", "✓"
//                → a tool output this turn shows the check examined nothing
//                ("0 files", "0 tests", "no tests found", "nothing to verify")
//   partial      a file the answer cites as a source was read only in part, never whole
//
// One more is opt-in, because only the project knows which language its owner reads:
//
//   language     with `"language": "fr"` (or "en") in `.claude/turn-checks.json`, a
//                sentence written in another language anywhere in the turn's text,
//                the short narration between tool calls included. A register logged
//                six English transition sentences in one night ("Now let me check the
//                file.") under a written rule to answer in French; a Stop check ended
//                it. Code spans, fenced blocks, paths, commands, URLs, quotations,
//                blockquotes and table rows are left out, and a sentence is judged on
//                its function words only (the, and, is… against le, et, est…), so
//                English technical words inside a French sentence never count.
//
// Each fires on the turn's final answer only, and blocks once: the second stop goes
// through (stop_hook_active), so a false alarm costs one look, never a loop. The
// answer to a block is to do the check, or to say exactly what was and was not
// looked at. A project adds or disables checks in `.claude/turn-checks.json`;
// `source/quality/turn-checks.example.json` holds a stricter one for legal claims, and
// `--list` prints what is active.
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
  const texts = [];                             // every text the turn wrote, narration included
  for (const l of turn) {
    const content = Array.isArray(l.message?.content) ? l.message.content : [];
    if (l.type === 'assistant') {
      for (const c of content) {
        if (c.type === 'tool_use') {
          const call = { id: c.id, name: c.name, input: c.input || {}, error: false, output: '' };
          calls.push(call); byId.set(c.id, call);
          finalText = [];                       // the answer is what comes after the last call
        } else if (c.type === 'text' && c.text) { finalText.push(c.text); texts.push(c.text); }
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
  return { calls, answer: finalText.join('\n'), texts };
}

// ------------------------------------------------------------------ what counts

const SEARCH_TOOLS = /^(Grep|Glob|LS|WebSearch|WebFetch|ToolSearch)$/;
const SEARCH_MCP = /search|query|list|find|get_thread|get_message|read/i;
const SEARCH_SHELL = /\b(grep|rg|ag|find|fd|mdfind|locate|ls|git\s+(log|grep|show)|sqlite3|jq)\b/;

export const isSearch = (c) =>
  SEARCH_TOOLS.test(c.name)
  || (c.name.startsWith('mcp__') && SEARCH_MCP.test(c.name.split('__').slice(2).join('__')))
  || (c.name === 'Bash' && SEARCH_SHELL.test(String(c.input.command || '')));

const cmdOf = (c) => (c.name === 'Bash' ? String(c.input.command || '') : '');
// The start of a shell command: the line, or after ; & | ( && || and an env assignment.
const AT = '(?:^|[;&|(\\n]\\s*|\\bthen\\s+|\\bdo\\s+)(?:[A-Z_][A-Z0-9_]*=\\S*\\s+)*';
const COMPUTE = new RegExp(AT + '(?:node\\s+(?:-e|-p|--eval|--print|--input-type)\\b|node\\s+[\\w.\\/~-]+\\.(?:m?js|cjs)\\b' +
  '|python3?\\b|awk\\b|gawk\\b|bc\\b|dc\\b|jq\\b|perl\\s+-\\w*e|ruby\\s+-e|Rscript\\b|sqlite3\\b|duckdb\\b|qalc\\b' +
  '|npm\\s+run\\b|npx\\s|deno\\s+(?:run|eval)\\b|bun\\s+(?:run|-e)\\b|\\.\\/[\\w.\\/-]+|(?:ba|z)?sh\\s+[\\w.\\/~-]+\\.sh\\b)', 'm');
/** A call that computed something: a shell running an interpreter or a project script, or a code-running tool. */
export const isCompute = (c) => (c.name === 'Bash' && COMPUTE.test(cmdOf(c)))
  || (c.name.startsWith('mcp__') && /execute|javascript|run_code|repl|update_formulas/i.test(c.name.split('__').slice(2).join('__')));

const EDITS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
// Calls that neither look at nor run anything: bookkeeping.
const BOOKKEEPING = /^(TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet|Skill|SendMessage|mcp__ccd_session__\w+)$/;
// A shell command made of looks only: every part is a search, a listing or a read.
const LOOK_WORDS = /^(grep|rg|ag|find|fd|ls|cat|head|tail|sed|wc|sort|uniq|cut|tr|echo|printf|pwd|cd|true|stat|file|diff|less|mdfind|locate|git\s+(log|show|grep|diff|status|blame|ls-files|branch|rev-parse))\b/;
const lookOnly = (c) => /^(Grep|Glob|LS|ToolSearch|WebSearch|Read)$/.test(c.name)
  || (c.name === 'Bash' && cmdOf(c).split(/\|\||&&|[;|\n]/).map((p) => p.trim()).filter(Boolean)
    .every((p) => LOOK_WORDS.test(p.replace(/^([A-Z_][A-Z0-9_]*=\S*\s+)+/, ''))));
/**
 * Did something run on the state the turn delivers? With no edit in the turn, any call.
 * After an edit, a call after the last one that does more than
 * look: rereading or grepping what you just wrote is not running it.
 */
export const ranAfterLastEdit = (calls) => {
  let last = -1;
  calls.forEach((c, i) => { if (EDITS.has(c.name)) last = i; });
  if (last === -1) return calls.length > 0;
  return calls.slice(last + 1).some((c) => !EDITS.has(c.name) && !BOOKKEEPING.test(c.name) && !lookOnly(c));
};

// What a check that examined nothing prints, matched on the outputs of the turn's calls.
// A zero alone is not enough: "0 files changed", "0 items stale" or "0 pages over budget"
// are results over a full input. Measured on 6,457 real turns, a bare "0 files|items|…"
// fired on 32 answers and 31 were wrong; the zero has to be the count of what was examined.
// "nothing checked" is left out too: a check that prints it on every run (no leak list on
// this machine) made every answer about a green suite look empty.
const EXAMINED_EN = '(?:checked|verified|scanned|examined|tested|read|found|matched|collected|processed|analy[sz]ed)';
const EXAMINED_FR = '(?:vérifiée?s?|contrôlée?s?|analysée?s?|lue?s?|trouvée?s?|examinée?s?|testée?s?|traitée?s?)';
const THINGS_EN = '(?:files?|entries|items|records|tests?|pages?|links?|rows|documents?|checks?)';
const THINGS_FR = '(?:fichiers?|entrées?|éléments?|enregistrements?|tests?|pages?|liens?|lignes?|documents?)';
const EMPTY = new RegExp([
  `(?<![\\d.,])\\b0 ${THINGS_EN} ${EXAMINED_EN}\\b`, `\\b${EXAMINED_EN}:? 0 ${THINGS_EN}\\b`,
  '\\bran 0 tests?\\b', '\\bcollected 0 items\\b', '^\\s*(?:ℹ|#)\\s*tests 0\\s*$', '\\bno tests? (?:found|ran|to run)\\b',
  '\\bnothing to (?:check|verify|test)\\b',
  `(?<![\\d.,])\\b0 ${THINGS_FR} ${EXAMINED_FR}`, `\\baucun(?:e|s|es)? ${THINGS_FR} ${EXAMINED_FR}`,
  '\\brien (?:à (?:vérifier|contrôler)|(?:n\'a été )?vérifié)\\b',
].join('|'), 'imu');

// A test runner, a deploy, a push: the calls a success claim is about.
const TEST_RUNNER = AT + '(?:npm\\s+(?:run\\s+)?test\\b|npm\\s+run\\s+check(?![:\\w-])|npx\\s+(?:vitest|jest|mocha|playwright)\\b|node\\s+--test\\b' +
  '|pytest\\b|python3?\\s+-m\\s+(?:pytest|unittest)\\b|vitest\\b|jest\\b|go\\s+test\\b|cargo\\s+test\\b|node\\s+[\\w.\\/~-]*test[\\w.-]*\\.m?js\\b)';
const PUSH = AT + 'git\\b[^;&|\\n]*\\spush\\b';
const DEPLOY = AT + '(?:npx\\s+)?(?:wrangler\\b[^;&|\\n]*\\sdeploy\\b|npm\\s+run\\s+[\\w:-]*(?:deploy|publish)[\\w:-]*|node\\s+[\\w.\\/~-]*(?:deploy|publish)[\\w.-]*\\.m?js\\b|vercel\\b|netlify\\s+deploy\\b|firebase\\s+deploy\\b)';
const MERGE = AT + 'gh\\s+pr\\s+merge\\b';
const SEND = AT + '(?:(?:node|bash|sh|zsh|python3?|osascript)\\s+(?:-\\S+\\s+)*[\\w.\\/~-]*send[\\w-]*\\.\\w+|sendmail\\b|mail\\s+-s\\b)';
const SEND_TOOL = '^mcp__.*(?:(?:^|_)(?:send|reply|forward)(?:_|$)|post_?message|send_draft)';
// A runner piped into a filter: the exit code read is the filter's, and its output was cut.
const PIPED = new RegExp(TEST_RUNNER + '[^;&|\\n]*\\|\\s*(grep|rg|tail|head)\\b', 'm');
// What each kind of call prints when it worked (`ok`) and when it did not (`bad`). The
// output decides before the exit code does, and the later of the two signs wins: a
// compound command fails for a reason of its own after a push that went through, and
// `git push || (git pull --rebase && git push)` prints a rejection, then a success.
const VERDICT = {
  push: {
    ok: '\\b[0-9a-f]{7,}\\.\\.\\.?[0-9a-f]{7,}\\s+\\S+\\s+->\\s+\\S+|\\[new (branch|tag)\\]|Everything up-to-date',
    bad: '\\[(remote )?rejected\\]|failed to push|^fatal: (unable to access|could not read from remote|Authentication failed|.*has no upstream|.*does not appear to be a git repository)',
  },
  deploy: {
    ok: 'Current Version ID|Deployed \\S+ triggers|Uploaded \\S+ \\(|Deployment complete|✨ Success',
    bad: '\\[ERROR\\]|^✘ ',
  },
  merge: { ok: '\\bMERGED\\b|(Squashed and merged|Merged|Rebased and merged) pull request', bad: 'is not mergeable|GraphQL: |Repository rule violations' },
  send: { ok: '', bad: '' },
  test: {
    ok: '^\\s*(ℹ|#)\\s*fail\\s+0\\s*$|\\b0 (failed|failures|failing)\\b|^Tests:\\s+\\d+ passed, \\d+ total|^\\s*\\d+ passing\\b(?![\\s\\S]*\\d+ failing)' +
      '|\\b(tests?|exit|test_exit|status)\\s*[=:]\\s*0\\b|^OK( \\(|$)',
    bad: '^\\s*(ℹ|#)\\s*fail\\s+[1-9]|\\b[1-9]\\d* (failed|failing)\\b|^not ok\\b|^✖ |^FAILED \\(|\\b(tests?|test_exit)\\s*[=:]\\s*[1-9]',
  },
};
const lastAt = (pattern, text) => { let at = -1; for (const m of text.matchAll(new RegExp(pattern, 'gmu'))) at = m.index; return at; };
/**
 * 'ok', 'bad' or 'unknown' for a call, from its output first and its exit code after.
 * The exit code of a compound command (a; b, a && b, a || b) speaks for its last part,
 * so it decides only for a command that is the call alone.
 */
function verdictOf(call, claim) {
  const ok = claim.ok ? lastAt(claim.ok, call.output) : -1;
  const bad = claim.bad ? lastAt(claim.bad, call.output) : -1;
  if (ok > bad) return 'ok';
  if (bad > -1) return /\|\|/.test(cmdOf(call)) && !call.error ? 'unknown' : 'bad';
  if (call.error && !/[;&|\n]/.test(cmdOf(call).replace(/\s*2>&1/g, '').trim())) return 'bad';
  return 'unknown';
}
// A call the harness refused never ran: it says nothing about the claim either way.
const refused = (c) => c.error && /permission for this action was denied|denied by the|blocked by (a |the )?hook|user (doesn't|does not) want to proceed/i.test(c.output);

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
    requires: 'run-after-edit',
    say: 'says something was verified, and nothing ran on the state this turn delivers: no call at all, or ' +
      'only searches and rereads after its last edit. ' +
      'A verification is a call whose output you read, made on the state you deliver. Run it, or say it ' +
      'comes from an earlier turn or from before the edit, and when.',
  },
  {
    id: 'concordance',
    patterns: [
      '\\b(match(es)?|agree|tally) (exactly|perfectly|to the (cent|penny|euro|dollar))\\b',
      '\\b(reconcile[sd]?|add(s)? up|tie[sd]? out)\\b', '\\bto the rounding\\b', '\\b(up )?to rounding\\b',
      '\\bse recoupent\\b', '\\b(concordent|coïncident|se rejoignent)\\b', '\\bcorrespond(ent)? exactement\\b',
      "\\b(aux|à l'|à un) arrondis? près\\b", '\\btombent juste\\b', '\\b(sont|est) cohérente?s? (entre (eux|elles)|avec)\\b',
    ],
    requires: 'compute',
    say: 'says two sources or figures agree, and this turn computed nothing (no node -e, python, awk, bc, jq or ' +
      'project script ran). A concordance is a subtraction whose result you read: two documents said to ' +
      '"reconcile exactly" differed threefold, and an unpaid third was carried as paid. Do the arithmetic now ' +
      'and give the gap, or say the comparison was not made.',
  },
  {
    id: 'failed',
    // Each claim is judged on the call it is about; a claim with no such call this
    // turn falls back to the last call.
    claims: [
      { pattern: '\\b(pushed|poussée?s?)\\b', call: PUSH, what: 'git push', ...VERDICT.push },
      { pattern: '\\b(deployed|is live|published|déployée?s?|en ligne|publiée?s?)\\b', call: DEPLOY, what: 'deploy', ...VERDICT.deploy },
      {
        pattern: '\\b(tests? (pass(ed|es)?|are (green|passing))|all green|tests? (au vert|passent))\\b', call: TEST_RUNNER,
        what: 'test run', ...VERDICT.test, piped: true,
      },
      { pattern: '\\b(sent|envoyée?s?)\\b', call: SEND, tool: SEND_TOOL, what: 'send', ...VERDICT.send },
      { pattern: '\\b(merged|fusionnée?s?)\\b', call: MERGE, what: 'merge', ...VERDICT.merge },
    ],
    requires: 'claim-call-ok',
    say: 'announces a success, and the call it is about failed. Read its output: a confirmation is deduced from ' +
      'the result, never written beside the command.',
  },
  {
    id: 'empty-check',
    patterns: [
      '\\b(intact|all good|all green|no anomal(y|ies)|clean|passes|all (checks|tests) pass(ed)?)\\b', '✓|✅',
      "\\b(tout est en ordre|aucune anomalie|rien à signaler|tout est (bon|vert|propre)|au vert|RAS)\\b",
    ],
    requires: 'nonempty-check',
    say: 'reports a success, and a check this turn examined nothing. A check over zero items passes by ' +
      'construction: find out why it saw nothing (a wrong path, a filter, an empty folder), or say that ' +
      'nothing was checked.',
  },
  {
    id: 'partial',
    requires: 'whole-read-of-named-files',
    say: 'names a file that this turn read only in part (an offset or limit, head, tail, sed -n) and never ' +
      'whole. A conclusion drawn from part of a source is a conclusion drawn from a summary. Read it whole, ' +
      'or say which part you read and that the rest was not opened.',
  },
];

export function loadProjectConfig(dir) {
  try {
    const j = JSON.parse(readFileSync(join(dir, '.claude', 'turn-checks.json'), 'utf8'));
    const off = new Set(j.disable || []);
    return {
      checks: [...DEFAULT_CHECKS.filter((c) => !off.has(c.id)), ...(j.checks || []).map((c) => ({ ...c, project: true }))],
      language: j.language, disabled: [...off],
    };
  } catch { return { checks: DEFAULT_CHECKS, disabled: [] }; }
}

/** The active checks of a project, one line each, for `--list`. */
export function listChecks(config) {
  const lines = config.checks.map((c) => `${c.id.padEnd(12)} ${c.project ? 'project' : 'default'}  ` +
    `${(c.requires || '').padEnd(15)} ${String(c.say || '').split(/(?<=\.)\s/)[0].slice(0, 120)}`);
  if (config.language) lines.push(`${'language'.padEnd(12)} project  ${''.padEnd(15)} every sentence of the turn in ${config.language}`);
  for (const id of config.disabled || []) lines.push(`${String(id).padEnd(12)} off      (disabled in .claude/turn-checks.json)`);
  return lines;
}

// ------------------------------------------------------------------ the language check

// Function words only: a technical term (build, commit, worktree) is not one, so it
// never makes a French sentence look English. Words both languages write the same way
// (a, on, me, son, or, but, as, an, en, ne…) are left out of both lists.
const FUNCTION_WORDS = {
  en: new Set(('the and is are was were be been being to of for with that this these those it its they them their ' +
    'we you he she his her our your will would should could can cannot let now then there here what which when where ' +
    'who why how have has had do does did not from into onto by at if so than also just only some any all each ' +
    'about after before because while until again still yet very too').split(' ')),
  fr: new Set(("le la les des du un une et est sont été être était étaient que qui quoi dans pour pas sur avec " +
    "ce cette ces cet il ils elle elles nous vous je tu au aux mais ou où sa ses par plus se lui leur leurs " +
    "déjà aussi très puis donc alors ainsi encore chez entre sans sous ça cela ceci mon ma mes ton ta tes " +
    "notre nos votre vos été fait faut peut doit avons avez ont suis sommes êtes c'est j'ai n'est qu'il " +
    "d'un d'une l'on").split(' ')),
};
export const LANGUAGES = Object.keys(FUNCTION_WORDS);

/** The prose of a text with everything that is not the agent's own sentence taken out. */
export function proseOf(text) {
  return text
    .replace(/```[\s\S]*?```/g, '\n')                       // fenced blocks
    .replace(/`[^`\n]*`/g, ' ')                               // code spans
    .split('\n').filter((l) => !/^\s*(>|\|)/.test(l)).join('\n')   // blockquotes, table rows
    .replace(/https?:\/\/\S+/g, ' ')                           // URLs
    .replace(/▸\s*\*[^*\n]+\*/g, ' ')                           // a heading cited after ▸
    .replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»|‘[^’\n]*’/g, ' ')  // quotations
    .replace(/(^|\s)[~.]?[\w.@-]*\/[\w.\/@~-]*/g, ' ')            // paths, owner/repo slugs
    .replace(/\b[\w-]+\.(md|mjs|js|json|ts|tsx|css|html|py|sh|txt|csv|pdf|yml|yaml|toml)\b/g, ' ')
    .replace(/(^|\s)--?[\w-]+/g, ' ');                          // command flags
}

/**
 * Sentences written in another language than `lang`. Each is judged on its function
 * words: at least four words, at least two function words of the other language, and
 * three in four of the function words it has belong to that other language.
 */
export function foreignSentences(texts, lang) {
  if (!FUNCTION_WORDS[lang]) return [];
  const out = [];
  for (const t of texts) {
    for (const raw of proseOf(t).split(/(?<=[.!?:;])\s+|\n+/)) {
      const sentence = raw.trim();
      const words = sentence.toLowerCase().replace(/[’]/g, "'").match(/[\p{L}']+/gu) || [];
      if (words.length < 4) continue;
      const own = words.filter((w) => FUNCTION_WORDS[lang].has(w)).length;
      for (const other of LANGUAGES) {
        if (other === lang) continue;
        const theirs = words.filter((w) => FUNCTION_WORDS[other].has(w)).length;
        if (theirs >= 2 && theirs >= 3 * own) { out.push({ sentence: sentence.slice(0, 160), other }); break; }
      }
    }
  }
  return out;
}

export function checkLanguage({ texts = [] }, lang) {
  const found = foreignSentences(texts, lang);
  if (!found.length) return [];
  const shown = found.slice(0, 3).map((f) => f.sentence).join('» «');
  return [{
    id: 'language', quote: shown + (found.length > 3 ? `» (+${found.length - 3} more) «` : ''),
    say: `${found.length > 1 ? 'are' : 'is'} written in another language than the one this project reads (${lang}), ` +
      'counting the short narration between tool calls. Write every sentence the owner sees in their language, ' +
      'the transitions included. A name that has to stay in its language (a commit title, a label) goes in ' +
      'quotation marks or in code, where this check does not read.',
  }];
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

// A success claim negated or put in the future is not a claim: "not pushed", "nothing was
// deployed", "will be sent", "pas encore poussé".
const NEGATED = re("(\\w+n't|\\b(not|never|nothing|no|nor|will|to be|once|when|until|pas|jamais|rien|ni|ne sera|n'est|n'a|n'ont|une fois|quand|dès que|à|non)\\b)[-\\s\\p{L}'’]{0,20}$");
// A claim that names its own exception reports a failure honestly: "pass except one".
const EXCEPT = re("^[\\s,]*(\\(?\\d+ )?(sauf|hormis|à part|except|apart from|but (one|\\d+))\\b");

/** The first success claim whose own call failed: { quote, say } or null. */
function failedClaim(text, calls, claims) {
  for (const claim of claims) {
    const rx = new RegExp(re(claim.pattern).source, 'giu');
    for (const m of text.matchAll(rx)) {
      if (NEGATED.test(text.slice(Math.max(0, m.index - 24), m.index))) continue;
      if (EXCEPT.test(text.slice(m.index + m[0].length, m.index + m[0].length + 24))) continue;
      const quote = sentenceAt(text, m.index);
      const callRe = claim.call ? new RegExp(claim.call, 'm') : null;
      const toolRe = claim.tool ? new RegExp(claim.tool) : null;
      const mine = calls.filter((k) => !refused(k)
        && ((callRe && callRe.test(cmdOf(k))) || (toolRe && toolRe.test(k.name))));
      const own = mine[mine.length - 1];
      if (own) {
        const v = verdictOf(own, claim);
        // A last call that says nothing either way (a quiet push, a probe that filters the
        // output: npm test | grep skipped) leans on an earlier one that showed it worked.
        if (v === 'unknown' && mine.some((k) => verdictOf(k, claim) === 'ok')) break;
        if (v === 'bad') {
          return { quote, say: `announces a success, and the last ${claim.what} of this turn failed. Read its output: a ` +
            'confirmation is deduced from the result, never written beside the command.' };
        }
        const pipe = claim.piped && v === 'unknown' && cmdOf(own).replace(/\d?>&\d/g, '').match(PIPED);
        if (pipe && !/pipefail|PIPESTATUS|pipestatus/.test(cmdOf(own))) {
          return { quote, say: `announces that tests pass, and the last ${claim.what} was piped into ${pipe[1]}: the exit ` +
            `code read was ${pipe[1]}'s and the output was cut. Run it unpiped (or with set -o pipefail) and read ` +
            'its exit code and its count of failures.' };
        }
      }
      // No call of its own this turn: the claim is about earlier work, and nothing here judges it.
      break;
    }
  }
  return null;
}

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
    if (c.requires === 'claim-call-ok') {
      const f = failedClaim(text, calls, c.claims || []);
      if (f) out.push({ id: c.id, quote: f.quote, say: f.say || c.say });
      continue;
    }
    if (c.requires === 'nonempty-check') {
      const empty = calls.map((k) => (k.output.match(EMPTY) || [])[0]).find(Boolean);
      if (!empty) continue;
      for (const p of c.patterns || []) {
        const m = re(p).exec(text);
        if (!m) continue;
        out.push({ id: c.id, quote: sentenceAt(text, m.index), say: `${c.say} (A tool output said «${empty.trim()}».)` });
        break;
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
      if (c.requires === 'compute' && calls.some(isCompute)) break;
      if (c.requires === 'run-after-edit' && ranAfterLastEdit(calls)) break;
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

if (isMain && process.argv.includes('--list')) {
  const dir = process.argv.slice(2).find((a) => a !== '--list') || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  console.log(listChecks(loadProjectConfig(dir)).join('\n'));
} else if (isMain) {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let event;
  try { event = JSON.parse(raw); } catch { process.exit(0); }
  if (event.stop_hook_active) process.exit(0);           // block once, never loop
  let transcript;
  try { transcript = readFileSync(event.transcript_path, 'utf8'); }
  catch (e) { console.error(`turn-check: could not read the transcript (${e.message}); nothing was checked.`); process.exit(1); }
  // A session opened on the workspace folder passes the router, whose tuning this reads.
  const dir = process.argv[2] || process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const config = loadProjectConfig(dir);
  const turn = currentTurn(transcript);
  const findings = [...check(turn, config.checks), ...(config.language ? checkLanguage(turn, config.language) : [])];
  if (findings.length) {
    const reason = ['Before ending this turn — your answer:', ...findings.map((f) => `• «${f.quote}» ${f.say}`),
      'Do the check now, or rewrite the sentence to say exactly what was and was not looked at.'].join('\n');
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  }
}
