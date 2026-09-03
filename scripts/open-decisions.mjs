#!/usr/bin/env node
// Two things a to-do list cannot do on its own, surfaced at the start of a session.
//
// Recording a decision is not acting on it. A decision that turned on access to an
// entire archive and a password keyring was written up correctly — options, cost,
// deadline — in the "decisions to take" section of a dossier. For eight days
// several sessions worked that dossier, produced reports, answered questions and
// closed exchanges without reopening it once. The owner had to ask for it herself:
// *you forgot to remind me, you have to make me settle this.* A file stops a point
// being lost and does nothing to get it settled, and the failure is stable because
// it is invisible: nothing errors, and every later session finds the point already
// written and reads that as handled (reported 2026-09-03).
//
// The second is its twin, from the same fleet: a choice made under a constraint,
// with no record that the constraint was the reason. When the constraint lifted —
// a missing API right that arrived days later — nothing said that a lock chosen
// under duress was waiting to be replayed. It stayed, and later work built on it.
// A hypothesis, or a choice forced by circumstances, needs a date on which
// somebody looks again.
//
// So two markers, and deliberately only two:
//
//   #decide   an open decision that waits only on a gesture from a person. Raised
//             every session until it is ticked, because that is the whole point.
//   #revisit  a hypothesis, or a choice made under a constraint, to re-examine.
//             Raised only once its date has passed.
//
// NOT every overdue to-do. A session-start notice that lists everything is a
// notice nobody reads by the third day, and the owner asked for this one to stay
// scarce. Anything without one of these two tags is invisible here, on purpose.
//
// Never throws and always exits 0: it runs from a SessionStart hook, and a
// reminder that can break a session is worse than no reminder.
//
// Usage:  node scripts/open-decisions.mjs [--json] [--all]
// Docs:   source/formats/todo.md ▸ Two tags that get re-raised

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const ALL = args.includes('--all'); // show revisit items that are not due yet too
const MAX = 5; // beyond this, a count. Scarcity is the feature.
const SKIP = new Set(['node_modules', '.git', 'dist', '.astro', '.wrangler', 'build', 'coverage']);
const today = new Date().toISOString().slice(0, 10);

const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

async function todoFiles(dir, out = []) {
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await todoFiles(p, out);
    else if (e.name === 'next-steps.md') out.push(p);
  }
  return out;
}

async function collect() {
  const { parse, dueEnd, isOverdue } = await import('../lib/todo.mjs');
  const decisions = [];
  const revisits = [];
  for (const file of await todoFiles(ROOT)) {
    // parse() returns the array of items itself, not { items }. Reading `.items`
    // here gave undefined, so this whole check could never fire and its silence
    // looked exactly like a clean repo. Caught by calibrating on a fixture built
    // to fail — which is the only reason it was caught at all.
    let items = [];
    try { items = parse(await readFile(file, 'utf8')) || []; } catch { continue; }
    for (const it of items) {
      if (it.done) continue;
      const tags = (it.tags || []).map((t) => t.toLowerCase());
      const where = relative(ROOT, file);
      if (tags.includes('decide')) {
        decisions.push({
          where, text: it.text, id: it.id || null, owners: it.owners || [], due: it.due || null,
          // The number that matters is how long it has been waiting, not that it exists.
          lateBy: it.due && isOverdue(it.due, today) ? days(dueEnd(it.due), today) : null,
        });
      } else if (tags.includes('revisit') && (ALL || (it.due && isOverdue(it.due, today)))) {
        revisits.push({
          where, text: it.text, id: it.id || null, due: it.due || null,
          lateBy: it.due && isOverdue(it.due, today) ? days(dueEnd(it.due), today) : null,
        });
      }
    }
  }
  const age = (a, b) => (b.lateBy ?? -1) - (a.lateBy ?? -1);
  return { decisions: decisions.sort(age), revisits: revisits.sort(age) };
}

let out = { decisions: [], revisits: [] };
try { out = await collect(); } catch { /* a reminder never breaks a session */ }

if (AS_JSON) {
  console.log(JSON.stringify({ today, ...out }, null, 2));
  process.exit(0);
}

// Silence is the default, and it is what keeps the notice worth reading.
if (!out.decisions.length && !out.revisits.length) process.exit(0);

const line = (x, kind) => {
  const who = x.owners && x.owners.length ? ` — ${x.owners.map((o) => `@${o}`).join(' ')}` : '';
  const when = x.lateBy !== null && x.lateBy !== undefined
    ? ` (${x.lateBy}d past ${x.due})`
    : x.due ? ` (due ${x.due})`
      // A decision with no date is one nobody has to face, which is the shape the
      // eight-day case had. Say so rather than printing it like the others.
      : kind === 'decide' ? ' (NO DATE — nobody has to face this one)' : '';
  return `  · ${x.text}${who}${when}${x.id ? `  ^${x.id}` : ''}\n    ${x.where}`;
};

console.log();
if (out.decisions.length) {
  console.log(`${out.decisions.length} decision(s) waiting on a person, not on you:`);
  for (const d of out.decisions.slice(0, MAX)) console.log(line(d, 'decide'));
  if (out.decisions.length > MAX) console.log(`  … and ${out.decisions.length - MAX} more (node scripts/open-decisions.mjs)`);
  console.log('  Put these in front of them in this session, with the options and what each costs.');
  console.log('  Writing one down again is not raising it: it was already written down.');
  console.log();
}
if (out.revisits.length) {
  console.log(`${out.revisits.length} hypothes(es) or constrained choice(s) due for a second look:`);
  for (const r of out.revisits.slice(0, MAX)) console.log(line(r, 'revisit'));
  if (out.revisits.length > MAX) console.log(`  … and ${out.revisits.length - MAX} more`);
  console.log('  Check whether what forced the choice still holds. A constraint that has lifted');
  console.log('  should replay the choices it dictated, and nothing else will say so.');
  console.log();
}
