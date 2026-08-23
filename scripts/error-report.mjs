#!/usr/bin/env node
// Turn source/quality/incidents.json into a report — for the owner, or for the
// maintainer of this framework.
//
// Every number in the output is counted here, at render time. None of it is
// written by hand, because a count spelled out in prose goes stale without
// anyone touching the text (docs/failure-modes.md ▸ Silent expiry).
//
// Two forms, and the difference matters:
//   full          everything, including what the incident was actually about.
//                 For the owner. Stays in the repo.
//   --anonymized  each entry's `generic` lesson only, plus category, severity,
//                 who caught it and whether anything now guards it. Nothing
//                 about the owner, their clients, their documents or amounts.
//                 This is the form you send.
//
// Zero dependencies, Node built-ins only.
//
// Usage:
//   node scripts/error-report.mjs                       # full, to stdout
//   node scripts/error-report.mjs --anonymized --out=report.md
//   node scripts/error-report.mjs --anonymized --email   # + the mail line, ready to send

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const MAINTAINER = 'paul@bayesimpact.org'; // the agentic-organization maintainer
const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const ANON = args.includes('--anonymized') || args.includes('--anonymised');
const EMAIL = args.includes('--email');
const OUT = (args.find((a) => a.startsWith('--out=')) || '').slice(6);
const TO = (args.find((a) => a.startsWith('--to=')) || '').slice(5) || MAINTAINER;

const CATEGORIES = {
  'searched-too-late': 'Acting before looking',
  'status-of-information': 'Status of information',
  numbers: 'Producing and reading figures',
  expiry: 'Silent expiry',
  destructive: 'Actions on files and the machine',
  handover: 'Handover and relationship',
  'parallel-sessions': 'Parallel sessions',
};
const SEVERITIES = ['critical', 'major', 'minor'];
const DETECTORS = { owner: 'the owner', self: 'the AI, rereading itself', 'another-session': 'another session', check: 'an automated check' };

const raw = JSON.parse(await readFile(join(ROOT, 'source/quality/incidents.json'), 'utf8'));
const all = (raw.incidents || []).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const project = (() => {
  try { return (raw.project || '').trim(); } catch { return ''; }
})();

// ---------------------------------------------------------------- counts

const n = all.length;
const heavy = all.filter((i) => i.severity === 'critical' || i.severity === 'major');
const byOwner = all.filter((i) => i.detected_by === 'owner');
const unguarded = all.filter((i) => !i.guard || i.guard.kind === 'none');
const checked = all.filter((i) => i.guard && i.guard.kind === 'check');
const byCat = Object.keys(CATEGORIES)
  .map((key) => ({ key, label: CATEGORIES[key], rows: all.filter((i) => i.category === key) }))
  .filter((c) => c.rows.length)
  .sort((a, b) => b.rows.length - a.rows.length);
const dates = all.map((i) => i.date).filter(Boolean).sort();
const pct = (part) => (n ? Math.round((part / n) * 100) : 0);

// ---------------------------------------------------------------- render

const L = [];
const say = (s = '') => L.push(s);

say(`# Agent error report${ANON ? '' : project ? ` — ${project}` : ''}`);
say();
if (!n) {
  say('The incident register is empty: nothing has been logged yet.');
  say();
  say('That is either good news or a reporting gap. The register is written by the `reflect` skill');
  say('at the end of a session, so an empty file after weeks of work usually means the reflection');
  say('pass is recording lessons but not the misses that produced them.');
  say();
} else {
  say(`${n} incident${n > 1 ? 's' : ''}, ${dates[0]} to ${dates[dates.length - 1]}. ` +
      `${heavy.length} major or critical, meaning a wrong conclusion travelled, data was destroyed, ` +
      `or the owner lost real time.`);
  say();
  say(ANON
    ? 'Anonymized form: each entry is the transferable lesson only. Nothing about the owner, their ' +
      'clients, their documents or their figures appears below. Sent to the maintainer of the ' +
      'agentic-organization framework so the next person to install it inherits what went wrong here.'
    : 'Full form, for the owner. `--anonymized` produces the version that can leave this repo.');
  say();

  say('## What this says about the framework, not just this project');
  say();
  say(`- **Dominant family: ${byCat[0].label.toLowerCase()}** (${byCat[0].rows.length} of ${n}). ` +
      'The largest family is where a default is missing, not where the AI happened to be careless.');
  say(`- **${byOwner.length} of ${n} (${pct(byOwner.length)}%) were caught by the owner.** ` +
      'That is the number that has to come down: those were visible from their screen, and there is ' +
      'no reason they should have seen them first.');
  say(`- **${checked.length} produced an executable check; ${unguarded.length} produced nothing but a written rule.** ` +
      'A rule that depends on an attentive reader is exactly what failed in most of these.');
  say();

  say('## By family');
  say();
  say('| Family | Incidents | Major or critical | Guarded by a check |');
  say('|---|---:|---:|---:|');
  for (const c of byCat) {
    say(`| ${c.label} | ${c.rows.length} | ${c.rows.filter((i) => i.severity !== 'minor').length} | ` +
        `${c.rows.filter((i) => i.guard && i.guard.kind === 'check').length} |`);
  }
  say(`| **Total** | **${n}** | **${heavy.length}** | **${checked.length}** |`);
  say();

  say('## The register');
  say();
  for (const c of byCat) {
    say(`### ${c.label}`);
    say();
    for (const sev of SEVERITIES) {
      for (const i of c.rows.filter((x) => x.severity === sev)) {
        const redact = new Set(i.sensitive || []);
        const show = (field) => (ANON && redact.has(field) ? null : i[field]);
        say(`#### ${i.id} · ${i.severity} · ${i.date}`);
        say();
        if (i.generic) { say(`**The lesson.** ${i.generic}`); say(); }
        if (show('inputs')) { say(`**What it had.** ${i.inputs}`); say(); }
        if (show('error')) { say(`**What it did.** ${i.error}`); say(); }
        if (i.why) { say(`**Why.** ${i.why}`); say(); }
        say(`**Caught by** ${DETECTORS[i.detected_by] || i.detected_by || 'unknown'}. ` +
            (i.guard && i.guard.kind === 'check' ? `Now checked by \`${i.guard.where}\`.`
              : i.guard && i.guard.kind === 'rule' ? `Written as a rule in \`${i.guard.where}\`.`
              : '**Nothing guards it yet.**'));
        say();
      }
    }
  }
}
say('---');
say();
say(`Generated by \`scripts/error-report.mjs\`${ANON ? ' --anonymized' : ''} from ` +
    `\`source/quality/incidents.json\` (${n} entr${n === 1 ? 'y' : 'ies'}) on ${new Date().toISOString().slice(0, 10)}. ` +
    'No count in this document is written by hand.');

const text = L.join('\n') + '\n';

if (OUT) {
  await writeFile(resolve(OUT), text);
  console.log(`Wrote ${OUT} — ${n} incident(s)${ANON ? ', anonymized' : ''}.`);
} else if (!EMAIL) {
  process.stdout.write(text);
}

if (EMAIL) {
  const path = OUT || 'error-report.md';
  if (!OUT) await writeFile(resolve(path), text);
  if (!ANON) {
    console.log('⚠ This is the FULL report: it contains the owner\'s own material. Send the');
    console.log('  anonymized form instead unless they explicitly said otherwise:');
    console.log('    node scripts/error-report.mjs --anonymized --email\n');
  }
  const subject = encodeURIComponent(`agentic-organization: error report (${n} incident${n === 1 ? '' : 's'})`);
  const body = encodeURIComponent(
    `Hello,\n\nAttached is an ${ANON ? 'anonymized ' : ''}error report from a project running the ` +
    `agentic-organization kit: ${n} incident${n === 1 ? '' : 's'}, ${heavy.length} major or critical, ` +
    `${byOwner.length} caught by the owner rather than by the AI.\n\n` +
    `The file is ${path} in the project folder — attach it before sending.\n\n`);
  console.log(`Report written to ${path}.`);
  console.log(`\nOpen a pre-filled mail to the maintainer:\n\n  mailto:${TO}?subject=${subject}&body=${body}\n`);
  console.log(`Then attach ${path}. Or paste its contents into the mail body if that is easier.`);
}
