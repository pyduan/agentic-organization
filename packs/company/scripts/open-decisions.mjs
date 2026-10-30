#!/usr/bin/env node
// What waits on a person across the company's repos, put in front of the session that opens.
//
// Writing a choice under `## To decide` stops it being lost and does nothing to get it settled. The
// dashboard lists it, and a session that finds it already written reads that as handled. An
// organization on the kit lived this for eight days: a decision about access to a whole archive,
// written up correctly with its options and deadline, while several sessions worked the same dossier
// without reopening it, until its owner asked to be made to settle it.
//
// The kit's own scripts/open-decisions.mjs raises the #decide and #revisit tags of the to-do lists.
// This one raises what the company pack's repos hold instead, and only these three, because a notice
// that lists everything is a notice nobody reads by the third day:
//
//   To decide        every bullet under `## To decide` in the DECISIONS.md of customers, strategy,
//                    administrative and intranet beside this repo, with how long it has waited when
//                    it carries `(raised YYYY-MM-DD)`.
//   Revisit on …     a decision taken under a constraint or on a hypothesis, marked with the day to
//                    look again (the company-decisions skill). Raised once that day has passed.
//   inbox notes      notes from the intranet's bubble in source/inbox/notes/ nobody has filed yet.
//
// Never throws and always exits 0: it is meant for a SessionStart hook, and a reminder that can break
// a session is worse than no reminder. A file it cannot read is named on stderr, never skipped in
// silence, since silence is what this script exists to end.
//
//   node packs/company/scripts/open-decisions.mjs [--json]

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CENTRAL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const COMPANY_REPOS = ['customers', 'strategy', 'administrative', 'intranet'];
const MAX = 5;
const DAY = 86_400_000;

const localToday = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysSince = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/** The company repos beside the central one that carry a DECISIONS.md, and the central one's decisions. */
export function decisionFiles(central = CENTRAL) {
  const folder = dirname(central);
  return [join(central, 'source', 'decisions.md'), ...COMPANY_REPOS.map((r) => join(folder, r, 'DECISIONS.md'))]
    .filter((f) => existsSync(f));
}

/** The bullets under `## To decide`, joined across their continuation lines. Same reading as the intranet. */
export function pending(markdown) {
  const block = markdown.split(/^##\s+To decide\s*$/m)[1];
  if (!block) return [];
  const out = [];
  let current = null;
  const flush = () => { if (current) out.push(current.join(' ').replace(/\s+/g, ' ').trim()); current = null; };
  for (const line of block.split(/^##\s+/m)[0].split('\n')) {
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) { flush(); current = [bullet[1]]; continue; }
    if (current && /^\s+\S/.test(line)) { current.push(line.trim()); continue; }
    if (line.trim()) flush();
  }
  flush();
  // The template's own example is not a decision anyone owes.
  return out.filter((t) => !/^\*\*Example to replace/i.test(t));
}

/** Decisions marked `Revisit on YYYY-MM-DD`, with the heading they sit under. */
export function revisits(markdown) {
  const out = [];
  let heading = null;
  for (const line of markdown.split('\n')) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) { heading = h[1].trim(); continue; }
    for (const m of line.matchAll(/revisit on (\d{4}-\d{2}-\d{2})/gi)) out.push({ heading, due: m[1] });
  }
  return out;
}

/** Notes in source/inbox/notes/ nobody has filed, with the oldest date among them. */
export function inbox(central = CENTRAL) {
  const dir = join(central, 'source', 'inbox', 'notes');
  if (!existsSync(dir)) return { count: 0, oldest: null };
  const notes = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const dates = notes.map((f) => {
    const m = readFileSync(join(dir, f), 'utf8').match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
    return m ? m[1] : localToday(statSync(join(dir, f)).mtime);
  }).sort();
  return { count: notes.length, oldest: dates[0] ?? null };
}

export function collect({ central = CENTRAL, today = localToday() } = {}) {
  const folder = dirname(central);
  const decisions = [];
  const due = [];
  for (const file of decisionFiles(central)) {
    let text;
    try { text = readFileSync(file, 'utf8'); }
    catch (e) { console.error(`(open-decisions could not read ${file}: ${e.message})`); continue; }
    const where = relative(folder, file);
    for (const t of pending(text)) {
      const asked = t.match(/raised (\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;
      decisions.push({ where, text: t, asked, waited: asked ? daysSince(asked, today) : null });
    }
    for (const r of revisits(text)) {
      if (r.due <= today) due.push({ where, ...r, lateBy: daysSince(r.due, today) });
    }
  }
  decisions.sort((a, b) => (b.waited ?? Infinity) - (a.waited ?? Infinity));
  due.sort((a, b) => b.lateBy - a.lateBy);
  return { today, decisions, revisits: due, inbox: inbox(central), central: basename(central) };
}

export function report(r) {
  const lines = [];
  const clip = (t) => (t.length > 160 ? `${t.slice(0, 157)}…` : t);
  if (r.decisions.length) {
    lines.push(`${r.decisions.length} decision(s) under "To decide", waiting on a person, not on you:`);
    for (const d of r.decisions.slice(0, MAX)) {
      // A choice with no date is one nobody has to face, which is the shape the eight-day case had.
      const age = d.asked ? ` (waiting ${d.waited} day(s), since ${d.asked})` : ' (NO DATE: nobody has to face this one)';
      lines.push(`  · ${clip(d.text)}${age}\n    ${d.where}`);
    }
    if (r.decisions.length > MAX) lines.push(`  … and ${r.decisions.length - MAX} more (node ${r.central}/packs/company/scripts/open-decisions.mjs)`);
    lines.push('  Put them in front of the person who decides, in this session, with the options and what each costs.');
    lines.push('  Writing one down again is not raising it: it was already written down.', '');
  }
  if (r.revisits.length) {
    lines.push(`${r.revisits.length} decision(s) marked for a second look, and the day has come:`);
    for (const v of r.revisits.slice(0, MAX)) lines.push(`  · ${v.heading ?? '(no heading)'} (revisit on ${v.due})\n    ${v.where}`);
    if (r.revisits.length > MAX) lines.push(`  … and ${r.revisits.length - MAX} more`);
    lines.push('  Check whether what forced the choice still holds. A constraint that has lifted should');
    lines.push('  replay the choices it dictated, and nothing else will say so.', '');
  }
  if (r.inbox.count) {
    lines.push(`${r.inbox.count} note(s) from the intranet waiting in ${r.central}/source/inbox/notes/, the oldest from ${r.inbox.oldest}.`);
    lines.push(`  File them before the work you were asked for, unless it is urgent (${r.central}/source/inbox/README.md).`, '');
  }
  return lines.length ? `\n${lines.join('\n')}` : '';
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  let r = { today: localToday(), decisions: [], revisits: [], inbox: { count: 0, oldest: null }, central: basename(CENTRAL) };
  try { r = collect(); } catch (e) { console.error(`(open-decisions could not read the repos: ${e.message})`); }
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else { const text = report(r); if (text) console.log(text); }
  process.exit(0);
}
