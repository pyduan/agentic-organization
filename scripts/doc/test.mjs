// The document format (scripts/doc/): markdown, the build's own rules, and the pagination in
// Chrome. The browser test is skipped, with the reason, on a machine without Chrome.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderMarkdown } from './markdown.mjs';
import { renderDocument, titleProblems, checkDocument } from './build.mjs';
import { findChrome, withChrome } from '../deck/chrome.mjs';

const top = mkdtempSync(join(tmpdir(), 'doc-'));
after(() => rmSync(top, { recursive: true, force: true }));

test('markdown: escaped first, then marked; a link is not a blank, a bracket is', () => {
  const ctx = { blanks: [] };
  const html = renderMarkdown('A <b>tag</b>, **bold**, [the site](https://example.org) and [price to set].', ctx);
  assert.match(html, /&lt;b&gt;tag&lt;\/b&gt;/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="https:\/\/example.org"/);
  assert.match(html, /<mark class="doc-blank">\[price to set\]<\/mark>/);
  assert.deepEqual(ctx.blanks, ['price to set']);
});

test('markdown: directives render, a pagebreak stands alone, an unknown one stops the build', () => {
  const html = renderMarkdown(':::steps\n- **Ask**: in one line\n- **Check**: the result\n:::\n\n:::pagebreak\n\nAfter.');
  assert.match(html, /class="doc-steps"/);
  assert.match(html, /data-pagebreak/);
  assert.match(html, /<p>After\.<\/p>/);
  assert.throws(() => renderMarkdown(':::gallery\nx\n:::'), /unknown directive ":::gallery"/);
});

test('a title is a label: a dash or an apposition comma is named, a list is fine', () => {
  assert.equal(titleProblems('Our schools — warmer this winter').length, 1);
  assert.equal(titleProblems('Our schools, warmer this winter').length, 1);
  assert.equal(titleProblems('Schools, clinics and libraries').length, 0);
});

test('the build lists what is left to complete and shows it on screen only', () => {
  const r = renderDocument('---\ntitle: The proposal\ntype: one-pager\nto-complete: [the price, the start date]\n---\n\nIt costs [price].\n');
  assert.deepEqual(r.todo, ['the price', 'the start date']);
  assert.deepEqual(r.blanks, ['price']);
  assert.match(r.html, /class="doc-todo"/);
  assert.match(r.html, /data-onepager/);
  assert.match(r.html, /<meta name="robots" content="noindex">/);
});

test('a letter: the letterhead in two columns, the signature to the right, no title block', () => {
  const r = renderDocument([
    '---', 'title: Letter', 'type: letter', '---', '',
    ':::letterhead', 'THE SENDER', 'Ref. [number]', '---', 'THE COUNTRY', ':::', '',
    ':::centered', 'MEMORANDUM', ':::', '',
    ':::recipient', 'The city, [date]', ':::', '',
    ':::subject Subject:', 'the review', ':::', '',
    'The body.', '',
    ':::signature', 'The Director,', '[name]', ':::', '',
  ].join('\n'));
  assert.doesNotMatch(r.html, /class="doc-hero"/);
  assert.match(r.html, /data-letter/);
  assert.match(r.html, /class="doc-letterhead"><div><span>THE SENDER<\/span><span>Ref\. <mark class="doc-blank">\[number\]<\/mark><\/span><\/div><div><span>THE COUNTRY<\/span><\/div><\/div>/);
  assert.match(r.html, /class="doc-subject"><span>Subject:<\/span> the review<\/p>/);
  assert.match(r.html, /class="doc-signature"><span>The Director,<\/span>/);
  assert.match(r.html, /class="doc-recipient"><span>The city, <mark/);
  assert.deepEqual(r.blanks, ['number', 'date', 'name']);
});

const chrome = findChrome();
test('in Chrome: a long document paginates with nothing taller than a page, a one-pager that runs over is caught', { skip: !chrome && 'no Chrome on this machine' }, async () => {
  const long = Array.from({ length: 80 }, (_, i) => `- Item ${i}: a line long enough to take some room on the page.`).join('\n');
  const file = (name, src) => { const p = join(top, `${name}.html`); writeFileSync(p, renderDocument(src).html); return p; };
  const doc = file('doc', `---\ntitle: Long\n---\n\n## First\n\n${long}\n\n## Second\n\n${long}\n`);
  const one = file('one', `---\ntitle: Short\ntype: one-pager\n---\n\n${long}\n${long}\n`);
  await withChrome(async (port) => {
    const d = await checkDocument(doc, port);
    assert.ok(d.pages >= 3, `${d.pages} pages`);
    assert.equal(d.overflow, 0);
    assert.deepEqual(d.errors, []);
    const o = await checkDocument(one, port);
    assert.ok(o.pages > 1, 'the one-pager runs over and the count says so');
  });
});
