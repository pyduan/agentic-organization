// The leak check (scripts/check-leaks.mjs), on throwaway files. Every name here is invented.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { internals, parseTerms, scan } from './check-leaks.mjs';

const top = mkdtempSync(join(tmpdir(), 'leaks-'));
after(() => rmSync(top, { recursive: true, force: true }));
const file = (rel, text) => { const p = join(top, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, text); return p; };

test('a term is matched whole-word and case-insensitively', () => {
  const f = file('site/a.md', 'We met Northwind on Tuesday.\nNorthwinds are not a client.\n');
  const hits = scan([f], parseTerms('northwind\n'), top);
  assert.deepEqual(hits.map((h) => h.line), [1]);
});

test('comments and blank lines are ignored', () => {
  assert.deepEqual(parseTerms('# who must not be named\n\nNorthwind # the bakery\n').map((r) => r.term), ['Northwind']);
});

test('a scoped term is refused only where its glob matches', () => {
  const home = file('decks/pitch/deck.mdx', 'Our work with Contoso.\n');
  const shared = file('shared/notes.md', 'Our work with Contoso.\n');
  const rules = parseTerms('scope: shared/**\nContoso\n');
  assert.deepEqual(scan([home, shared], rules, top).map((h) => h.file), ['shared/notes.md']);
});

test('scope: * goes back to every path', () => {
  const rules = parseTerms('scope: shared/**\nContoso\nscope: *\nFabrikam\n');
  assert.equal(rules[1].scope, null);
});

// ------------------------------------------------------------------ internals on public pages

const whats = (text, file = 'page.html') => internals(text, file).map((h) => h.what);

test('a repo path, a markdown file, a command, a ^id and an unfilled marker are refused on a public page', () => {
  assert.deepEqual(whats('<p>Edit source/content/menu.md then run npm run build.</p>'),
    ['a path into the repo', "a markdown file's name", 'a command']);
  assert.deepEqual(whats('<li>Call the printer ^k3x9</li>'), ["a to-do line's ^id"]);
  assert.deepEqual(whats('<p>Opening hours: TODO</p>\n<p>Welcome to {{ BAKERY_NAME }}</p>\n<p>Founded in 2019 (seed, to confirm)</p>'),
    ['a marker left unfilled', 'a marker left unfilled', 'a marker left unfilled']);
});

test('a link to a public page is not a leak, nor a URL path that looks like a folder', () => {
  assert.deepEqual(whats('<a href="https://github.com/acme/brochure/blob/main/README.md">source</a>'), []);
  assert.deepEqual(whats('<a href="/docs/menu">menu</a> <img src="/scripts/logo.svg">'), []);
});

test('an HTML comment ships in markdown and as a sentence in a page; a section label and an .astro comment do not', () => {
  assert.deepEqual(whats('Our menu.\n<!-- verify the prices with the bakery -->\n', 'content/menu.md'), ['an HTML comment']);
  assert.deepEqual(whats('<!-- COVER -->\n<!-- PAGE 3 · the team and the plan -->\n<section></section>'), []);
  assert.deepEqual(whats('<!-- The button stays on the site, so that a visitor never leaves the form halfway -->'), ['an HTML comment']);
  assert.deepEqual(whats('---\nimport Base from "../layouts/Base.astro";\n// read from source/brand/tokens.css\n---\n' +
    '<!-- titles without dashes (voice.md) -->\n<style>/* see source/brand/design.md */</style>\n<h1>Menu</h1>', 'index.astro'), []);
});

test('a page that names internals on purpose opts out once, in a comment, its front matter or a meta tag', () => {
  assert.deepEqual(whats('---\ntitle: How to edit\ncheck-leaks: internals-ok\n---\nRun npm run dev.\n', 'how-to.md'), []);
  assert.deepEqual(whats('<meta name="check-leaks" content="internals-ok"><p>npm run dev</p>'), []);
  assert.deepEqual(whats('---\n// check-leaks: internals-ok\n---\n<p>Drop files in source/inbox/.</p>', 'index.astro'), []);
});

test('the repo\'s own owner/name is refused when given, a longer name that contains it is not', () => {
  const slug = [/(?<![\w./-])acme\/brochure(?![\w-])/i, "the repo's name"];
  assert.deepEqual(internals('<p>Kept in acme/brochure.</p>', 'p.html', [slug]).map((h) => h.what), ["the repo's name"]);
  assert.deepEqual(internals('<p>Kept in acme/brochure-archive.</p>', 'p.html', [slug]), []);
});
