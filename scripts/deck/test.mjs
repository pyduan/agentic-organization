// The deck engine's own tests: node --test scripts/deck/test.mjs
// The browser checks are skipped, with the reason, on a machine without Chrome.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { parseDeck, parseLiteral, frontmatter } from './parse.mjs';
import { md } from './text.mjs';
import { wordsToAvoid, unitOf } from './copy.mjs';
import { renderDeck } from './render.mjs';
import { components, validate, S } from './components.mjs';
import { stripDark, buildDeck, undefinedTokens } from './build.mjs';
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

test('text: escaped, then marked, then typeset in the deck\'s language; code is left alone', () => {
  assert.equal(md('<b>x</b> *word* **bold**'), '&lt;b&gt;x&lt;/b&gt; <em>word</em> <strong>bold</strong>');
  assert.equal(md('A *source*: yours'), 'A <em>source</em>: yours');
  assert.equal(md('Une *source* : la vôtre', 'fr'), 'Une <em>source</em>\u00a0: la vôtre');
  assert.equal(md('`a : *b*`', 'fr'), '<code>a : *b*</code>');
  assert.equal(md('1 606 112 €', 'fr-FR'), '1\u202f606\u202f112\u00a0€');
  assert.equal(md('38 % en 3 jours, 12 patients', 'fr'), '38\u00a0% en 3\u00a0jours, 12 patients');
  assert.equal(md('the team\'s 1 606 visits : 3 %'), 'the team’s 1 606 visits : 3 %');
});

test('a deck is in English unless its frontmatter says otherwise, and its quotes follow', () => {
  const en = render('<Slide title="t" />');
  assert.match(en.html, /<html lang="en">/);
  assert.match(render('---\ndate: 2026-10-01\n---\n<Cover title="t" date="2026-10-01" />').html, /1 October 2026/);
  const fr = render('---\nlang: fr-FR\n---\n<Cover title="t" date="2026-10-01" />');
  assert.match(fr.html, /<html lang="fr-FR">/);
  assert.match(fr.html, /1er octobre 2026/);
  const repoFr = render('<Cover title="t" date="2026-10-01" />', { defaultLang: 'fr' });
  assert.match(repoFr.html, /<html lang="fr">/, 'a repo whose paths.mjs says fr gets French when the deck says nothing');
  assert.match(render('---\nlang: en\n---\n<Slide title="t" />', { defaultLang: 'fr' }).html, /<html lang="en">/);
  const theme = readFileSync(join(HERE, 'theme.css'), 'utf8');
  assert.match(theme, /blockquote::before \{ content: open-quote/);
  assert.match(theme, /blockquote:lang\(fr\) \{ quotes: "\\00AB/);
  assert.ok(!/content: "«/.test(theme), 'no quote mark written into the theme');
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

test('copy rules: titles, paragraphs, kickers, the voice, figures that compare, the close, said twice', () => {
  const long = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ');
  const r = render(`---
title: x
date: 2026-10-09
audience: a
takeaway: b
---
<Slide chapter="One" kicker="Part one" title="A label that ends like a sentence."><Text>${long}</Text></Slide>
<Slide kicker="Again" title="A title that runs on well past the dozen words a title should ever need here"><Text>It is not just a tool. The result? A seamless journey.</Text></Slide>
<Slide title="Figures" source="Accounts"><Stats items={[{ value: "4", label: "schools" }, { value: "-38%", label: "heating" }, { value: "21 °C", label: "in January" }]} /></Slide>
<Slide title="Comparable" source="Accounts"><Stats items={[{ value: "-41%", label: "a" }, { value: "-38 %", label: "b" }]} /></Slide>
<Slide title="Said"><Quote text="It is not just a tool, it is a seamless journey." by="Someone" /><Text>The sensors measure every classroom temperature hourly during winter.</Text></Slide>
<Slide title="Again"><Text>Every classroom temperature is measured hourly by the sensors during winter.</Text></Slide>
<Closing title="Thank you" />`, { avoid: ['seamless', 'journey'] });
  const w = r.warnings.join('\n');
  assert.match(w, /slide 1 .*drop its closing full stop/);
  assert.match(w, /slide 1 .*45-word paragraph/);
  assert.match(w, /slide 2 .*words in the title/);
  assert.match(w, /slide 2 .*a kicker inside a part \(slide 1 opens it\)/);
  assert.match(w, /slide 2 .*antithesis/);
  assert.match(w, /slide 2 .*one-word question/);
  assert.match(w, /slide 2 .*“seamless” is on the voice's list/);
  assert.match(w, /slide 3 .*counted in plain numbers, “%”, “°c”/);
  assert.ok(!/slide 4 .*counted in/.test(w), 'one unit, written two ways, compares');
  assert.ok(!/slide 5 .*(antithesis|seamless)/.test(w), 'a quote is someone else\'s words');
  assert.match(w, /slide 6 .*says again what slide 5 says/);
  assert.match(w, /slide 7 .*closes on a thank-you/);
  assert.equal(r.errors.length, 0);
});

test('copy rules: a dash or an apposition comma in a title, a list is fine', () => {
  const r = render(`---
title: x
date: 2026-10-09
audience: a
takeaway: b
---
<Slide title="Our schools — warmer this winter"><Text>One.</Text></Slide>
<Slide title="Our schools, warmer this winter"><Text>Two.</Text></Slide>
<Slide title="Schools, clinics and libraries"><Text>Three.</Text></Slide>`);
  const w = r.warnings.join('\n');
  assert.match(w, /slide 1 .*a dash in a title/);
  assert.match(w, /slide 2 .*a comma in a title outside a list/);
  assert.ok(!/slide 3 .*comma/.test(w), 'a list of three is not an apposition');
});

test('copy rules: the words to avoid come from the voice, an entry with a qualifier is left to a reader', () => {
  assert.deepEqual(wordsToAvoid('x\n\n**Words to avoid.** delve, landscape (as an abstract noun), robust, and genuinely / truly / actually used as intensifiers. **This list is meant to be edited.**'), ['delve', 'robust', 'genuinely', 'truly']);
  assert.deepEqual(wordsToAvoid('# Voice\n\nNothing here.'), []);
  assert.deepEqual(['€2.1M', '2,1 M€', '48,000 €', '1,240', '-38 %', '12k'].map(unitOf), ['€', '€', '€', '', '%', '']);
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

test('a token read with no fallback and never defined stops the build', async () => {
  const found = undefinedTokens([
    { label: 'kit', css: ':root { --a: 1px; }\n/* var(--in-a-comment) */\n.x { gap: var(--a); margin: var(--b, 2px); color: var(--gone); width: var(--cols); }' },
  ], ['style="--cols:${n}"']);
  assert.deepEqual(found, [{ token: '--gone', where: 'kit' }]);
  const dir = mkdtempSync(join(tmpdir(), 'deck-tokens-'));
  mkdirSync(join(dir, 'brand'));
  writeFileSync(join(dir, 'brand', 'theme.css'), '.dk-card { background: var(--card-ground); }');
  writeFileSync(join(dir, 'deck.mdx'), '<Slide title="t" />');
  const r = await buildDeck(join(dir, 'deck.mdx'), { root: dir, tokens: [], brand: join(dir, 'brand'), decks: [dir] }, { log: () => {} });
  assert.match(r.errors.join('\n'), /brand\/theme\.css: var\(--card-ground\) is read but never defined/);
  assert.equal(r.out, null);
});

test('the component catalogue and the agentic-organization starter build without an error, and show every component', async () => {
  const paths = { tokens: [], brand: join(HERE, 'no-brand'), decks: [], assetMode: 'link' };
  const examples = [join(HERE, 'examples', 'deck.mdx'), join(HERE, 'examples', 'agentic-organization', 'deck.mdx')];
  for (const f of examples) {
    const r = await buildDeck(f, paths, { outFile: join(mkdtempSync(join(tmpdir(), 'deck-')), 'index.html'), log: () => {} });
    assert.deepEqual(r.errors, [], f);
    assert.ok(r.slides.length >= 18, f);
  }
  const shown = examples.map((f) => readFileSync(f, 'utf8')).join('\n');
  assert.deepEqual(Object.keys(components).filter((name) => !shown.includes(`<${name}`)), [], 'every component appears in an example deck');
});

test('agentic blocks: the markup is the finished state, what plays is marked, the impossible is refused', () => {
  const r = render(`<Slide title="t"><Redraw
    chat={[{ who: "Agent", text: "Here is the plan." }, { who: "You", me: true, text: "The dimensions overlap." }, { who: "Agent", text: "Redrawn, and the rule is written." }]}
    plan={{ title: "Frame", w: "1,200", wi: "1,080", h: "1,500", hi: "1,380" }}
    rule={{ name: "rules/plans.md", lines: ["## Legibility"], add: "+ two dimensions never overlap" }} /></Slide>
<Slide title="t"><Regen inputs={[{ title: "A meeting", file: "pilot.md", add: "+ start: 15 Dec" }]} slide={{ before: "Before", after: "After", by: 0 }} /></Slide>
<Slide title="t"><FolderTree items={[{ name: "a/" }, { name: "b.md", depth: 1 }, { name: "c/", depth: 1 }, { name: "d.md", depth: 2 }, { name: "e.md" }]} /></Slide>`);
  assert.deepEqual(r.errors, []);
  assert.ok(!/is-playing|class="[^"]*\b(on|hit)\b/.test(r.html), 'nothing is mid-story in the markup');
  assert.match(r.html, /class="dk-block dk-redraw" data-play="[\d ]+"/);
  assert.match(r.html, /dk-redraw-num is-move-x[^>]*>1,080</);
  assert.match(r.html, /dk-file-add" data-at="4">\+ two dimensions never overlap/);
  assert.match(r.html, /dk-regen-slide" data-at="3"/);
  const pre = [...r.html.matchAll(/dk-tree-pre" aria-hidden="true">([^<]*)<\/span>[\s\S]*?dk-tree-name">([^<]*)</g)].map((m) => `${m[1]}${m[2]}`);
  assert.deepEqual(pre, ['├─ b.md', '└─ c/', '   └─ d.md']);
  const bad = render(`<Slide title="t"><Cycle center={{ title: "c" }} steps={[{ title: "1" }, { title: "2" }, { title: "3" }, { title: "4" }, { title: "5" }, { title: "6" }, { title: "7" }]} /></Slide>
<Slide title="t"><Redraw chat={[{ text: "a" }, { text: "b" }]} rule={{ name: "r.md" }} /></Slide>
<Slide title="t"><Regen inputs={[{ title: "a", file: "f.md", add: "+" }]} demo={{ ask: "q", answer: "a", by: 2 }} /></Slide>
<Slide title="t"><Survey total={5} levels={{ items: [{ n: 4, title: "a" }, { n: 3, title: "b" }] }} /></Slide>`).errors.join('\n');
  assert.match(bad, /Cycle takes three to six steps/);
  assert.match(bad, /Redraw draws one figure/);
  assert.match(bad, /by=2 names no input/);
  assert.match(bad, /count 7 people in a room of 5/);
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
test('a block that plays empties when its slide opens and settles on its markup; with less motion it never moves', { skip: !chrome && 'no Chrome on this machine' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deck-play-'));
  writeFileSync(join(dir, 'deck.mdx'), `<Slide title="One"><Text>Nothing moves here.</Text></Slide>
<Slide title="Two"><Redraw chat={[{ who: "Agent", text: "Here is the plan." }, { who: "You", me: true, text: "The dimensions overlap." }]}
  plan={{ w: "1,200", wi: "1,080", h: "1,500", hi: "1,380" }} rule={{ name: "rules/plans.md", add: "+ never overlap" }} /></Slide>`);
  const b = await buildDeck(join(dir, 'deck.mdx'), { tokens: [], brand: join(dir, 'brand'), decks: [dir] }, { log: () => {} });
  assert.deepEqual(b.errors, []);
  const { withChrome, openTab } = await import('./chrome.mjs');
  const state = `(() => { const r = document.querySelector('.dk-slide[data-active] .dk-redraw'); const btn = document.querySelector('[data-act="replay"]');
    return { live: document.documentElement.classList.contains('dk-live'), playing: !!r?.classList.contains('is-playing'), step: r?.dataset.step ?? null,
      marked: r ? r.querySelectorAll('.on, .hit').length : -1, replay: !btn.hidden }; })()`;
  await withChrome(async (port) => {
    const tab = await openTab(port);
    await tab.navigate(`${pathToFileURL(b.out).href}#2`);
    const opened = await tab.evaluate(state);
    assert.deepEqual([opened.live, opened.playing, opened.replay], [true, true, true], JSON.stringify(opened));
    await tab.evaluate("window.dispatchEvent(new Event('beforeprint'))");
    assert.deepEqual(await tab.evaluate(state), { live: true, playing: false, step: null, marked: 0, replay: true }, 'printing settles it on its markup');
    await tab.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }))");
    assert.equal((await tab.evaluate(state)).playing, true, 'R plays it again');
    await tab.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))");
    assert.equal(await tab.evaluate("document.querySelector('.dk-slide[data-n=\\'2\\'] .dk-redraw').classList.contains('is-playing')"), false, 'leaving the slide settles it');
    assert.equal(await tab.evaluate("document.querySelector('[data-act=\\'replay\\']').hidden"), true, 'no replay on a slide with nothing to play');
    await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await tab.navigate('about:blank');
    await tab.navigate(`${pathToFileURL(b.out).href}#2`);
    assert.deepEqual(await tab.evaluate(state), { live: false, playing: false, step: null, marked: 0, replay: false }, 'less motion: the finished state, and nothing to replay');
    tab.close();
  });
});
test('the browser check finds what overflows, what lies over its neighbour, what is unequal or cramped, what is bunched', { skip: !chrome && 'no Chrome on this machine' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deck-check-'));
  mkdirSync(join(dir, 'brand'));
  // A theme mistake that pushes one block over the next: every edge of the slide stays clean, so
  // only the overlap check can see it (a dense slide shipped that way once, measured "0 defects").
  writeFileSync(join(dir, 'brand', 'theme.css'), '#pile .dk-callout + .dk-callout { margin-top: -60px; }\n#left .dk-quote { justify-content: flex-start; }\n#tight .dk-callout + .dk-callout { margin-top: -24px; }');
  const deck = join(dir, 'deck.mdx');
  const long = Array.from({ length: 14 }, (_, i) => `"Point numéro ${i + 1}, assez long pour prendre toute une ligne de la slide quand il est affiché"`).join(', ');
  writeFileSync(deck, `<Slide title="Trop plein"><Bullets items={[${long}]} /></Slide>
<Slide title="Cartes"><Cards items={[{ title: "Une", text: "courte" }, { title: "Deux", text: "une carte beaucoup plus longue que l'autre, sur plusieurs lignes, pour que la rangée soit inégale si rien ne l'égalise" }]} /></Slide>
<Slide title="Propre"><Stats items={[{ value: "4", label: "écoles" }, { value: "96", label: "classes" }]} /></Slide>
<Slide id="pile" title="Empilé"><Callout>Une première phrase</Callout><Callout tone="next">Une seconde phrase</Callout></Slide>
<Slide title="Ce qu'ils disent"><Quote text="Ça marche." by="Une enseignante" /></Slide>
<Slide id="left" title="Ce qu'ils disent"><Quote text="Ça marche." by="Une enseignante" /></Slide>
<Slide id="tight" title="Serré"><Callout>Une première phrase</Callout><Callout tone="next">Une seconde phrase</Callout></Slide>`);
  const paths = { tokens: [], brand: join(dir, 'brand'), decks: [dir], assetMode: 'link' };
  const b = await buildDeck(deck, paths, { log: () => {} });
  assert.deepEqual(b.errors, []);
  const r = await checkDeck(b.out, { shots: false, contrast: false });
  assert.ok(!r.skipped, r.skipped);
  assert.ok(r.defects.some((d) => d.n === 1 && ['overflow', 'margin'].includes(d.issue)), JSON.stringify(r.defects));
  assert.ok(!r.defects.some((d) => d.n === 2 && d.issue === 'grid'), 'cards in a row are equalised by the theme');
  assert.ok(!r.defects.some((d) => d.n === 3), JSON.stringify(r.defects.filter((d) => d.n === 3)));
  assert.ok(r.defects.some((d) => d.n === 4 && d.issue === 'overlap'), JSON.stringify(r.defects.filter((d) => d.n === 4)));
  const bunched = (n) => r.warnings.some((w) => w.n === n && w.issue === 'bunched');
  assert.ok(!bunched(5), 'a quote alone on its slide sits in the middle, it is not bunched');
  assert.ok(bunched(6), 'the same quote pushed to the left of an empty slide still is');
  assert.ok(r.defects.some((d) => d.n === 7 && d.issue === 'cramped'), JSON.stringify(r.defects.filter((d) => d.n === 7)));
  assert.ok(!r.defects.some((d) => d.issue === 'cramped' && d.n !== 7), JSON.stringify(r.defects.filter((d) => d.issue === 'cramped')));
});
