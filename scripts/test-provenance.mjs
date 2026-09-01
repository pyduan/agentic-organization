// lib/provenance.mjs, tested on throwaway files.
//
// Every case here is a real failure rather than an invented one. Two happened on
// the same evening on a model carrying decisions nobody wants to get wrong: a tool
// read a stale duplicate of the owner's spreadsheet and reported six anomalies
// present in neither of her files, then told her she had fixed them when it started
// reading the right one. The third is a BLOCKING verdict that rested on a term the
// tool's own notes called untraceable. A sentence in a guide would not stop any of
// them coming back; these will.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  record, verify, capSeverity, provenanceOf, comparable, findManifests, MANIFEST_NAME,
} from '../lib/provenance.mjs';

const workspace = () => mkdtempSync(join(tmpdir(), 'prov-'));
const put = (root, name, body, mtimeSeconds = null) => {
  const p = join(root, name);
  writeFileSync(p, body);
  if (mtimeSeconds !== null) utimesSync(p, mtimeSeconds, mtimeSeconds);
  return p;
};

test('a source that is not on disk is refused at record time, not at read time', async () => {
  const root = workspace();
  try {
    await assert.rejects(
      () => record(root, { sources: [{ id: 'workbook', path: 'modele.xlsx' }] }),
      /not on disk/,
      'recording what should exist rather than what does is how a manifest starts lying');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an export must name the original it came from', async () => {
  const root = workspace();
  try {
    put(root, 'export.csv', 'a,b\n1,2\n');
    await assert.rejects(
      () => record(root, { sources: [{ id: 'csv', path: 'export.csv', role: 'export' }] }),
      /does not say which original/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a figure cannot carry a status outside the five', async () => {
  const root = workspace();
  try {
    put(root, 'modele.xlsx', 'x');
    await assert.rejects(
      () => record(root, {
        sources: [{ id: 'workbook', path: 'modele.xlsx' }],
        figures: [{ id: 'prix', status: 'probably fine', from: ['workbook'] }],
      }),
      /not one of/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a source edited since it was recorded stops the tool', async () => {
  const root = workspace();
  try {
    put(root, 'modele.xlsx', 'version one');
    const m = await record(root, { sources: [{ id: 'workbook', path: 'modele.xlsx' }] });
    assert.equal((await verify(root, m)).ok, true, 'unchanged means it may compute');

    put(root, 'modele.xlsx', 'version two, edited by hand');
    const after = await verify(root, m);
    assert.equal(after.ok, false);
    assert.match(after.findings[0].what, /has changed since it was recorded/);
    assert.match(after.findings[0].what, /an event with a date/,
      'a manual edit upstream is legitimate; swallowing it in silence is what is not');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a source that has been swapped for a neighbour is a stop, not a guess', async () => {
  const root = workspace();
  try {
    put(root, 'modele.xlsx', 'the one she works in');
    const m = await record(root, { sources: [{ id: 'workbook', path: 'modele.xlsx' }] });
    rmSync(join(root, 'modele.xlsx'));
    put(root, 'modele (1).xlsx', 'a fork frozen days earlier');
    const after = await verify(root, m);
    assert.equal(after.ok, false);
    assert.match(after.findings[0].what, /neighbouring names is ordinary/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an export older than its original stops the tool, with both dates', async () => {
  const root = workspace();
  try {
    // The real one was more than a day behind and nothing was capable of noticing.
    const day = 86_400;
    const now = Math.floor(Date.now() / 1000);
    put(root, 'modele.xlsx', 'edited today', now);
    put(root, 'export.csv', 'generated two days ago', now - 2 * day);
    const m = await record(root, {
      sources: [
        { id: 'workbook', path: 'modele.xlsx' },
        { id: 'csv', path: 'export.csv', role: 'export', of: 'workbook' },
      ],
    });
    const out = await verify(root, m);
    assert.equal(out.ok, false);
    const f = out.findings.find((x) => x.id === 'csv');
    assert.match(f.what, /older than the document it comes from/);
    assert.match(f.what, /an export is never a source/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an export newer than its original is fine', async () => {
  const root = workspace();
  try {
    const now = Math.floor(Date.now() / 1000);
    put(root, 'modele.xlsx', 'edited', now - 3600);
    put(root, 'export.csv', 'regenerated after', now);
    const m = await record(root, {
      sources: [
        { id: 'workbook', path: 'modele.xlsx' },
        { id: 'csv', path: 'export.csv', role: 'export', of: 'workbook' },
      ],
    });
    assert.equal((await verify(root, m)).ok, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('severity is capped by the weakest input, and an unknown status is weakest', () => {
  assert.equal(capSeverity(['established']), 'blocking');
  assert.equal(capSeverity(['established', 'established']), 'blocking');
  assert.equal(capSeverity(['established', 'conditional']), 'warning');
  assert.equal(capSeverity(['established', 'untraceable']), 'question',
    'a check fed by an untraceable term cannot be blocking: it can be a question');
  assert.equal(capSeverity(['established', 'to-establish']), 'question');
  assert.equal(capSeverity(['establishedd']), 'question', 'a typo must not be able to promote a verdict');
  assert.equal(capSeverity([]), 'question');
});

test('a figure says in words what supports it, and which version it was read from', async () => {
  const root = workspace();
  try {
    put(root, 'modele.xlsx', 'x');
    const m = await record(root, {
      sources: [{ id: 'workbook', path: 'modele.xlsx', label: 'the workbook' }],
      figures: [{ id: 'prix', label: 'floor price', status: 'untraceable', from: ['workbook'], note: 'no clause found' }],
    });
    const p = provenanceOf(m, 'prix');
    assert.equal(p.maxSeverity, 'question');
    assert.match(p.text, /untraceable/);
    assert.match(p.text, /the workbook \(version of \d{4}-\d{2}-\d{2}/,
      'which document, and which version of it, next to the value');
    assert.equal(provenanceOf(m, 'nope'), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('two runs on different versions of a source are not comparable', async () => {
  const root = workspace();
  try {
    put(root, 'modele.xlsx', 'before');
    const before = await record(root, { sources: [{ id: 'workbook', path: 'modele.xlsx' }] });
    put(root, 'modele.xlsx', 'after');
    const after = await record(root, { sources: [{ id: 'workbook', path: 'modele.xlsx' }] });

    assert.equal(comparable(before, before).same, true);
    const c = comparable(before, after);
    assert.equal(c.same, false);
    assert.match(c.why, /least of all that somebody fixed it/,
      'the checks going green after the source changed is not evidence of a repair');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('every manifest under a root is found, and build output is not walked', async () => {
  const root = workspace();
  try {
    mkdirSync(join(root, 'apps/modele'), { recursive: true });
    mkdirSync(join(root, 'apps/modele/dist'), { recursive: true });
    put(root, `apps/modele/${MANIFEST_NAME}`, '{}');
    put(root, `apps/modele/dist/${MANIFEST_NAME}`, '{}');
    const found = await findManifests(root);
    assert.equal(found.length, 1, 'a copy in dist/ is the same manifest twice, and only one of them is edited');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
