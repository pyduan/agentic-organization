import test from 'node:test';
import assert from 'node:assert/strict';
import { DUE_PRESETS, EXACT, isoWeek, dueLabel, isExactDay, promptFor, createQueue, localToday } from '../lib/todo-client.mjs';

const preset = (key) => DUE_PRESETS.find((p) => p.key === key);
const at = (s) => new Date(`${s}T12:00:00`);

test('presets compute from the date given, not from today', () => {
  assert.equal(preset('today').value(at('2026-08-26')), '2026-08-26');
  assert.equal(preset('tomorrow').value(at('2026-08-26')), '2026-08-27');
  assert.equal(preset('this-month').value(at('2026-08-26')), '2026-08');
  assert.equal(preset('next-month').value(at('2026-08-26')), '2026-09');
  assert.equal(preset('').value(), null);
  assert.equal(preset('exact').value(), EXACT);
});

test('next-month crosses the year without landing in month 13', () => {
  assert.equal(preset('next-month').value(at('2026-12-15')), '2027-01');
});

test('this-month pads a single-digit month', () => {
  assert.equal(preset('this-month').value(at('2026-03-04')), '2026-03');
});

test('ISO weeks follow the Thursday rule at a year boundary', () => {
  // 1 January 2027 is a Friday, so it belongs to week 53 of 2026.
  assert.equal(isoWeek(at('2027-01-01')), '2026-W53');
  assert.equal(isoWeek(at('2026-08-26')), '2026-W35');
  assert.equal(preset('next-week').value(at('2026-08-26')), '2026-W36');
});

test('labels show the precision that was chosen', () => {
  assert.equal(dueLabel('2026-09-15'), '15 Sep');
  assert.equal(dueLabel('2026-09'), 'Sep');
  assert.equal(dueLabel('2026-W36'), 'week 36');
  assert.equal(dueLabel('2026'), '2026');
  assert.equal(dueLabel(null), null);
});

test('only a full date counts as an exact day', () => {
  assert.ok(isExactDay('2026-09-15'));
  assert.ok(!isExactDay('2026-09'));
  assert.ok(!isExactDay(null));
});

test('the prompt names the item, its file, and its due when there is one', () => {
  const item = { id: 'k3f9', text: 'Chase the printer', due: '2026-09' };
  assert.equal(promptFor(item, 'projects/x/next-steps.md'),
    'Start on ^k3f9 in projects/x/next-steps.md: Chase the printer (due 2026-09)');
  assert.equal(promptFor({ ...item, due: null }, 'p.md'), 'Start on ^k3f9 in p.md: Chase the printer');
});

test('the queue batches several edits into one send', async () => {
  const sent = [];
  const q = createQueue({ delay: 5, send: async (batch) => { sent.push(batch); return batch.length; } });
  q.push({ op: 'toggle', id: 'a' });
  q.push({ op: 'toggle', id: 'b' });
  q.push({ op: 'set', id: 'c', due: '2026-09' });
  await q.flush();
  assert.equal(sent.length, 1, 'one send, not three');
  assert.equal(sent[0].length, 3);
});

test('flushing an empty queue sends nothing', async () => {
  let calls = 0;
  const q = createQueue({ delay: 5, send: async () => { calls++; } });
  await q.flush();
  assert.equal(calls, 0);
});

test('busy is true from the first edit until the send resolves', async () => {
  let release;
  const q = createQueue({ delay: 1000, send: () => new Promise((r) => { release = r; }) });
  assert.equal(q.busy, false);
  q.push({ op: 'toggle', id: 'a' });
  assert.equal(q.busy, true, 'queued');
  const done = q.flush();
  assert.equal(q.busy, true, 'in flight');
  release();
  await done;
  assert.equal(q.busy, false);
});

test('a failing send reports the error and keeps the edits', async () => {
  const states = [];
  const q = createQueue({
    delay: 5,
    send: async () => { throw new Error('HTTP 409'); },
    onState: (s) => states.push(s),
  });
  q.push({ op: 'toggle', id: 'a' });
  await q.flush();
  assert.deepEqual(states, ['dirty', 'saving', 'error']);
  // The old contract dropped the batch, so the screen kept showing a change the
  // file never received. Edits stay queued, and `busy` says so.
  assert.equal(q.busy, true, 'a failed batch must stay queued, not vanish');
});

test('a batch that failed is retried, with everything queued since', async () => {
  const seen = [];
  let fail = true;
  const q = createQueue({
    delay: 5,
    send: async (batch) => {
      seen.push(batch.map((i) => i.id));
      if (fail) throw new Error('HTTP 500');
      return { ok: true };
    },
  });
  q.push({ op: 'toggle', id: 'a' });
  await q.flush();
  q.push({ op: 'toggle', id: 'b' });
  fail = false;
  await q.flush();
  assert.deepEqual(seen, [['a'], ['a', 'b']], 'the failed edit goes back in front of what came after');
  assert.equal(q.busy, false, 'a successful send clears the queue');
});

test('localToday is the local calendar day, not the UTC one', () => {
  // 00:30 in Paris on the 27th is still the 26th in UTC. A tick at that hour was
  // being dated yesterday, which is the bug this function exists to prevent.
  const justAfterMidnight = new Date(2026, 7, 27, 0, 30, 0);
  assert.equal(localToday(justAfterMidnight), '2026-08-27');
  assert.equal(localToday(new Date(2026, 0, 5, 23, 59, 0)), '2026-01-05');
  assert.match(localToday(), /^\d{4}-\d{2}-\d{2}$/);
});
