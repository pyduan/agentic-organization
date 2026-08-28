import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseLine, formatLine, apply, reorder, ensureIds, idFrom } from '../lib/todo.mjs';

const CANON = '- [ ] Chase the printer for the brochure proof @sam due:2026-08-29 #brochure ^k3f9';

test('parses every field of a canonical line', () => {
  const i = parseLine(CANON);
  assert.equal(i.text, 'Chase the printer for the brochure proof');
  assert.deepEqual(i.owners, ['sam']);
  assert.equal(i.due, '2026-08-29');
  assert.deepEqual(i.tags, ['brochure']);
  assert.equal(i.id, 'k3f9');
  assert.equal(i.done, false);
});

test('a bare line stays legal', () => {
  const i = parseLine('- [ ] Call the printer');
  assert.equal(i.text, 'Call the printer');
  assert.deepEqual(i.owners, []);
  assert.equal(i.due, null);
  assert.equal(i.id, null);
});

test('legacy lines still parse, owner stays in the text', () => {
  const i = parseLine('- [ ] [Sam] Chase the printer (due week of Aug 17)');
  assert.equal(i.text, '[Sam] Chase the printer (due week of Aug 17)');
  assert.deepEqual(i.owners, []);
});

test('done items carry a date', () => {
  const i = parseLine('- [x] Sign off the proof #59 @sam done:2026-08-14 ^m1p2');
  assert.equal(i.done, true);
  assert.equal(i.doneOn, '2026-08-14');
  assert.deepEqual(i.tags, ['59']);
});

test('format round-trips a canonical line byte for byte', () => {
  assert.equal(formatLine(parseLine(CANON)), CANON);
});

test('an email or a path is not mistaken for an owner or a tag', () => {
  const i = parseLine('- [ ] Email hello@example.org about docs/failure-modes.md ^aa11');
  assert.deepEqual(i.owners, []);
  assert.deepEqual(i.tags, []);
  assert.equal(i.text, 'Email hello@example.org about docs/failure-modes.md');
});

const FILE = `# Next steps

Some prose that must survive untouched.

- [ ] First task @sam due:2026-09-01 ^aaaa
      An indented line of context.
- [ ] Second task ^bbbb
- [x] Third task done:2026-08-01 ^cccc

## Another section

- A bullet that is not a task.
`;

test('toggle changes exactly one line and nothing else', () => {
  const { markdown, changed } = apply(FILE, { op: 'toggle', id: 'bbbb', done: true, on: '2026-08-20' });
  assert.equal(changed, true);
  const before = FILE.split('\n');
  const after = markdown.split('\n');
  assert.equal(before.length, after.length);
  const differing = before.map((l, i) => (l === after[i] ? null : i)).filter((x) => x !== null);
  assert.deepEqual(differing, [6]);
  assert.equal(after[6], '- [x] Second task done:2026-08-20 ^bbbb');
});

test('setting a due date leaves the rest of the file byte-identical', () => {
  const { markdown } = apply(FILE, { op: 'set', id: 'cccc', due: '2026-12-24' });
  const before = FILE.split('\n'), after = markdown.split('\n');
  const differing = before.map((l, i) => (l === after[i] ? null : i)).filter((x) => x !== null);
  assert.deepEqual(differing, [7]);
});

test('an unknown id changes nothing', () => {
  const { markdown, changed, reason } = apply(FILE, { op: 'toggle', id: 'zzzz' });
  assert.equal(changed, false);
  assert.equal(markdown, FILE);
  assert.match(reason, /no item/);
});

test('continuation lines attach to their item and travel with it', () => {
  const items = parse(FILE);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0].notes, ['An indented line of context.']);
  const { markdown } = reorder(FILE, ['bbbb', 'aaaa', 'cccc']);
  const lines = markdown.split('\n');
  assert.equal(lines[4], '- [ ] Second task ^bbbb');
  assert.equal(lines[5], '- [ ] First task @sam due:2026-09-01 ^aaaa');
  assert.equal(lines[6], '      An indented line of context.');
  assert.ok(markdown.includes('Some prose that must survive untouched.'));
  assert.ok(markdown.includes('- A bullet that is not a task.'));
});

test('reorder refuses a span that is not a contiguous run', () => {
  const mixed = `- [ ] One ^aaaa\n\n## A heading in the middle\n\n- [ ] Two ^bbbb\n`;
  const { changed, reason } = reorder(mixed, ['bbbb', 'aaaa']);
  assert.equal(changed, false);
  assert.match(reason, /contiguous/);
});

test('ensureIds backfills, is stable, and is idempotent', () => {
  const src = '- [ ] No id yet\n- [ ] Another one @sam\n';
  const first = ensureIds(src);
  assert.equal(first.added, 2);
  const second = ensureIds(first.markdown);
  assert.equal(second.added, 0);
  assert.equal(second.markdown, first.markdown);
  assert.equal(ensureIds(src).markdown, first.markdown, 'deterministic across runs');
});

test('ensureIds never collides two identical texts', () => {
  const { markdown } = ensureIds('- [ ] Same text\n- [ ] Same text\n');
  const ids = parse(markdown).map((i) => i.id);
  assert.equal(new Set(ids).size, 2);
});

test('idFrom is stable and uses an unambiguous alphabet', () => {
  assert.equal(idFrom('hello'), idFrom('hello'));
  assert.doesNotMatch(idFrom('hello'), /[loi01]/);
});

test('re-applying an intent to a moved line still finds it', () => {
  const moved = reorder(FILE, ['cccc', 'aaaa', 'bbbb']).markdown;
  const { changed, markdown } = apply(moved, { op: 'toggle', id: 'bbbb', done: true, on: '2026-08-20' });
  assert.equal(changed, true);
  assert.ok(markdown.includes('- [x] Second task done:2026-08-20 ^bbbb'));
});

// --- due dates carry their own precision ---
import { dueEnd, isOverdue } from '../lib/todo.mjs';

test('a due date can be a day, a week, or a month', () => {
  assert.equal(parseLine('- [ ] A day due:2026-09-15 ^aa1x').due, '2026-09-15');
  assert.equal(parseLine('- [ ] A month due:2026-09 ^aa2x').due, '2026-09');
  assert.equal(parseLine('- [ ] A week due:2026-W36 ^aa3x').due, '2026-W36');
  assert.equal(parseLine('- [ ] A year due:2026 ^aa4x').due, '2026');
});

test('an id shorter than four characters is not an id', () => {
  // Guards the round-trip below: ^a2 is text, not an anchor.
  assert.equal(parseLine('- [ ] Something ^a2').id, null);
});

test('a vague due date survives a round trip', () => {
  const line = '- [ ] Look at this some time due:2026-09 ^vg3m';
  assert.equal(formatLine(parseLine(line)), line);
});

test('dueEnd closes the period', () => {
  assert.equal(dueEnd('2026-09-15'), '2026-09-15');
  assert.equal(dueEnd('2026-09'), '2026-09-30');
  assert.equal(dueEnd('2026-02'), '2026-02-28');
  assert.equal(dueEnd('2024-02'), '2024-02-29', 'leap year');
  assert.equal(dueEnd('2026'), '2026-12-31');
  assert.equal(dueEnd('2026-W36'), '2026-09-06');
  assert.equal(dueEnd(null), null);
});

test('a month is not late until the month is over', () => {
  assert.equal(isOverdue('2026-09', '2026-09-02'), false);
  assert.equal(isOverdue('2026-09', '2026-09-30'), false);
  assert.equal(isOverdue('2026-09', '2026-10-01'), true);
  assert.equal(isOverdue('2026-09-15', '2026-09-16'), true);
  assert.equal(isOverdue(null, '2026-09-16'), false);
});

test('a priority field is no longer special: it stays part of the text', () => {
  // The field was removed for being more ceremony than help. An old line keeps
  // parsing; p:1 is simply words now, so nothing breaks and nothing is silently lost.
  const i = parseLine('- [ ] An old line p:1 @sam ^oldp');
  assert.equal(i.text, 'An old line p:1');
  assert.equal(i.priority, undefined);
  assert.deepEqual(i.owners, ['sam']);
});

// --- comments: getting information back INTO the repo ---

const WITH_NOTES = `# Next steps

- [ ] First task @sam due:2026-09-01 ^aaaa
      An indented line of context.
- [ ] Second task ^bbbb

## Another section

- A bullet that is not a task.
`;

test('a comment is appended after the item and its context', () => {
  const { markdown, changed } = apply(WITH_NOTES, { op: 'comment', id: 'aaaa', text: 'Printer confirmed.', on: '2026-08-26', by: 'paul' });
  assert.equal(changed, true);
  const lines = markdown.split('\n');
  assert.equal(lines[3], '      An indented line of context.');
  assert.equal(lines[4], '      2026-08-26 @paul · Printer confirmed.');
  assert.equal(lines[5], '- [ ] Second task ^bbbb', 'must not land under the next item');
});

test('a comment on an item with no context still lands in the right place', () => {
  const { markdown } = apply(WITH_NOTES, { op: 'comment', id: 'bbbb', text: 'Done another way.', on: '2026-08-26' });
  const lines = markdown.split('\n');
  assert.equal(lines[4], '- [ ] Second task ^bbbb');
  assert.equal(lines[5], '      2026-08-26 · Done another way.');
  assert.equal(lines[6], '', 'the blank line before the heading survives');
  assert.ok(markdown.includes('## Another section'));
});

test('comments parse back, separately from context', () => {
  const { markdown } = apply(WITH_NOTES, { op: 'comment', id: 'aaaa', text: 'Shah a été retrouvée.', on: '2026-08-26', by: 'paul' });
  const item = parse(markdown).find((i) => i.id === 'aaaa');
  assert.deepEqual(item.notes, ['An indented line of context.']);
  assert.deepEqual(item.comments, [{ on: '2026-08-26', by: 'paul', text: 'Shah a été retrouvée.' }]);
});

test('comments accumulate in order and never overwrite', () => {
  let md = apply(WITH_NOTES, { op: 'comment', id: 'aaaa', text: 'First.', on: '2026-08-26' }).markdown;
  md = apply(md, { op: 'comment', id: 'aaaa', text: 'Second.', on: '2026-08-27' }).markdown;
  const item = parse(md).find((i) => i.id === 'aaaa');
  assert.deepEqual(item.comments.map((c) => c.text), ['First.', 'Second.']);
});

test('an empty comment changes nothing', () => {
  const { changed, reason } = apply(WITH_NOTES, { op: 'comment', id: 'aaaa', text: '   ' });
  assert.equal(changed, false);
  assert.match(reason, /empty/);
});

test('a comment travels with its item when the list is reordered', () => {
  const md = apply(WITH_NOTES, { op: 'comment', id: 'aaaa', text: 'Kept.', on: '2026-08-26' }).markdown;
  const moved = reorder(md, ['bbbb', 'aaaa']).markdown;
  const item = parse(moved).find((i) => i.id === 'aaaa');
  assert.deepEqual(item.comments.map((c) => c.text), ['Kept.']);
});

// ---------------------------------------------------------------------------
// sanitizeIntents: the server's gate on a batch, before anything touches a file.

import { sanitizeIntents } from '../lib/todo.mjs';

test('a well-formed batch passes, carrying only known fields', () => {
  const out = sanitizeIntents([
    { op: 'toggle', id: 'k3f9', done: true, on: '2026-08-27' },
    { op: 'comment', id: 'k3f9', text: '  found   her  ', by: 'forged@example.com' },
    { op: 'set', id: 'ab12', due: '2026-09' },
    { op: 'reorder', ids: ['k3f9', 'ab12'] },
  ]);
  assert.equal(out.length, 4);
  assert.equal(out[1].text, 'found her', 'whitespace is normalised');
  assert.equal('by' in out[1], false, 'a client-sent author never survives: the server stamps it');
});

test('an unknown op refuses the whole batch, not just its own intent', () => {
  assert.equal(sanitizeIntents([{ op: 'toggle', id: 'a1' }, { op: 'delete', id: 'a1' }]), null);
});

test('a malformed id, due, or owner list is refused', () => {
  assert.equal(sanitizeIntents([{ op: 'toggle', id: '../../etc/passwd' }]), null);
  assert.equal(sanitizeIntents([{ op: 'toggle', id: 'waytoolongforanid' }]), null);
  assert.equal(sanitizeIntents([{ op: 'set', id: 'a1', due: 'someday' }]), null);
  assert.equal(sanitizeIntents([{ op: 'set', id: 'a1', owners: ['sam space'] }]), null);
  assert.equal(sanitizeIntents([{ op: 'toggle', id: 'a1', on: '27/08/2026' }]), null);
});

test('an empty, oversized, or non-array batch is refused', () => {
  assert.equal(sanitizeIntents([]), null);
  assert.equal(sanitizeIntents('toggle everything'), null);
  assert.equal(sanitizeIntents(null), null);
  assert.equal(sanitizeIntents(Array.from({ length: 21 }, () => ({ op: 'toggle', id: 'a1' }))), null);
});

test('an empty comment and a set that changes nothing are refused', () => {
  assert.equal(sanitizeIntents([{ op: 'comment', id: 'a1', text: '   ' }]), null);
  assert.equal(sanitizeIntents([{ op: 'set', id: 'a1' }]), null);
});

test('a sanitized batch still applies through apply()', () => {
  const md = '- [ ] Chase the printer ^k3f9';
  const [intent] = sanitizeIntents([{ op: 'toggle', id: 'k3f9', done: true, on: '2026-08-27' }]);
  const r = apply(md, intent);
  assert.equal(r.changed, true);
  assert.match(r.markdown, /- \[x\]/);
});
