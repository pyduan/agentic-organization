// Canonical to-do parsing and patching. See source/formats/todo.md.
//
// The contract that matters: this module NEVER regenerates a file. It reads
// lines, and it rewrites individual lines in place. Everything a caller can do
// here is expressible as "replace line N with this string" or "move these
// lines", so a file edited by hand or by an agent survives a write untouched
// outside the one line that changed.

const ITEM = /^(\s*)([-*])\s+\[([ xX])\]\s+(.*\S)\s*$/;

// A continuation line that opens with an ISO date is an update, not context.
// The distinction matters: context describes the task and is rewritten freely,
// an update is something that happened and is append-only. Anything without a
// leading date stays context, so every file written before this still parses.
const COMMENT = /^\s+(\d{4}-\d{2}-\d{2})(?:\s+@([a-z0-9][a-z0-9._-]*))?\s+·\s+(.*\S)\s*$/i;

const FIELDS = [
  ['owners', /(?:^|\s)@([a-z0-9][a-z0-9._-]*)/gi],
  // A due date carries its own precision: a day, an ISO week, or a month. The
  // shorter forms are how "sometime next month" is recorded without pretending
  // to a day nobody chose. Still one field, still sorts lexically.
  ['due', /(?:^|\s)due:(\d{4}(?:-W\d{2}|-\d{2}(?:-\d{2})?)?)(?=\s|$)/i],
  ['done', /(?:^|\s)done:(\d{4}-\d{2}-\d{2})(?=\s|$)/i],
  ['tags', /(?:^|\s)#([a-z0-9][a-z0-9._-]*)/gi],
  ['id', /(?:^|\s)\^([a-z0-9]{4,8})\s*$/i],
];

/** The last day covered by a due value, whatever its precision. */
export function dueEnd(due) {
  if (!due) return null;
  const week = due.match(/^(\d{4})-W(\d{2})$/);
  if (week) {
    // ISO week: Monday of week 1 is the Monday on or before 4 January.
    const jan4 = new Date(Date.UTC(Number(week[1]), 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (Number(week[2]) - 1) * 7);
    monday.setUTCDate(monday.getUTCDate() + 6);
    return monday.toISOString().slice(0, 10);
  }
  const [y, m, d] = due.split('-').map(Number);
  if (d) return due;
  if (m) return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return `${y}-12-31`;
}

/** Late only once the whole period has passed. "This month" is not late on the 2nd. */
export function isOverdue(due, today) {
  const end = dueEnd(due);
  return Boolean(end) && end < today;
}

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no l/i/o/0/1

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Deterministic id from a seed string; used so tests and agents can reproduce one. */
export function idFrom(seed, length = 4) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ID_ALPHABET[h % ID_ALPHABET.length];
    h = Math.floor(h / ID_ALPHABET.length) + i * 7919;
  }
  return out;
}

/** Parse one line. Returns null when the line is not a to-do item. */
export function parseLine(line, lineNo = 0) {
  const m = line.match(ITEM);
  if (!m) return null;
  const [, indent, bullet, box, rest] = m;

  const item = {
    lineNo,
    indent,
    bullet,
    done: box.toLowerCase() === 'x',
    owners: [],
    tags: [],
    due: null,
    doneOn: null,
    id: null,
    text: rest,
    raw: line,
  };

  let text = rest;
  for (const [key, re] of FIELDS) {
    if (re.global) {
      const found = [...text.matchAll(re)].map((x) => x[1]);
      if (found.length) {
        item[key] = found;
        text = text.replace(re, '');
      }
    } else {
      const found = text.match(re);
      if (found) {
        if (key === 'done') item.doneOn = found[1];
        else item[key] = found[1];
        text = text.replace(re, '');
      }
    }
  }
  item.text = text.replace(/\s+/g, ' ').trim();
  return item;
}

/** Parse a whole file. Continuation lines (indented, no bullet) attach as notes. */
export function parse(markdown) {
  const lines = markdown.split('\n');
  const items = [];
  let last = null;
  lines.forEach((line, i) => {
    const item = parseLine(line, i);
    if (item) {
      item.notes = [];
      item.comments = [];
      items.push(item);
      last = item;
      return;
    }
    if (last && /^\s+\S/.test(line) && !ITEM.test(line)) {
      const c = line.match(COMMENT);
      if (c) last.comments.push({ on: c[1], by: c[2] || null, text: c[3] });
      else last.notes.push(line.trim());
      return;
    }
    if (line.trim() === '') return; // a blank line does not close an item
    last = null;
  });
  return items;
}

/** Rebuild a single line from an item, in canonical field order. */
export function formatLine(item) {
  const parts = [item.text];
  for (const o of item.owners) parts.push(`@${o}`);
  if (item.due) parts.push(`due:${item.due}`);
  if (item.doneOn) parts.push(`done:${item.doneOn}`);
  for (const t of item.tags) parts.push(`#${t}`);
  if (item.id) parts.push(`^${item.id}`);
  return `${item.indent}${item.bullet} [${item.done ? 'x' : ' '}] ${parts.join(' ')}`;
}

function findById(lines, id) {
  for (let i = 0; i < lines.length; i++) {
    const item = parseLine(lines[i], i);
    if (item && item.id === id) return item;
  }
  return null;
}

/**
 * Apply one intent to a markdown string. Returns { markdown, changed }.
 * Intents are semantic ("set done on ^k3f9"), never positional, so a caller can
 * re-apply the same intent to a newer version of the file after a 409.
 */
export function apply(markdown, intent) {
  const lines = markdown.split('\n');

  if (intent.op === 'reorder') return reorder(markdown, intent.ids);

  const item = findById(lines, intent.id);
  if (!item) return { markdown, changed: false, reason: `no item ^${intent.id}` };

  switch (intent.op) {
    case 'toggle':
      item.done = intent.done ?? !item.done;
      item.doneOn = item.done ? (intent.on ?? item.doneOn) : null;
      break;
    case 'comment': {
      // The only operation that adds a line rather than rewriting one. It goes at
      // the end of the item's own block, so an update never displaces the context
      // that was already there and never lands under the following item.
      if (!intent.text || !intent.text.trim()) return { markdown, changed: false, reason: 'empty comment' };
      let end = item.lineNo;
      for (let i = item.lineNo + 1; i < lines.length; i++) {
        if (/^\s+\S/.test(lines[i]) && !parseLine(lines[i], i)) end = i;
        else break;
      }
      const who = intent.by ? ` @${intent.by}` : '';
      const text = intent.text.replace(/\s+/g, ' ').trim();
      lines.splice(end + 1, 0, `${item.indent}      ${intent.on || todayISO()}${who} · ${text}`);
      return { markdown: lines.join('\n'), changed: true };
    }

    case 'set':
      if ('due' in intent) item.due = intent.due || null;
      if ('text' in intent) item.text = intent.text;
      if ('owners' in intent) item.owners = intent.owners;
      if ('tags' in intent) item.tags = intent.tags;
      break;
    default:
      return { markdown, changed: false, reason: `unknown op ${intent.op}` };
  }

  const next = formatLine(item);
  if (next === lines[item.lineNo]) return { markdown, changed: false };
  lines[item.lineNo] = next;
  return { markdown: lines.join('\n'), changed: true };
}

/**
 * Reorder top-level items to match `ids`. Each item carries its continuation
 * lines with it. Only lines inside the affected span move, and the span must be
 * a contiguous run of items: anything else in the middle (a heading, a
 * paragraph, a blank line) makes this refuse rather than rewrite it.
 */
/**
 * The server's gate on a batch of intents, before any of them touches a file.
 *
 * The UI only ever sends well-formed intents, so anything else is not the UI —
 * and the answer to "not the UI" is to refuse the whole batch, never to salvage
 * the plausible half of it. Lifted from a live project's Worker, where the batch
 * cap and the id shape stopped being implicit the day someone asked what the
 * endpoint would do with ten thousand intents.
 *
 * Returns a rebuilt batch carrying only the known fields, so a stray key can
 * never ride an intent into a file — or null when anything in the batch is off.
 */
const INTENT_ID = /^[a-z0-9]{1,8}$/;
const INTENT_DAY = /^\d{4}-\d{2}-\d{2}$/;
const INTENT_DUE = /^\d{4}(?:-W\d{2}|-\d{2}(?:-\d{2})?)?$/;
const INTENT_WORD = /^[\w-]{1,40}$/;
const cleanText = (t, max) => {
  if (typeof t !== 'string') return null;
  const out = t.replace(/\s+/g, ' ').trim();
  return out && out.length <= max ? out : null;
};

export function sanitizeIntents(raw, { maxIntents = 20, maxText = 2000 } = {}) {
  if (!Array.isArray(raw) || !raw.length || raw.length > maxIntents) return null;
  const out = [];
  for (const i of raw) {
    if (!i || typeof i !== 'object') return null;

    if (i.op === 'reorder') {
      if (!Array.isArray(i.ids) || !i.ids.length || i.ids.length > 500) return null;
      if (!i.ids.every((id) => typeof id === 'string' && INTENT_ID.test(id))) return null;
      out.push({ op: 'reorder', ids: i.ids.slice() });
      continue;
    }

    if (typeof i.id !== 'string' || !INTENT_ID.test(i.id)) return null;
    if (i.on != null && (typeof i.on !== 'string' || !INTENT_DAY.test(i.on))) return null;

    if (i.op === 'toggle') {
      out.push({ op: 'toggle', id: i.id, ...(typeof i.done === 'boolean' ? { done: i.done } : {}), ...(i.on ? { on: i.on } : {}) });
    } else if (i.op === 'comment') {
      const text = cleanText(i.text, maxText);
      if (!text) return null;
      out.push({ op: 'comment', id: i.id, text, ...(i.on ? { on: i.on } : {}) });
    } else if (i.op === 'set') {
      const next = { op: 'set', id: i.id };
      let touched = false;
      if ('due' in i) {
        if (i.due != null && (typeof i.due !== 'string' || !INTENT_DUE.test(i.due))) return null;
        next.due = i.due || null; touched = true;
      }
      if ('text' in i) {
        const text = cleanText(i.text, maxText);
        if (!text) return null;
        next.text = text; touched = true;
      }
      for (const key of ['owners', 'tags']) {
        if (!(key in i)) continue;
        if (!Array.isArray(i[key]) || i[key].length > 20 || !i[key].every((w) => typeof w === 'string' && INTENT_WORD.test(w))) return null;
        next[key] = i[key].slice(); touched = true;
      }
      if (!touched) return null;
      out.push(next);
    } else {
      return null;
    }
  }
  return out;
}

export function reorder(markdown, ids) {
  const lines = markdown.split('\n');
  const blocks = [];
  let current = null;

  lines.forEach((line, i) => {
    const item = parseLine(line, i);
    if (item && item.indent === '') {
      current = { id: item.id, start: i, end: i };
      blocks.push(current);
      return;
    }
    if (current && (/^\s+\S/.test(line) || line.trim() === '')) {
      current.end = line.trim() === '' ? current.end : i;
      return;
    }
    current = null;
  });

  const movable = blocks.filter((b) => b.id && ids.includes(b.id));
  if (movable.length < 2) return { markdown, changed: false, reason: 'nothing to reorder' };

  // Every line between the first and last moved item must belong to one of them.
  // A heading, a paragraph or even a blank line in the middle means this is not a
  // single run, and moving lines across it would rewrite something we were not asked
  // to touch. Refuse rather than guess.
  const span = { start: movable[0].start, end: movable[movable.length - 1].end };
  const covered = new Set();
  for (const b of movable) for (let i = b.start; i <= b.end; i++) covered.add(i);
  for (let i = span.start; i <= span.end; i++) {
    if (!covered.has(i)) return { markdown, changed: false, reason: 'the items are not a contiguous run' };
  }

  const byId = new Map(movable.map((b) => [b.id, lines.slice(b.start, b.end + 1)]));
  const ordered = ids.filter((id) => byId.has(id)).flatMap((id) => byId.get(id));
  const next = [...lines.slice(0, span.start), ...ordered, ...lines.slice(span.end + 1)];
  const markdownNext = next.join('\n');
  return { markdown: markdownNext, changed: markdownNext !== markdown };
}

/** Give every item without one a stable id, derived from its text. Returns { markdown, added }. */
export function ensureIds(markdown) {
  const lines = markdown.split('\n');
  const taken = new Set(parse(markdown).map((i) => i.id).filter(Boolean));
  let added = 0;

  lines.forEach((line, i) => {
    const item = parseLine(line, i);
    if (!item || item.id) return;
    let id = idFrom(item.text);
    let n = 0;
    while (taken.has(id)) id = idFrom(`${item.text}#${++n}`);
    taken.add(id);
    item.id = id;
    lines[i] = formatLine(item);
    added++;
  });

  return { markdown: lines.join('\n'), added };
}
