// The intranet: the owner's banner and tools parsed from source/content/, who waits on what, the
// pages rendered, the build run end to end on an invented workspace, and the extension point
// (apps/dashboard/extend.mjs) run with the invented example in apps/dashboard/example-extension/.
// An instance's own extension, when it has one, is built here too, and its tests run with these.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  parseHome, parseTools, waiting, stats, homePage, projectsPage, projectPage, renderIntranet,
} from '../apps/dashboard/intranet.mjs';
import { loadExtension, brokenLinks, EXTENSION } from '../apps/dashboard/extend.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = '2026-10-30';

const project = (over = {}) => ({
  slug: 'brochure', title: 'Spring brochure', stage: 'active', repo: null, countsOnly: false,
  page: 'projects/brochure/', counts: { open: 0, done: 0 }, open: [], latest: [], log: [], ...over,
});
const item = (text, over = {}) => ({ text, owners: [], due: null, tags: [], id: null, note: null, ...over });
const data = (projects = [], over = {}) => ({
  generated: '2026-10-30T10:00:00Z', org: 'Riverside <Co-op>', repos: ['x'], private: [], projects, recap: [], ...over,
});

test('the banner: title, lede, one column per section, comments dropped', () => {
  const h = parseHome('# Start here\n<!-- a note for the agent -->\nThe lede.\n\n## Quickstart\n1. Open it\n\n## Empty\n\n## How this works\nOne source.\n');
  assert.equal(h.title, 'Start here');
  assert.equal(h.lede, 'The lede.');
  assert.deepEqual(h.sections.map((s) => s.heading), ['Quickstart', 'How this works']);
  assert.equal(h.sections[0].id, 'quickstart');
  assert.equal(parseHome(''), null);
  assert.equal(parseHome('<!-- only a comment -->'), null);
});

test("the kit's own banner parses into a quickstart and the philosophy", () => {
  const h = parseHome(readFileSync(join(ROOT, 'source/content/intranet-home.md'), 'utf8'));
  assert.ok(h.title && h.lede);
  assert.ok(h.sections.length >= 2);
  assert.ok(h.sections.some((s) => /quickstart|démarrage rapide/i.test(s.heading)), 'a quickstart section, in English or in French');
  assert.ok(!/TODO/.test(JSON.stringify(h)), 'the default banner ships ready to read');
});

test('tools: a list line each, TODO and unsafe schemes unpublished, a relative path kept', () => {
  const tools = parseTools([
    '# Tools', 'Prose is ignored.',
    '- [To-dos](TODO) Tick an item.',
    '- [Site](https://example.org) · The public site.',
    '- [Packs](packs/) What installs here.',
    '- [Bad](javascript:alert(1)) Never a link.',
    '<!-- - [Hidden](https://x.example) -->',
  ].join('\n'));
  assert.deepEqual(tools.map((x) => [x.label, x.href]), [
    ['To-dos', null], ['Site', 'https://example.org'], ['Packs', 'packs/'], ['Bad', null],
  ]);
  assert.equal(tools[1].text, 'The public site.');
});

test('who waits on what: by person, decisions then late first, nobody last, private projects skipped', () => {
  const projects = [
    project({ open: [
      item('Write the back cover', { owners: ['rae'] }),
      item('Pick the paper', { owners: ['rae'], tags: ['decide'] }),
      item('Chase the printer', { owners: ['sam', 'rae'], due: '2026-10-20' }),
      item('Unowned'),
    ] }),
    project({ slug: 'grant', title: 'Grant', countsOnly: true, open: [item('Hidden', { owners: ['sam'] })] }),
  ];
  const w = waiting(projects, TODAY);
  assert.deepEqual(w.map((x) => x.who), ['rae', 'sam', null]);
  assert.deepEqual(w[0].items.map((i) => i.text), ['Pick the paper', 'Chase the printer', 'Write the back cover']);
  assert.equal(w[0].items[1].late, true);
  assert.equal(w[0].items[0].page, 'projects/brochure/');
  assert.ok(!w.flatMap((x) => x.items).some((i) => i.text === 'Hidden'));
});

test('the tiles are counted from the data', () => {
  const s = stats([
    project({ counts: { open: 3, done: 1 }, open: [item('a', { due: '2026-10-01' }), item('b', { tags: ['decide'] }), item('c', { due: '2026-11' })] }),
    project({ stage: 'done', counts: { open: 0, done: 4 } }),
    project({ countsOnly: true, counts: { open: 2, done: 0 } }),
  ], TODAY);
  assert.deepEqual(s, { running: 2, open: 5, late: 1, decide: 1 });
});

test('the home page: banner first, collapsible, the owner text escaped, tools as cards', () => {
  const home = parseHome('# Start <here>\nLede\n## Quickstart\n1. Say `hello`');
  const tools = parseTools('- [To-dos](TODO) Tick.\n- [Packs](packs/) Catalogue.');
  const html = homePage({ data: data([project({ counts: { open: 1, done: 0 }, open: [item('Do <it>', { owners: ['sam'] })] })]), home, tools, today: TODAY });
  assert.ok(html.indexOf('class="banner"') < html.indexOf('class="tiles"'), 'the banner sits above the dashboards');
  assert.match(html, /<details class="banner" id="start" open>/);
  assert.match(html, /localStorage/);
  assert.match(html, /Start &lt;here&gt;/);
  assert.match(html, /Riverside &lt;Co-op&gt;/);
  assert.match(html, /Do &lt;it&gt;/);
  assert.match(html, /<code>hello<\/code>/);
  assert.match(html, /Who waits on what/);
  assert.match(html, /<a href="packs\/">Packs<\/a>/);
  assert.match(html, /To-dos <em class="badge">not published yet<\/em>/);
  assert.match(html, /<a href="" aria-current="page" class="on">Home<\/a>/);
  assert.equal((html.match(/<nav class="tabs"/g) || []).length, 1, 'one row of tabs');
});

test('an empty workspace still gets the banner, the tools and a way to start', () => {
  const html = homePage({ data: data(), home: parseHome('# Start here\nHi'), tools: [], today: TODAY });
  assert.match(html, /start tracking/);
  assert.doesNotMatch(html, /class="tiles"/);
  assert.match(html, /class="banner"/);
  assert.doesNotMatch(homePage({ data: data(), home: null, tools: [], today: TODAY }), /class="banner"/);
});

test('projects: a sidebar beside the page, folded into one control for a phone', () => {
  const p = project({ counts: { open: 1, done: 0 }, open: [item('Chase', { note: 'Third time' })], log: [{ date: '2026-10-28', text: 'Proof back' }] });
  const d = data([p, project({ slug: 'grant', title: 'Grant', page: 'projects/grant/', countsOnly: true })]);
  const one = projectPage({ data: d, project: p, today: TODAY });
  assert.match(one, /<aside class="side"/);
  assert.match(one, /<details class="side-fold"><summary>Projects · Spring brochure<\/summary>/);
  assert.match(one, /href="..\/..\/projects\/brochure\/" aria-current="page"/);
  assert.match(one, /aria-current="page" class="on">Projects/);
  assert.match(one, /Third time/);
  assert.match(one, /Proof back/);
  const grant = projectPage({ data: d, project: d.projects[1], today: TODAY });
  assert.match(grant, /details kept in its own repo/);
  assert.match(projectsPage({ data: d, today: TODAY }), /All projects/);
  assert.deepEqual(Object.keys(renderIntranet({ data: d, home: null, tools: [], css: '', today: TODAY })).sort(),
    ['index.html', 'intranet.css', 'projects/brochure/index.html', 'projects/grant/index.html', 'projects/index.html']);
});

test('the build: npm run intranet on an invented workspace writes every page', () => {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-'));
  try {
    for (const d of ['source/brand', 'source/content', 'projects/brochure']) mkdirSync(join(dir, d), { recursive: true });
    copyFileSync(join(ROOT, 'source/brand/tokens.css'), join(dir, 'source/brand/tokens.css'));
    writeFileSync(join(dir, 'source/brief.md'), '# Brief: Riverside Co-op\n');
    writeFileSync(join(dir, 'source/content/intranet-home.md'), '# Start here\nWelcome.\n## Quickstart\n1. Say hello\n');
    writeFileSync(join(dir, 'source/content/intranet-tools.md'), '- [Packs](packs/) The catalogue.\n');
    writeFileSync(join(dir, 'projects/brochure/charter.md'), '# Spring brochure\nStage: active\n');
    writeFileSync(join(dir, 'projects/brochure/next-steps.md'), '- [ ] Pick the paper @rae #decide ^ab12\n- [x] Cover @sam done:2026-10-14 ^cd34\n');
    writeFileSync(join(dir, 'projects/brochure/log.md'), '- 2026-10-28: Proof back.\n');
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts/dashboard-data.mjs')], { cwd: dir, encoding: 'utf8' });
    assert.match(out, /intranet: banner, 1 tool\(s\), 1 project\(s\)/);
    const dist = join(dir, 'apps/dashboard/dist');
    for (const f of ['index.html', 'intranet.css', 'tokens.css', 'data.json', 'projects/index.html', 'projects/brochure/index.html']) {
      assert.ok(existsSync(join(dist, f)), f);
    }
    const home = readFileSync(join(dist, 'index.html'), 'utf8');
    assert.match(home, /Riverside Co-op/);
    assert.match(home, /Welcome\./);
    assert.match(home, /to decide/);
    const json = JSON.parse(readFileSync(join(dist, 'data.json'), 'utf8'));
    assert.deepEqual(json.projects[0].open[0].tags, ['decide']);
    assert.equal(json.projects[0].page, 'projects/brochure/');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- the extension point

const EXAMPLE = join(ROOT, 'apps/dashboard/example-extension/index.mjs');

/** An invented workspace for the co-op of the example, built with or without an extension. */
function coop({ extend = EXAMPLE, files = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-ext-'));
  const w = (rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
  copyFileSync(join(ROOT, 'source/brand/tokens.css'), (mkdirSync(join(dir, 'source/brand'), { recursive: true }), join(dir, 'source/brand/tokens.css')));
  w('source/brief.md', '# Brief: Riverside Co-op\n');
  w('source/content/intranet-home.md', '# Start here\nWelcome.\n## Quickstart\n1. Say hello\n');
  w('source/content/intranet-tools.md', '- [Packs](packs/) The catalogue.\n');
  w('projects/brochure/charter.md', '# Spring brochure\nStage: active\n');
  w('projects/brochure/next-steps.md', '- [ ] Pick the paper @rae #decide ^ab12\n');
  w('rota.md', '- 2099-11-02 · @sam · Opening shift\n- 2099-11-03 · @nobody · Evening close\n');
  w('notices.md', '## Paint day\nBring old clothes.\n');
  for (const [rel, text] of Object.entries(files)) w(rel, text);
  const args = [join(ROOT, 'scripts/dashboard-data.mjs'), ...(extend ? [`--extend=${extend}`] : [])];
  const out = execFileSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });
  const dist = join(dir, 'apps/dashboard/dist');
  const read = (rel) => readFileSync(join(dist, rel), 'utf8');
  return { dir, dist, out, read, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('no extension: the pages are the kit\'s own, with two tabs and no script for them', () => {
  const b = coop({ extend: null });
  try {
    const home = b.read('index.html');
    assert.doesNotMatch(home, /class="top many"/);
    assert.doesNotMatch(home, /scrollLeft/);
    assert.doesNotMatch(b.out, /\+ /);
    assert.doesNotMatch(b.read('intranet.css'), /extend\.mjs/);
    // The same build through renderIntranet with no extension, and with an explicit null, agree.
    const data = JSON.parse(b.read('data.json'));
    const a = renderIntranet({ data, home: null, tools: [], css: 'x', today: TODAY });
    assert.deepEqual(a, renderIntranet({ data, home: null, tools: [], css: 'x', today: TODAY, extension: null }));
  } finally { b.done(); }
});

test('the example extension: its tabs in the one row, its pages in the kit\'s shell, its sections in their slots', () => {
  const b = coop();
  try {
    assert.match(b.out, /\+ .*example-extension\/index\.mjs: 3 tab\(s\), 4 page\(s\), 2 home section\(s\), its styles/);
    const home = b.read('index.html');
    const row = home.match(/<nav class="tabs"[^>]*>(.*?)<\/nav>/)[1];
    assert.deepEqual([...row.matchAll(/href="([^"]*)"/g)].map((m) => m[1]), ['', 'rota/', 'rooms/', 'projects/', 'notices/'],
      'added before Projects by default, in the order added; `after` places one behind');
    assert.equal((home.match(/<nav class="tabs"/g) || []).length, 1, 'one row of tabs');
    assert.match(home, /<header class="top many">/);
    assert.match(home, /scrollLeft/, 'past two tabs the row starts with the current one in view');
    // Slots: top under the banner and above the numbers, before-tools above the tools.
    const at = (s) => home.indexOf(s);
    assert.ok(at('class="banner"') < at('This week at the co-op') && at('This week at the co-op') < at('project running'));
    assert.ok(at('Who waits on what') < at('Latest notice') && at('Latest notice') < at('id="tools"'));
    // A page in the shell, with its sidebar, its tab current, links written for its depth.
    const swaps = b.read('rota/swaps/index.html');
    assert.match(swaps, /<title>Shifts to fill · Riverside Co-op<\/title>/);
    assert.match(swaps, /<a href="..\/..\/rota\/" aria-current="page" class="on">Rota<\/a>/);
    assert.match(swaps, /<aside class="side" aria-label="Rota">/);
    assert.match(swaps, /<a href="..\/..\/rota\/swaps\/" aria-current="page">Shifts to fill<\/a>/);
    assert.match(swaps, /<summary>Rota · Shifts to fill<\/summary>/);
    assert.match(swaps, /Evening close/);
    assert.match(b.read('rooms/index.html'), /<main class="wrap"><h1>Rooms<\/h1><p class="empty">/, 'a missing file is an empty state');
    // The kit's own pages carry the new tabs too.
    assert.match(b.read('projects/brochure/index.html'), /href="..\/..\/notices\/"/);
    // Styles: the kit's, its pieces for extensions, then the extension's, named.
    const css = b.read('intranet.css');
    assert.ok(css.indexOf('.with-side') < css.indexOf('.top.many') && css.indexOf('.top.many') < css.indexOf('.coop-notice'));
    assert.match(css, /\/\* ---- \S*example-extension\/example\.css ---- \*\//);
    // Every internal link resolves to a built page.
    const files = {};
    for (const rel of ['index.html', 'projects/index.html', 'projects/brochure/index.html', 'rota/index.html', 'rota/swaps/index.html', 'rooms/index.html', 'notices/index.html', 'intranet.css', 'tokens.css']) files[rel] = b.read(rel);
    assert.deepEqual(brokenLinks(files, { also: ['packs/index.html'] }), []);
  } finally { b.done(); }
});

test('the contract refuses what would break a page: an unknown slot, a taken path, a colour, a page with no body', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-api-'));
  const data = { generated: '2026-10-30T10:00:00Z', org: 'Riverside Co-op', repos: [], private: [], projects: [], recap: [] };
  const load = async (code) => {
    const file = join(dir, `ext-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(file, code);
    return loadExtension({ root: dir, data, today: TODAY, file });
  };
  try {
    assert.equal(await loadExtension({ root: dir, data, today: TODAY }), null, `no ${EXTENSION}, no extension`);
    await assert.rejects(load("export default (i) => i.home('sidebar', () => '');"), /no home slot "sidebar"/);
    await assert.rejects(load("export default (i) => { i.tab('rota/', 'Rota'); i.tab('rota/', 'Rota'); };"), /added twice/);
    await assert.rejects(load("export default (i) => i.tab('rota', 'Rota');"), /must be a folder/);
    await assert.rejects(load("export default (i) => i.page('../x/', () => ({ body: '' }));"), /relative path inside/);
    await assert.rejects(load("export default (i) => i.css('.x { color: #c00; }');"), /writes a colour \(#c00/);
    await assert.rejects(load("export default (i) => i.css('.x { background: rgb(0 0 0); }');"), /writes a colour/);
    await load("export default (i) => i.css('/* #fff in a comment is fine */ .x { color: var(--color-ink); }');");
    await assert.rejects(load('export const nothing = 1;'), /must export a default function/);
    const taken = await load("export default (i) => i.page('projects/', () => ({ body: 'mine' }));");
    assert.throws(() => renderIntranet({ data, home: null, tools: [], css: '', today: TODAY, extension: taken }), /projects\/index\.html is already a page of the kit's/);
    const empty = await load("export default (i) => i.page('x/', () => ({ title: 'X' }));");
    assert.throws(() => renderIntranet({ data, home: null, tools: [], css: '', today: TODAY, extension: empty }), /rendered no body/);
    // A string is a whole file, written as given; the kit's words can be translated.
    const raw = await load("export default (i) => { i.strings({ 'nav.home': 'Accueil' }); i.page('feed.json', () => '{}'); i.page('a/b/', (c) => ({ body: `<a href=\"${c.href('projects/')}\">p</a>`, tab: '' })); };");
    const files = renderIntranet({ data, home: null, tools: [], css: '', today: TODAY, extension: raw });
    assert.equal(files['feed.json'], '{}');
    assert.match(files['a/b/index.html'], /<a href="..\/..\/projects\/">p<\/a>/);
    assert.match(files['a/b/index.html'], /aria-current="page" class="on">Accueil</);
    assert.match(files['index.html'], />Accueil</);
    // The translation lasted one render: the kit's own pages are back to the kit's words.
    assert.match(homePage({ data, home: null, tools: [], today: TODAY }), />Home</);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the link check finds a page nobody built', () => {
  const page = (body) => `<a href="${body}">x</a>`;
  assert.deepEqual(brokenLinks({
    'index.html': page('rota/') + page('https://example.org') + page('#top') + page('/cdn-cgi/access/logout'),
    'rota/index.html': page('../') + page('../rooms/') + page('../tokens.css'),
  }, { also: ['tokens.css'] }), [{ file: 'rota/index.html', href: '../rooms/' }]);
});

// ---------------------------------------------------------------- this instance's own extension

const OWN = join(ROOT, EXTENSION);
if (existsSync(OWN)) {
  test(`this instance's extension (${EXTENSION}) builds, and every page it links to exists`, () => {
    const out = mkdtempSync(join(tmpdir(), 'intranet-own-'));
    try {
      execFileSync(process.execPath, [join(ROOT, 'scripts/dashboard-data.mjs'), `--out=${out}`], { cwd: ROOT, encoding: 'utf8' });
      const files = {};
      const walk = (rel) => {
        for (const e of readdirSync(join(out, rel), { withFileTypes: true })) {
          const r = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDirectory()) walk(r); else files[r] = readFileSync(join(out, r), 'utf8');
        }
      };
      walk('');
      for (const [f, html] of Object.entries(files)) if (f.endsWith('.html')) assert.doesNotMatch(html, />(undefined|NaN|\[object Object\])</, `${f} prints a missing value`);
      assert.deepEqual(brokenLinks(files), []);
    } finally { rmSync(out, { recursive: true, force: true }); }
  });
}
// Its own tests, beside it, run with the kit's: an instance contributes tests without touching package.json.
const OWN_TESTS = join(dirname(OWN), 'test.mjs');
if (existsSync(OWN_TESTS)) await import(pathToFileURL(OWN_TESTS).href);
