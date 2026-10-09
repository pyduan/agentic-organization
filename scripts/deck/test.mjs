// The deck engine's own tests: node --test scripts/deck/test.mjs
// The browser checks are skipped, with the reason, on a machine without Chrome.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { parseDeck, parseLiteral, frontmatter } from './parse.mjs';
import { md } from './text.mjs';
import { renderDeck } from './render.mjs';
import { components, validate, S } from './components.mjs';
import { stripDark, buildDeck } from './build.mjs';
import { readZip, readPptx, outline, style } from './read-pptx.mjs';
import { findChrome } from './chrome.mjs';
import { checkDeck } from './check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const render = (src, opts = {}) => renderDeck(parseDeck(src), { registry: components, asset: (s) => s, css: '', js: '', ...opts });

test('frontmatter: quoted values keep their colons, an unquoted ": " is refused', () => {
  assert.equal(frontmatter('---\ntitle: "Point : détail #2"\n---\n').meta.title, 'Point : détail #2');
  assert.equal(frontmatter('---\ndate: 2026-10-09 # commentaire\n---\n').meta.date, '2026-10-09');
  assert.throws(() => frontmatter('---\ntitle: Point : détail\n---\n'), /quote the value/);
});

test('literals: lists, objects, comments, trailing commas; nothing that runs', () => {
  const { value } = parseLiteral(`[{ title: "a", n: 2, ok: true }, // un commentaire
    'b', \`deux
lignes\`,]`);
  assert.deepEqual(value, [{ title: 'a', n: 2, ok: true }, 'b', 'deux\nlignes']);
  assert.throws(() => parseLiteral('foo()'), /only literal values/);
  assert.throws(() => parseLiteral('`${x}`'), /template expressions/);
});

test('a deck refuses what would let it carry its own layout', () => {
  assert.throws(() => parseDeck('<Slide title="t">\n<div style="color:red">x</div>\n</Slide>'), /line 2: raw HTML/);
  assert.throws(() => parseDeck('import X from "./x.mjs"\n<Slide title="t" />'), /imports nothing/);
  assert.throws(() => parseDeck('<Slide title="t">{1 + 1}</Slide>'), /expression/);
  assert.throws(() => parseDeck('du texte\n<Slide title="t" />'), /text outside a slide/);
  assert.throws(() => parseDeck('<Slide title="t">\n<Text>x</Text>'), /never closed/);
});

test('the registry refuses an unknown component, an unknown prop, a wrong type, a missing title', () => {
  const r = render('<Slide title="t"><Bogus /></Slide>\n<Slide titel="t" />\n<Slide title="t"><Cards items="x" /></Slide>\n<Slide />');
  assert.match(r.errors.join('\n'), /<Bogus>.*no such component/);
  assert.match(r.errors.join('\n'), /unknown prop "titel"/);
  assert.match(r.errors.join('\n'), /items\[0\] should be an object/);
  assert.match(r.errors.join('\n'), /slide 4 <Slide>.*title is required/);
  assert.match(render('<Cards items={[{ title: "a" }]} />').errors[0], /a block goes inside a <Slide>/);
  assert.match(render('<Slide title="t"><Split><Text>a</Text></Split></Slide>').errors[0], /2 columns but 1 children/);
});

test('schemas: enums, required fields, list limits as warnings', () => {
  const errors = [], warnings = [];
  const rep = { error: (m) => errors.push(m), warn: (m) => warnings.push(m) };
  validate('purple', S.oneOf(['a', 'b']), 'tone', rep);
  validate([1, 2, 3], S.list(S.int(), { max: 2 }), 'items', rep);
  assert.match(errors[0], /tone should be one of "a", "b"/);
  assert.match(warnings[0], /3 items/);
});

test('text: escaped, then marked, then typeset; code is left alone', () => {
  assert.equal(md('<b>x</b> *mot* **gras**'), '&lt;b&gt;x&lt;/b&gt; <em>mot</em> <strong>gras</strong>');
  assert.equal(md('Une *source* : la vôtre'), 'Une <em>source</em>\u00a0: la vôtre');
  assert.equal(md('`a : *b*`'), '<code>a : *b*</code>');
  assert.equal(md('1 606 112 €'), '1\u202f606\u202f112\u00a0€');
  assert.equal(md('l\'équipe', 'en'), 'l’équipe');
});

test('chapters carry over, a Divider sets one, an Agenda does not show one', () => {
  const r = render(`<Slide chapter="Partie A" title="un" />
<Slide title="deux" />
<Divider title="Partie B" />
<Slide title="trois" />
<Agenda active={1} items={["X", "Y"]} />
<Slide title="quatre" />`);
  assert.deepEqual(r.slides.map((s) => s.chapter), ['Partie A', 'Partie A', 'Partie B', 'Partie B', 'X', 'X']);
  assert.match(r.html, /data-n="4"[^>]*data-chapter="Partie B"/);
  assert.ok(r.html.includes('<p class="dk-chapter">Partie B</p>'));
  assert.ok(!/data-n="6"[^>]*has-chapter/.test(r.html.match(/<section[^>]*data-n="6"[^>]*>/)[0]), 'after an Agenda, no chapter label is shown');
});

test('content rules: a figure needs a source, two dark slides in a row are flagged', () => {
  const r = render(`---
title: x
date: 2026-10-09
audience: a
takeaway: b
---
<Slide title="Budget"><Text>Nous avons levé 1,2 M€.</Text></Slide>
<Slide title="Budget" source="Comptes 2025"><Text>Nous avons levé 1,2 M€.</Text></Slide>
<Divider title="Un" />
<Divider title="Deux" />`);
  assert.equal(r.errors.length, 0);
  assert.equal(r.warnings.filter((w) => /without a source/.test(w)).length, 1);
  assert.match(r.warnings.join('\n'), /slide 4: second dark slide in a row/);
});

test('a shared copy carries no speaker notes', () => {
  const src = '<Slide title="t" notes="Ne pas citer ce chiffre" />';
  assert.ok(render(src).html.includes('Ne pas citer ce chiffre'));
  assert.ok(!render(src, { shareMode: true }).html.includes('Ne pas citer ce chiffre'));
});

test('a deck is always on paper: the dark half of the brand tokens is dropped', () => {
  const css = stripDark(':root{--a:#fff}\n@media (prefers-color-scheme: dark){:root{--a:#000}}\n:root[data-theme="dark"]{--a:#111}\n.x{color:red}');
  assert.ok(css.includes('--a:#fff') && css.includes('.x{color:red}'));
  assert.ok(!css.includes('#000') && !css.includes('#111'));
});

test('the component catalogue builds without an error', async () => {
  const paths = { tokens: [], brand: join(HERE, 'no-brand'), decks: [], assetMode: 'link' };
  const r = await buildDeck(join(HERE, 'examples', 'deck.mdx'), paths, { outFile: join(mkdtempSync(join(tmpdir(), 'deck-')), 'index.html'), log: () => {} });
  assert.deepEqual(r.errors, []);
  assert.ok(r.slides.length >= 20);
  assert.ok(Object.keys(components).every((name) => readFileSync(join(HERE, 'examples', 'deck.mdx'), 'utf8').includes(`<${name}`)), 'every component appears in the catalogue');
});

// A minimal .pptx, written here so the reader is tested without a binary fixture.
function zip(files) {
  const crc = zlib.crc32;
  const local = [], central = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text), n = Buffer.from(name);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc(data), 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc(data), 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    local.push(h, n, data); central.push(c, n);
    off += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(files).length, 8); e.writeUInt16LE(Object.keys(files).length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...local, cd, e]);
}

test('read-pptx: text in order with its style, the header band, the theme fonts', { skip: !zlib.crc32 && 'this Node has no zlib.crc32 to write the fixture' }, () => {
  const ns = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const rel = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  const band = '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Bandeau"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="952500"/></a:xfrm><a:prstGeom prst="rect"/><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="1F5C4A"/></a:gs><a:gs pos="100000"><a:srgbClr val="34557F"/></a:gs></a:gsLst></a:gradFill></p:spPr>'
    + '<p:txBody><a:p><a:r><a:rPr sz="2800" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>NOS MISSIONS</a:t></a:r></a:p></p:txBody></p:sp>';
  const body = '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Texte"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="190500" y="1143000"/><a:ext cx="9525000" cy="2000000"/></a:xfrm></p:spPr>'
    + '<p:txBody><a:p><a:r><a:rPr sz="1400"/><a:t>Des systèmes</a:t></a:r><a:r><a:rPr sz="1400"/><a:t> </a:t></a:r><a:r><a:rPr sz="1400"/><a:t>capables</a:t></a:r></a:p></p:txBody></p:sp>';
  const slide = (extra = '') => `<p:sld ${ns}${extra}><p:cSld><p:spTree>${band}${body}</p:spTree></p:cSld></p:sld>`;
  const buf = zip({
    'ppt/presentation.xml': `<p:presentation ${ns}><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<Relationships>${rel('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml')}${rel('rId2', 'slide', 'slides/slide1.xml')}${rel('rId3', 'slide', 'slides/slide2.xml')}</Relationships>`,
    'ppt/slideMasters/slideMaster1.xml': `<p:sldMaster ${ns}/>`,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': `<Relationships>${rel('rId1', 'theme', '../theme/theme1.xml')}</Relationships>`,
    'ppt/theme/theme1.xml': `<a:theme ${ns}><a:themeElements><a:clrScheme name="x"><a:dk1><a:srgbClr val="000000"/></a:dk1></a:clrScheme><a:fontScheme name="x"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`,
    'ppt/slides/slide1.xml': slide(),
    'ppt/slides/slide2.xml': slide(' show="0"'),
  });
  const dir = mkdtempSync(join(tmpdir(), 'pptx-'));
  writeFileSync(join(dir, 'x.pptx'), buf);
  assert.equal(readZip(buf).names.length, 7);
  const deck = readPptx(join(dir, 'x.pptx'));
  assert.deepEqual(deck.canvas, { w: 1280, h: 720 });
  assert.equal(deck.slides[1].hidden, true);
  const o = outline(deck, 'x');
  assert.match(o, /## 1\. NOS MISSIONS/);
  assert.match(o, /- Des systèmes capables {2}_\(14pt\)_/);
  assert.match(o, /## 2\. NOS MISSIONS \(hidden\)/);
  const st = style(deck);
  assert.equal(st.theme.fonts.minor, 'Aptos');
  assert.deepEqual(st.band[0].shown, { top: 0, height: 100 });
  assert.deepEqual(st.band[0].fill.gradient, ['#1F5C4A', '#34557F']);
  assert.equal(st.sizes.find((s) => s.pt === 28).px, 37.3);
});

const chrome = findChrome();
test('the browser check finds what overflows, what lies over its neighbour, what is unequal', { skip: !chrome && 'no Chrome on this machine' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deck-check-'));
  mkdirSync(join(dir, 'brand'));
  // A theme mistake that pushes one block over the next: every edge of the slide stays clean, so
  // only the overlap check can see it (a dense slide shipped that way once, measured "0 defects").
  writeFileSync(join(dir, 'brand', 'theme.css'), '#pile .dk-callout + .dk-callout { margin-top: -60px; }');
  const deck = join(dir, 'deck.mdx');
  const long = Array.from({ length: 14 }, (_, i) => `"Point numéro ${i + 1}, assez long pour prendre toute une ligne de la slide quand il est affiché"`).join(', ');
  writeFileSync(deck, `<Slide title="Trop plein"><Bullets items={[${long}]} /></Slide>
<Slide title="Cartes"><Cards items={[{ title: "Une", text: "courte" }, { title: "Deux", text: "une carte beaucoup plus longue que l'autre, sur plusieurs lignes, pour que la rangée soit inégale si rien ne l'égalise" }]} /></Slide>
<Slide title="Propre"><Stats items={[{ value: "4", label: "écoles" }, { value: "96", label: "classes" }]} /></Slide>
<Slide id="pile" title="Empilé"><Callout>Une première phrase</Callout><Callout tone="next">Une seconde phrase</Callout></Slide>`);
  const paths = { tokens: [], brand: join(dir, 'brand'), decks: [dir], assetMode: 'link' };
  const b = await buildDeck(deck, paths, { log: () => {} });
  assert.deepEqual(b.errors, []);
  const r = await checkDeck(b.out, { shots: false, contrast: false });
  assert.ok(!r.skipped, r.skipped);
  assert.ok(r.defects.some((d) => d.n === 1 && ['overflow', 'margin'].includes(d.issue)), JSON.stringify(r.defects));
  assert.ok(!r.defects.some((d) => d.n === 2 && d.issue === 'grid'), 'cards in a row are equalised by the theme');
  assert.ok(!r.defects.some((d) => d.n === 3), JSON.stringify(r.defects.filter((d) => d.n === 3)));
  assert.ok(r.defects.some((d) => d.n === 4 && d.issue === 'overlap'), JSON.stringify(r.defects.filter((d) => d.n === 4)));
});
