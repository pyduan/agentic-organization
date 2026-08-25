// Everything a to-do interface needs that is not rendering.
//
// There are two front ends over this API — the kit's Astro app, and hand-written
// static pages in projects that have no build step — and the parts that are easy
// to get subtly wrong are the same in both: which ISO week today falls in, how a
// vague due date reads, how edits are batched into one commit. So they live here,
// framework-agnostic and tested, and each front end is left with markup.
//
// The parsing half is lib/todo.mjs. This is the half that runs in a browser.

export { dueEnd, isOverdue } from './todo.mjs';

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => d.toISOString().slice(0, 10);

/** ISO week of a date: the year of its Thursday, and the week number. */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${pad(Math.ceil(((d - jan1) / 86400000 + 1) / 7))}`;
}

const shift = (days, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * What the due control offers. `value(now)` takes a date so the presets are
 * testable and so a page left open overnight does not compute yesterday.
 */
export const DUE_PRESETS = [
  { key: '', label: 'No date', value: () => null },
  { key: 'today', label: 'Today', value: (now = new Date()) => isoDay(now) },
  { key: 'tomorrow', label: 'Tomorrow', value: (now = new Date()) => isoDay(shift(1, now)) },
  { key: 'this-week', label: 'This week', value: (now = new Date()) => isoWeek(now) },
  { key: 'next-week', label: 'Next week', value: (now = new Date()) => isoWeek(shift(7, now)) },
  { key: 'this-month', label: 'This month', value: (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}` },
  {
    key: 'next-month',
    label: 'Next month',
    value: (now = new Date()) => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    },
  },
  { key: 'exact', label: 'Pick a day…', value: () => EXACT },
];

/** Returned by the "pick a day" preset: it needs a date from the person, not a computation. */
export const EXACT = Symbol.for('todo.exact');

export const isExactDay = (due) => Boolean(due && /^\d{4}-\d{2}-\d{2}$/.test(due));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** How a stored due reads on screen, with its precision visible: "Sep", not "1 Sep". */
export function dueLabel(due) {
  if (!due) return null;
  const week = due.match(/^\d{4}-W(\d{2})$/);
  if (week) return `week ${Number(week[1])}`;
  const parts = due.split('-');
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return MONTHS[Number(parts[1]) - 1];
  return `${Number(parts[2])} ${MONTHS[Number(parts[1]) - 1]}`;
}

/**
 * The one-line hand-off to an agent.
 *
 * Short deliberately: whoever pastes this is talking to something that already
 * has the repo and the playbooks, so context spends its attention and buries the
 * two things it does not know — which item, and where it lives.
 */
export function promptFor(item, path) {
  return `Start on ^${item.id} in ${path}: ${item.text}${item.due ? ` (due ${item.due})` : ''}`;
}

/**
 * Holds edits and sends them as one batch.
 *
 * A commit per tap is 300-800 ms of latency and an unreadable history, so an edit
 * is applied optimistically and the intent queued. `send` receives the batch and
 * should resolve with the server's items, which win: it applied them to whatever
 * the file says now, possibly including someone else's change.
 */
export function createQueue({ send, delay = 2500, onState = () => {} }) {
  let pending = [];
  let timer = null;
  let inflight = null;

  async function flush() {
    clearTimeout(timer);
    timer = null;
    if (!pending.length) return inflight;
    const batch = pending;
    pending = [];
    onState('saving');
    inflight = (async () => {
      try {
        const result = await send(batch);
        onState(pending.length ? 'dirty' : 'saved');
        return result;
      } catch (err) {
        onState('error', err);
        throw err;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  return {
    push(intent) {
      pending.push(intent);
      onState('dirty');
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
    /** True while an edit is queued or in flight — for "are you sure you want to leave". */
    get busy() { return pending.length > 0 || inflight !== null; },
  };
}

/** Wire flush to the moments a tab can disappear. Returns an unsubscribe. */
export function flushOnHide(queue, target = globalThis) {
  const onHide = () => { if (queue.busy) queue.flush(); };
  target.addEventListener?.('pagehide', onHide);
  target.document?.addEventListener('visibilitychange', () => {
    if (target.document.hidden) onHide();
  });
  return () => target.removeEventListener?.('pagehide', onHide);
}
