#!/usr/bin/env node
// The nonprofit pack's checks and generated views.
//
//   node packs/nonprofit/scripts/nonprofit.mjs check      funders, events and story bank against their formats; exit 1 on a failure
//   node packs/nonprofit/scripts/nonprofit.mjs pipeline   every funder by next deadline, with stage, owner and next action
//   node packs/nonprofit/scripts/nonprofit.mjs calendar [--days 60]   events, calls for speakers and editorial rows, dated
//
// The pipeline and the calendar are printed from the files every time, never kept as a table by
// hand: a view someone maintains drifts from its rows, and a missing row looks like nothing at all.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(PACK, '..', '..');
const settings = JSON.parse(await readFile(join(PACK, existsSync(join(PACK, 'settings.json')) ? 'settings.json' : 'settings.example.json'), 'utf8'));
const [cmd = 'check', ...rest] = process.argv.slice(2);
const days = rest.includes('--days') ? Number(rest[rest.indexOf('--days') + 1]) : 60;

const FUNDER_STAGES = ['prospect', 'applying', 'active', 'renewal', 'closed', 'declined'];
const FUNDER_KINDS = ['funder', 'donor', 'prospect'];
const EVENT_STAGES = ['watching', 'evaluating', 'pitched', 'confirmed', 'declined', 'done', 'dropped'];
const PRESENCE = ['speaking', 'attending', 'none'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const findings = [];
const add = (severity, file, detail) => findings.push({ severity, file: relative(ROOT, file), detail });

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*?)\s*(#.*)?$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return fm;
}
function section(text, title) {
  const m = text.match(new RegExp(`^##\\s+${title}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'm'));
  return m ? m[1] : '';
}
function tableRows(block) {
  return block.split('\n').filter((l) => /^\s*\|/.test(l) && !/^\s*\|\s*-/.test(l)).slice(1)
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
}
async function mdFiles(dir) {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith('.md') && !/^(README|TALKING-POINTS)\.md$/.test(f) && !f.startsWith('_')).map((f) => join(dir, f));
}

async function funders() {
  const out = [];
  for (const file of await mdFiles(join(ROOT, settings.fundersPath))) {
    const text = await readFile(file, 'utf8');
    const fm = frontmatter(text);
    if (!fm) { add('warn', file, 'no frontmatter: not read as a funder file (formats/funder.md)'); continue; }
    if (!FUNDER_KINDS.includes(fm.kind)) add('fail', file, `kind "${fm.kind || ''}" is not one of ${FUNDER_KINDS.join(', ')}`);
    if (!FUNDER_STAGES.includes(fm.stage)) add('fail', file, `stage "${fm.stage || ''}" is not one of ${FUNDER_STAGES.join(', ')}`);
    if (fm.next_deadline && !ISO.test(fm.next_deadline)) add('fail', file, `next_deadline "${fm.next_deadline}" is not YYYY-MM-DD`);
    if (!fm.owner) add('warn', file, 'no owner: nobody holds this relationship');
    rows: for (const r of tableRows(section(text, 'Figures we sent them'))) {
      if (r.every((c) => !c)) continue rows;
      if (r.length < 4 || r.slice(0, 4).some((c) => !c)) add('fail', file, `a sent figure is missing a column (date, figure as sent, in what, source): | ${r.join(' | ')} |`);
      else if (!ISO.test(r[0])) add('fail', file, `a sent figure's date "${r[0]}" is not YYYY-MM-DD`);
    }
    out.push({ file, ...fm });
  }
  return out;
}

async function events() {
  const out = [];
  for (const file of await mdFiles(join(ROOT, settings.eventsPath))) {
    const text = await readFile(file, 'utf8');
    const fm = frontmatter(text);
    if (!fm) { add('warn', file, 'no frontmatter: not read as an event (formats/event.md)'); continue; }
    const name = basename(file, '.md');
    const dated = name.match(/^(\d{4}-\d{2}-\d{2})-/);
    if (dated && fm.start !== dated[1]) add('fail', file, `the name says ${dated[1]}, start says "${fm.start || ''}"`);
    if (!dated && !name.startsWith('undated-')) add('fail', file, 'named neither YYYY-MM-DD-slug.md nor undated-slug.md');
    if (name.startsWith('undated-') && fm.start) add('fail', file, `undated- file with a start (${fm.start}): rename it`);
    if (!EVENT_STAGES.includes(fm.stage)) add('fail', file, `stage "${fm.stage || ''}" is not one of ${EVENT_STAGES.join(', ')}`);
    if (fm.presence && !PRESENCE.includes(fm.presence)) add('fail', file, `presence "${fm.presence}" is not one of ${PRESENCE.join(', ')}`);
    for (const k of ['next_action_due', 'cfp_deadline', 'end']) if (fm[k] && !ISO.test(fm[k])) add('fail', file, `${k} "${fm[k]}" is not YYYY-MM-DD`);
    out.push({ file, ...fm });
  }
  return out;
}

async function storyBank() {
  const file = join(ROOT, settings.storyBankPath);
  if (!existsSync(file)) return;
  const text = await readFile(file, 'utf8');
  for (const entry of text.split(/^##\s+/m).slice(1)) {
    const title = entry.split('\n')[0].trim();
    if (/^(rules|how|format)/i.test(title)) continue;
    if (!/\*\*The fact behind it\*\*/.test(entry)) add('fail', file, `"${title}" has no "The fact behind it": a line never travels without its fact`);
    if (!/\*\*Source\*\*/.test(entry)) add('fail', file, `"${title}" has no "Source"`);
    if (!/\*\*Status\*\*/.test(entry)) add('warn', file, `"${title}" has no "Status": proposed or validated, by whom`);
  }
}

async function editorial() {
  const file = join(ROOT, settings.editorialCalendarPath);
  if (!existsSync(file)) return [];
  const rows = tableRows((await readFile(file, 'utf8')).split('<!-- data:editorial -->')[1] || '');
  return rows.filter((r) => ISO.test(r[0])).map(([date, channel, piece, pillar, owner, status, source]) => ({ date, channel, piece, owner, status, source }));
}

const today = new Date().toISOString().slice(0, 10);

if (cmd === 'check') {
  const f = await funders(); const e = await events(); await storyBank();
  for (const x of findings) console.log(`  ${x.severity === 'fail' ? '✗' : '▲'} ${x.file}\n      ${x.detail}`);
  const fails = findings.filter((x) => x.severity === 'fail').length;
  console.log(`\n${fails ? '✗' : '✓'} ${f.length} funder file(s), ${e.length} event file(s); ${fails} failure(s), ${findings.length - fails} warning(s)`);
  process.exitCode = fails ? 1 : 0;
} else if (cmd === 'pipeline') {
  const f = (await funders()).filter((x) => !['closed', 'declined'].includes(x.stage));
  f.sort((a, b) => (a.next_deadline || '9999').localeCompare(b.next_deadline || '9999'));
  if (!f.length) console.log(`No open funder files in ${settings.fundersPath} (formats/funder.md).`);
  for (const x of f) {
    const late = x.next_deadline && x.next_deadline < today ? '  PAST' : '';
    console.log(`${(x.next_deadline || 'no date').padEnd(11)} ${(x.name || basename(x.file)).padEnd(34)} ${(x.stage || '').padEnd(9)} ${(x.owner || 'no owner').padEnd(10)} ${x.next_action || ''}${late}`);
  }
} else if (cmd === 'calendar') {
  const until = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  const items = [];
  for (const x of await events()) {
    if (x.start && x.start >= today && x.start <= until) items.push([x.start, 'event', `${x.name} (${x.stage}${x.presence && x.presence !== 'none' ? `, ${x.presence}` : ''})`]);
    if (x.cfp_deadline && x.cfp_deadline >= today && x.cfp_deadline <= until) items.push([x.cfp_deadline, 'call for speakers', x.name]);
    if (x.next_action_due && x.next_action_due <= until && !['done', 'dropped', 'declined'].includes(x.stage)) items.push([x.next_action_due, 'action', `${x.name}: ${x.next_action || ''} (${x.owner || 'no owner'})`]);
  }
  for (const r of await editorial()) if (r.date >= today && r.date <= until) items.push([r.date, r.channel, `${r.piece} (${r.status}, ${r.owner})`]);
  items.sort((a, b) => a[0].localeCompare(b[0]));
  if (!items.length) console.log(`Nothing dated between ${today} and ${until}.`);
  for (const [d, kind, what] of items) console.log(`${d}${d < today ? ' PAST' : ''}  ${kind.padEnd(18)} ${what}`);
} else {
  console.error('Usage: nonprofit.mjs check | pipeline | calendar [--days N]');
  process.exitCode = 2;
}
