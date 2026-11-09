// The intranet's visual pieces for an instance's own views: scores, bars, cards, people, tick boxes
// and a Gantt chart, rendered at build time as HTML and inline SVG, with no library.
//
// Each thing is a card, a score reads as a ring and a bar, and colour never carries the meaning
// alone: the word or the number is always written beside it. Their styles are in extension.css
// (classes prefixed `ui-`), tokens only. An extension reaches them as `intranet.ui` while it
// registers and `c.ui` in a render, or imports this file (source/formats/dashboard.md ▸ Adding your
// own views ▸ Components).
//
// Tick boxes write through the to-do app's Worker (apps/todos/worker.js) when the intranet's Worker
// runs it: a box names its source (TODO_SOURCES, todoSourceId) and its line's ^id, and the shell
// adds checkboxScript() to any page that has one. Without the API a box stays readable, disabled,
// with a line saying so.
//
// Words go through the chrome's strings (intranet.mjs ▸ STRINGS), so an instance translates them
// with intranet.strings() like the rest; months follow the intranet's locale.
//
// ux-pass: 2026-11-09 Goal-gradient (rings and x/y bars on every score), Von Restorff (one tone per
// state, late reserved for what blocks), Doherty (tick boxes say saving, saved, failed or read-only
// at once), Fitts (the whole line is the box's label), Aesthetic-usability (a box without the API is
// disabled with a sentence, never a dead click).

import { esc } from '../../scripts/doc/markdown.mjs';
import { t, locale } from './intranet.mjs';

/** The tones a piece may take: done or fine, waiting, late or blocking, informative, none. */
export const TONES = ['ok', 'warn', 'late', 'info', 'none'];
const tone = (x, fallback = 'none') => (TONES.includes(x) ? x : fallback);

/** a out of b, as a whole percentage; 0 when there is nothing to count. */
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/**
 * The to-do source id of a file in this repository, as the intranet Worker's TODO_SOURCES names it
 * (scripts/todo-sources.mjs --intranet writes the same): projects/rota/next-steps.md becomes
 * projects-rota-next-steps.
 */
export const todoSourceId = (rel) => String(rel).replace(/\.md$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

/** A progress ring: the percentage in the middle, clamped to 0..100, `sub` under it ("3/7"). */
export function ring(p, { size = 64, sub = '', tone: tn = 'ok' } = {}) {
  const r = 15.9155; // a circumference of 100, so the dash is the percentage
  const v = Math.max(0, Math.min(100, Math.round(Number(p) || 0)));
  const aria = `${v}% ${t('ui.done')}${sub ? `, ${sub}` : ''}`;
  return `<span class="ui-ring" style="--ring:${Number(size) || 64}px" role="img" aria-label="${esc(aria)}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="ui-ring-track" cx="18" cy="18" r="${r}"/>${v ? `<circle class="ui-ring-val ui-t-${tone(tn, 'ok')}" cx="18" cy="18" r="${r}" stroke-dasharray="${v} ${100 - v}" stroke-dashoffset="25"/>` : ''}</svg><span class="ui-ring-txt"><b>${v}%</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></span>`;
}

/** One bar split by status, [{ n, label, tone }]: each part named and counted in the legend. */
export function stackedBar(segments, { legend = true } = {}) {
  const parts = (segments || []).filter((x) => x && x.n > 0);
  const total = parts.reduce((s, x) => s + x.n, 0);
  if (!total) return '';
  const segs = parts.map((x) => `<span class="ui-seg ui-bg-${tone(x.tone)}" style="width:${((x.n / total) * 100).toFixed(2)}%" title="${x.n} ${esc(x.label)}"></span>`).join('');
  const aria = parts.map((x) => `${x.n} ${x.label}`).join(', ');
  return `<div class="ui-sbar"><div class="ui-sbar-track" role="img" aria-label="${esc(aria)}">${segs}</div>${legend ? `<ul class="ui-legend">${parts.map((x) => `<li><i class="ui-bg-${tone(x.tone)}" aria-hidden="true"></i><b>${x.n}</b> ${esc(x.label)}</li>`).join('')}</ul>` : ''}</div>`;
}

/** A thin gauge for one line: done out of total. Inside a [data-group], ticking a box moves it. */
export const gauge = (done, total, { tone: tn = 'ok' } = {}) =>
  `<span class="ui-gauge" role="img" aria-label="${esc(t('ui.of', done, total))}"><i class="ui-bg-${tone(tn, 'ok')}" data-bar style="width:${pct(done, total)}%"></i></span>`;

/** A key-figure card: a visual (a ring, or a figure in <b class="ui-big">), what it counts, a line under it. */
export function kpi({ visual = '', label, line = '', href = '', tone: tn = '' }) {
  const cls = `card ui-kpi${tn ? ` ui-edge-${tone(tn)}` : ''}`;
  const inner = `<div class="ui-kpi-v">${visual}</div><div class="ui-kpi-t"><b>${esc(label)}</b>${line ? `<small>${line}</small>` : ''}</div>`;
  return href ? `<a class="${cls}" href="${esc(href)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
}

/** A person's initials on a round badge, the full name for screen readers and on hover. */
export function initials(name) {
  const n = String(name || '?');
  const ini = n.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  return `<span class="ui-av" title="${esc(n)}" role="img" aria-label="${esc(n)}">${esc(ini)}</span>`;
}

/** A state as a coloured chip, the word always written. */
export const statusChip = (word, tn = 'none') => `<span class="ui-chip ui-chip-${tone(tn)}">${esc(word)}</span>`;

/**
 * A tick box for one line of a to-do file: `sourceId` is the file's id in TODO_SOURCES, `item.id`
 * the line's ^id. Without either, the line renders read-only: a drawn box, nothing to click.
 * `text` replaces the item's text, `extra` is HTML after it (a date, initials).
 */
export function checkbox(item, sourceId, { text = item.text, extra = '' } = {}) {
  const done = Boolean(item.done);
  const cls = `ui-check${done ? ' is-done' : ''}`;
  const words = `<span class="ui-check-t">${esc(text)}</span>${extra}`;
  if (!item.id || !sourceId) return `<div class="${cls} is-static"><span class="ui-box" aria-hidden="true">${done ? '✓' : ''}</span>${words}</div>`;
  return `<label class="${cls}"><input type="checkbox" data-todo-source="${esc(sourceId)}" data-todo-id="${esc(item.id)}"${done ? ' checked' : ''}>${words}</label>`;
}

/**
 * The tick boxes' script, which the shell adds to any page holding one. On load, the live state of
 * each source (GET /api/todos?source=) replaces the built one; a tick sends a toggle intent and the
 * Worker commits the line. `[data-group]` blocks recount their `[data-count]` and `[data-bar]`. A
 * line says what is happening: saving, saved, failed (the box goes back), or read-only when the API
 * does not answer (every box disabled).
 */
export function checkboxScript() {
  const words = { offline: t('checks.offline'), saving: t('checks.saving'), saved: t('checks.saved'), failed: t('checks.failed') };
  const w = JSON.stringify(words).replace(/</g, '\\u003c');
  return `<script>
(() => {
  const W = ${w};
  const boxes = [...document.querySelectorAll('input[data-todo-source][data-todo-id]')];
  if (!boxes.length) return;
  const note = document.createElement('p');
  note.className = 'ui-sync'; note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
  (document.querySelector('main') || document.body).prepend(note);
  let timer;
  const say = (text, cls) => { clearTimeout(timer); note.textContent = text; note.className = 'ui-sync' + (cls ? ' ' + cls : ''); };
  const recount = () => document.querySelectorAll('[data-group]').forEach((g) => {
    const all = g.querySelectorAll('input[data-todo-source]'), done = [...all].filter((b) => b.checked).length;
    g.querySelectorAll('[data-count]').forEach((c) => { c.textContent = done + '/' + all.length; });
    g.querySelectorAll('[data-bar]').forEach((b) => { b.style.width = (all.length ? Math.round(done / all.length * 100) : 0) + '%'; });
  });
  const mark = (b) => b.closest('.ui-check')?.classList.toggle('is-done', b.checked);
  const sources = [...new Set(boxes.map((b) => b.dataset.todoSource))];
  Promise.all(sources.map((s) => fetch('/api/todos?source=' + encodeURIComponent(s), { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))))
    .then((lists) => {
      const state = new Map();
      lists.forEach((l) => (l.items || []).forEach((i) => state.set(l.source + '/' + i.id, i.done)));
      boxes.forEach((b) => { const v = state.get(b.dataset.todoSource + '/' + b.dataset.todoId); if (v !== undefined) { b.checked = v; mark(b); } });
      recount();
    })
    .catch(() => { boxes.forEach((b) => { b.disabled = true; }); say(W.offline, 'is-off'); });
  boxes.forEach((b) => b.addEventListener('change', async () => {
    mark(b); recount(); say(W.saving);
    try {
      const r = await fetch('/api/todos', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: b.dataset.todoSource, intents: [{ op: 'toggle', id: b.dataset.todoId, done: b.checked }] }),
      });
      if (!r.ok) throw new Error(String(r.status));
      say(W.saved, 'is-ok'); timer = setTimeout(() => say(''), 2500);
    } catch { b.checked = !b.checked; mark(b); recount(); say(W.failed, 'is-err'); }
  }));
})();
</script>`;
}

// ---------------------------------------------------------------- dates and the Gantt chart

const DAY = 864e5;
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const msOf = (iso) => Date.parse(`${iso}T00:00:00Z`);
const mondayOf = (ms) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY;

/**
 * The days a due date covers, as [first, last] in YYYY-MM-DD: a day (2026-11-09), an ISO week
 * (2026-W46), a month (2026-11), a year (2026) or a range (2026-11-02..2026-11-20). null otherwise.
 */
export function span(due) {
  const q = String(due ?? '').trim();
  let m = q.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
  if (m) return m[1] <= m[2] ? [m[1], m[2]] : [m[2], m[1]];
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return [q, q];
  m = q.match(/^(\d{4})-W(\d{2})$/);
  if (m) {
    const jan4 = Date.UTC(Number(m[1]), 0, 4);
    const monday = mondayOf(jan4) + (Number(m[2]) - 1) * 7 * DAY;
    return [isoOf(monday), isoOf(monday + 6 * DAY)];
  }
  m = q.match(/^(\d{4})-(\d{2})$/);
  if (m) return [`${m[1]}-${m[2]}-01`, isoOf(Date.UTC(Number(m[1]), Number(m[2]), 0))];
  m = q.match(/^(\d{4})$/);
  if (m) return [`${m[1]}-01-01`, `${m[1]}-12-31`];
  return null;
}

/** The kinds a Gantt bar takes, each with its legend word (gantt.<kind>). */
export const GANTT_KINDS = ['event', 'milestone', 'action', 'done', 'late'];

/**
 * A Gantt chart by weeks. `items` are { text, start, end } (or { due }, read by span()), with
 * optional `group` (the row they sit on: a project, a person; items with none go on a first
 * "Calendar" row), `kind` (GANTT_KINDS), `sub`, `href`, `done`.
 *
 * One row per group, its label in a column that stays visible while the weeks scroll sideways;
 * weekly columns with the months named, this week highlighted, a line at today across every row.
 * Each item is a bar from its start week to its end week, a one-day item a short marker; the items
 * of one group stack on sub-lanes so no two bars overlap. Past or done items are faded.
 *
 * `compact: true` is for a card at the top of a section: lower rows, one-line labels (the full text
 * on hover), narrower weeks and labels, no legend. `weeks: n` shows last week and the n coming ones;
 * without it the chart spans the items, from a month back at most, up to `max` weeks. Returns ''
 * when no item falls in view.
 */
export function gantt(items, { today = isoOf(Date.now()), compact = false, weeks = null, max = 16, legend = !compact } = {}) {
  const all = (items || []).map((i) => {
    let { start, end } = i;
    if (!start && i.due) [start, end] = span(i.due) || [];
    if (!start || !span(start)) return null;
    end = end && span(end) ? end : start;
    if (end < start) [start, end] = [end, start];
    return { ...i, start, end };
  }).filter(Boolean);
  if (!all.length) return '';

  const now = msOf(today);
  let t0, n;
  if (weeks) {
    t0 = mondayOf(now) - 7 * DAY;
    n = Math.max(1, Math.round(weeks)) + 1;
  } else {
    const first = Math.min(...all.map((i) => msOf(i.start)));
    t0 = mondayOf(Math.min(now - 7 * DAY, Math.max(first, now - 28 * DAY)));
    const last = Math.max(now + 21 * DAY, ...all.map((i) => msOf(i.end)));
    n = Math.max(1, Math.min(max, Math.ceil((last - t0 + DAY) / (7 * DAY))));
  }
  const tEnd = t0 + n * 7 * DAY - DAY;
  const shown = all.filter((i) => msOf(i.end) >= t0 && msOf(i.start) <= tEnd);
  if (!shown.length) return '';
  const col = (iso) => Math.max(0, Math.min(n - 1, Math.floor((msOf(iso) - t0) / (7 * DAY))));

  // Groups in the order they first appear, the ungrouped calendar first; greedy lanes within each.
  const names = [];
  for (const i of shown) { const g = i.group || ''; if (!names.includes(g)) names.push(g); }
  names.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0));
  let row = 2;
  const groups = names.map((name) => {
    const lanes = [];
    const bars = shown.filter((i) => (i.group || '') === name)
      .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
      .map((i) => {
        const a = col(i.start), b = Math.max(a, col(i.end));
        let l = lanes.findIndex((taken) => taken.every((k) => k < a || k > b));
        if (l < 0) { lanes.push([]); l = lanes.length - 1; }
        for (let k = a; k <= b; k++) lanes[l].push(k);
        return { ...i, a, b, l };
      });
    const g = { name, label: name || t('gantt.events'), row, lanes: lanes.length, bars };
    row += lanes.length;
    return g;
  });
  const lastRow = row; // the line after the last lane

  const here = col(today);
  const nowIn = now >= t0 && now <= tEnd;
  const month = (ms) => new Date(ms).toLocaleDateString(locale(), { month: 'short', timeZone: 'UTC' });
  const head = `<div class="ui-gantt-corner" style="grid-column:1;grid-row:1"></div>${Array.from({ length: n }, (_, k) => {
    const d = new Date(t0 + k * 7 * DAY);
    const m = k === 0 || d.getUTCDate() <= 7 ? `<b>${esc(month(d.getTime()))}</b>` : '';
    const isNow = nowIn && k === here;
    return `<div class="ui-gantt-h${isNow ? ' is-now' : ''}" style="grid-column:${k + 2};grid-row:1">${m}<span>${d.getUTCDate()}</span>${isNow ? `<em>${esc(t('gantt.thisWeek'))}</em>` : ''}</div>`;
  }).join('')}`;
  const week = nowIn ? `<span class="ui-gantt-week" style="grid-column:${here + 2};grid-row:1 / ${lastRow}" aria-hidden="true"></span>` : '';
  const labels = groups.map((g) => `<div class="ui-gantt-label" style="grid-column:1;grid-row:${g.row} / span ${g.lanes}" title="${esc(g.label)}">${esc(g.label)}</div>`).join('');
  const lines = groups.slice(1).map((g) => `<span class="ui-gantt-rule" style="grid-column:1 / ${n + 2};grid-row:${g.row}" aria-hidden="true"></span>`).join('');
  const bars = groups.flatMap((g) => g.bars.map((i) => {
    const kind = GANTT_KINDS.includes(i.kind) ? i.kind : 'action';
    const past = i.done || i.end < today;
    const point = i.start === i.end;
    const tip = [i.text, i.sub, i.start === i.end ? i.start : `${i.start} → ${i.end}`].filter(Boolean).join(' · ');
    const tag = i.href ? `a href="${esc(i.href)}"` : 'div';
    const cls = `ui-gantt-i ui-gantt-${kind}${past ? ' is-past' : ''}${point ? ' is-point' : ''}`;
    return `<${tag} class="${cls}" style="grid-column:${i.a + 2} / ${i.b + 3};grid-row:${g.row + i.l}" title="${esc(tip)}"><b>${esc(i.text)}</b>${i.sub && !compact ? `<small>${esc(i.sub)}</small>` : ''}</${i.href ? 'a' : 'div'}>`;
  })).join('');
  const at = nowIn ? (((now - (t0 + here * 7 * DAY)) / DAY + 0.5) / 7) * 100 : null;
  const line = nowIn ? `<span class="ui-gantt-now" style="grid-column:${here + 2};grid-row:2 / ${lastRow};--at:${at.toFixed(2)}%" title="${esc(t('gantt.today'))}" aria-hidden="true"></span>` : '';
  const kinds = GANTT_KINDS.filter((k) => shown.some((i) => (GANTT_KINDS.includes(i.kind) ? i.kind : 'action') === k));
  const key = legend ? `<ul class="ui-legend ui-gantt-legend">${kinds.map((k) => `<li><i class="ui-gantt-sw ui-gantt-${k}" aria-hidden="true"></i>${esc(t(`gantt.${k}`))}</li>`).join('')}</ul>` : '';
  return `<div class="ui-gantt-wrap${compact ? ' is-compact' : ''}" role="region" aria-label="${esc(t('gantt.label'))}" tabindex="0"><div class="ui-gantt" style="--n:${n};--rows:${lastRow - 1}">${week}${head}${lines}${labels}${bars}${line}</div></div>${key}`;
}
