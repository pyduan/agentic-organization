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
const DETECTORS = {
  owner: 'the owner', self: 'the AI, rereading itself', 'another-session': 'another session',
  check: 'an automated check', 'outside-user': 'someone else running this framework',
  'outside user': 'someone else running this framework',
};
// Whoever caught it, the question is whether a person had to. The register grew an
// `outside user` value the map never listed, and the headline figure counted only
// `owner`, so three incidents found by a person reading her own files were scored
// as if the framework had caught them itself.
const HUMAN = new Set(['owner', 'outside-user', 'outside user', 'another-session']);

const raw = JSON.parse(await readFile(join(ROOT, 'source/quality/incidents.json'), 'utf8'));
const all = (raw.incidents || []).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const project = (() => {
  try { return (raw.project || '').trim(); } catch { return ''; }
})();

// ---------------------------------------------------------------- counts

// A guard is either something that runs and can refuse, or a sentence someone has
// to remember. That distinction is the whole point of the register, so the three
// buckets below must account for every entry and must add up to the total.
//
// They did not. `unguarded` matched only `kind: "none"` while the sentence printing
// it said "produced nothing but a written rule", so every `rule` entry fell into
// neither bucket and the report read as full coverage. Worse, the register had
// grown two kinds the schema never listed, `test` and `tool`, and nothing rejected
// them: they were silently absent from every count. On this repo's own six
// incidents the output was "1 produced an executable check; 0 produced nothing but
// a written rule" — five entries uncounted, and the one number an owner would look
// at to decide whether the framework is improving read as perfect.
//
// Reported by an owner who found the same shape in her own register: the count of
// incidents left unguarded was six, and the honest count was eighty-nine of a
// hundred and thirteen, because anything phrased as a rule was scored as a guard.
// Her words, and they are the reason this is not a cosmetic fix: a measure that
// flatters, in the document whose whole purpose is to stop you reassuring yourself
// (2026-08-31).
const EXECUTABLE = new Set(['check', 'test', 'tool']); // it runs, and it can say no
const WRITTEN = new Set(['rule']);                     // it depends on an attentive reader
const NOTHING = new Set(['none']);
const kindOf = (i) => (i.guard && i.guard.kind) || 'none';

const n = all.length;
const heavy = all.filter((i) => i.severity === 'critical' || i.severity === 'major');
const byHuman = all.filter((i) => HUMAN.has(i.detected_by));
const checked = all.filter((i) => EXECUTABLE.has(kindOf(i)));
const ruleOnly = all.filter((i) => WRITTEN.has(kindOf(i)));
const unguarded = all.filter((i) => NOTHING.has(kindOf(i)));
// Anything the schema does not define. Never folded into a bucket: a kind nobody
// declared is a hole in the register, and guessing which way it counts is how the
// last version of this got it wrong.
const unclassified = all.filter((i) => {
  const k = kindOf(i);
  return !EXECUTABLE.has(k) && !WRITTEN.has(k) && !NOTHING.has(k);
});
if (checked.length + ruleOnly.length + unguarded.length + unclassified.length !== n) {
  console.error('error-report: the guard buckets do not account for every incident. Refusing to print a figure that does not add up.');
  process.exit(1);
}
// Did a guard hold? An incident landing in a family that already had an executable
// guard is the one signal that distinguishes "a correction failed" from "this
// category is simply large". Chronological, because a guard only counts as prior.
const byDate = all.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
const afterGuard = (() => {
  const guarded = new Set();
  const out = [];
  for (const i of byDate) {
    if (guarded.has(i.category)) out.push(i);
    if (EXECUTABLE.has(kindOf(i))) guarded.add(i.category);
  }
  return out;
})();

// And is the share a person has to catch going down? Compare the older half of the
// register with the newer half. This is what the owner's question was actually
// about, and it is one line.
const trend = (() => {
  if (byDate.length < 6) return null;
  const cut = Math.floor(byDate.length / 2);
  const share = (rows) => (rows.length ? Math.round((rows.filter((i) => HUMAN.has(i.detected_by)).length / rows.length) * 100) : 0);
  const before = share(byDate.slice(0, cut));
  const after = share(byDate.slice(cut));
  const word = after < before ? 'down from' : after > before ? 'UP from' : 'unchanged from';
  return { before, after, text: `Newer half ${after}%, ${word} ${before}% in the older half.` };
})();

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
  // Order matters, and it was wrong. This block used to open on the dominant
  // family, which is the indicator that computes without effort and the one that
  // invites a false conclusion: a family is a wide bucket, so it cannot disappear,
  // and its persistence says nothing about whether a correction worked. An owner
  // asked whether to send an updated register to this framework's maintainer, was
  // told the case count had risen but "the families are the same", and reasonably
  // concluded nothing had been fixed — while the share she was catching herself had
  // in fact fallen. The figure was exact and the conclusion it produced was false.
  // So the two indicators that actually answer "is this improving" come first, and
  // the family count comes last carrying its own caveat (2026-09-03).
  say(`- **${byHuman.length} of ${n} (${pct(byHuman.length)}%) were caught by a person, not by the framework.** ` +
      `${trend ? `${trend.text} ` : ''}` +
      'That is the number that has to come down: those were visible from someone\u2019s screen, and there is ' +
      'no reason they should have seen them first.');
  say(`- **${afterGuard.length} happened in a family that already had an executable guard.** ` +
      (afterGuard.length
        ? 'A guard existed and did not hold, which is the only figure here that says a correction failed ' +
          'rather than that a category is popular. Read those entries before writing another rule.'
        : 'Nothing has yet recurred in a family that was already guarded.'));
  say(`- **${checked.length} of ${n} (${pct(checked.length)}%) produced something that runs and can refuse.** ` +
      `${ruleOnly.length} produced a written rule instead, and ${unguarded.length} produced nothing at all. ` +
      'A rule that depends on an attentive reader is exactly what failed in most of these, so the ' +
      'second and third figures belong together: neither will stop the next one on its own.');
  if (unclassified.length) {
    say(`- **⚠ ${unclassified.length} entr${unclassified.length > 1 ? 'ies' : 'y'} record a guard of a kind the schema does not define** ` +
        `(${[...new Set(unclassified.map((i) => kindOf(i)))].map((k) => `\`${k}\``).join(', ')}), ` +
        'so they are counted in none of the three figures above. Fix them in ' +
        '`source/quality/incidents.json` rather than reading round them: an entry nobody can classify ' +
        'is the register quietly shrinking.');
  }
  say(`- **Largest family: ${byCat[0].label.toLowerCase()}** (${byCat[0].rows.length} of ${n}), ` +
      'which says where a default is missing and nothing else. Seven wide buckets over a growing ' +
      'register: the biggest one cannot vanish, so do not read its persistence as evidence that ' +
      'corrections are not working, and never answer a question about the effect of a fix with it.');
  say();

  say('## By family');
  say();
  say('| Family | Incidents | Major or critical | Guarded by something that runs |');
  say('|---|---:|---:|---:|');
  for (const c of byCat) {
    say(`| ${c.label} | ${c.rows.length} | ${c.rows.filter((i) => i.severity !== 'minor').length} | ` +
        `${c.rows.filter((i) => EXECUTABLE.has(kindOf(i))).length} |`);
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
            (EXECUTABLE.has(kindOf(i)) ? `Now checked by \`${i.guard.where}\`.`
              : WRITTEN.has(kindOf(i)) ? `Written as a rule in \`${i.guard.where}\`.`
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
