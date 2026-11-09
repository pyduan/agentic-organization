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
  parseHome, parseTools, waiting, stats, homePage, projectsPage, projectPage, renderIntranet, bannerTitle, HIDE_KEYS, typeset,
} from '../apps/dashboard/intranet.mjs';
import { loadExtension, brokenLinks, EXTENSION } from '../apps/dashboard/extend.mjs';
import {
  ring, stackedBar, gauge, kpi, initials, statusChip, checkbox, checkboxScript, span, gantt, pct, todoSourceId,
} from '../apps/dashboard/components.mjs';

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

// This file is the instance's own once installed, and an instance may turn its banner off by
// emptying it or deleting it: then there is nothing to check.
const OWN_HOME = join(ROOT, 'source/content/intranet-home.md');
const ownHome = existsSync(OWN_HOME) ? parseHome(readFileSync(OWN_HOME, 'utf8')) : null;
test("this repository's banner parses into a quickstart and the philosophy", { skip: ownHome ? false : 'no banner: intranet-home.md is missing or empty' }, () => {
  const h = ownHome;
  assert.ok(h.lede);
  assert.ok(h.sections.length >= 2);
  const quick = /quickstart|first steps|démarrage rapide|premiers pas/i;
  assert.ok(quick.test(h.title || 'Quickstart') || h.sections.some((s) => quick.test(s.heading)), 'a quickstart, as the title or a column, in English or in French');
  assert.equal(new Set(h.sections.map((s) => s.heading.toLowerCase())).has(String(h.title).toLowerCase()), false, 'no column repeats the title');
  assert.ok(!/TODO/.test(JSON.stringify(h)), 'the default banner ships ready to read');
});

test("the banner's title never repeats the organization's name", () => {
  assert.equal(bannerTitle('Volunteer handbook', 'Riverside Co-op'), 'Volunteer handbook');
  for (const title of [null, '', '  ', 'Riverside Co-op', 'riverside  CO-OP', 'Start here', 'start HERE']) assert.equal(bannerTitle(title, 'Riverside Co-op'), null, String(title));
  assert.equal(bannerTitle('Crèche Les Étoiles', 'Creche les etoiles'), null, 'accents and case aside');
  const title = (md, over = {}) => homePage({ data: data([], { org: 'Riverside Co-op' }), home: parseHome(md), tools: [], today: TODAY, ...over })
    .match(/<span class="banner-title">(.*?)<\/span>/)[1];
  assert.equal(title('# Riverside Co-op\nHi'), 'Quickstart');
  assert.equal(title('Hi, no heading'), 'Quickstart');
  assert.equal(title('# Start here\nHi'), 'Quickstart', "the kit's old default reads as no heading");
  assert.equal(title('# Before your first shift\nHi'), 'Before your first shift');
});

test('the banner translates its default title through the extension\'s strings', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-title-'));
  try {
    const file = join(dir, 'ext.mjs');
    writeFileSync(file, "export default (i) => i.strings({ 'banner.title': 'Démarrage rapide' });");
    const d = data([], { org: 'Riverside Co-op' });
    const extension = await loadExtension({ root: dir, data: d, today: TODAY, file });
    const html = renderIntranet({ data: d, home: parseHome('# Riverside Co-op\nHi'), tools: [], css: '', today: TODAY, extension })['index.html'];
    assert.match(html, /<span class="banner-title">Démarrage rapide<\/span>/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
    assert.match(b.out, /\+ .*example-extension\/index\.mjs: 4 tab\(s\), 5 page\(s\), 2 home section\(s\), its styles/);
    const home = b.read('index.html');
    const row = home.match(/<nav class="tabs"[^>]*>(.*?)<\/nav>/)[1];
    assert.deepEqual([...row.matchAll(/href="([^"]*)"/g)].map((m) => m[1]), ['', 'rota/', 'rooms/', 'checklist/', 'projects/', 'notices/'],
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
    for (const rel of ['index.html', 'projects/index.html', 'projects/brochure/index.html', 'rota/index.html', 'rota/swaps/index.html', 'rooms/index.html', 'checklist/index.html', 'notices/index.html', 'intranet.css', 'tokens.css']) files[rel] = b.read(rel);
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

test('sections that outgrow one row: a sidebar of grouped sections, one menu on a phone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-nav-'));
  const data = { generated: '2026-10-30T10:00:00Z', org: 'Riverside Co-op', repos: [], private: [], projects: [], recap: [] };
  const load = async (code) => {
    const file = join(dir, `ext-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(file, code);
    return loadExtension({ root: dir, data, today: TODAY, file });
  };
  const build = (extension) => renderIntranet({ data, home: null, tools: [], css: '', today: TODAY, extension });
  const sections = (html) => [...html.match(/<aside class="nav-side">.*?<\/aside>/s)[0].matchAll(/<p class="nav-group-label">([^<]*)<\/p>|href="([^"]*)"/g)]
    .map((m) => m[1] ?? m[2]);
  try {
    // Six sections stay a row; the seventh moves them all to the sidebar, in the row's order.
    const tabs = (n) => `export default (i) => { ${Array.from({ length: n }, (_, k) => `i.tab('s${k}/', 'S${k}'); i.page('s${k}/', () => ({ title: 'S${k}', body: 'x' }));`).join(' ')} };`;
    const six = build(await load(tabs(4)))['index.html'];
    assert.match(six, /<header class="top many">/);
    assert.doesNotMatch(six, /nav-side/);
    const seven = build(await load(tabs(5)));
    assert.doesNotMatch(seven['index.html'], /<nav class="tabs"/, 'never a row and a sidebar at once');
    assert.match(seven['index.html'], /<body class="has-nav">/);
    assert.deepEqual(sections(seven['index.html']), ['', '', 's0/', 's1/', 's2/', 's3/', 's4/', 'projects/'], 'the name, then Home and the sections');
    assert.match(seven['s2/index.html'], /<summary>S2<\/summary>/, 'on a phone the menu names the current section');
    assert.match(seven['s2/index.html'], /<a href="..\/s2\/" aria-current="page" class="on">S2<\/a>/);
    assert.doesNotMatch(seven['s2/index.html'], /scrollLeft/);

    // Groups: ungrouped sections first, then each heading over its tabs in the order it lists them,
    // the kit's own included. A group turns the sidebar on whatever the count.
    const grouped = build(await load(`export default (i) => {
      i.tab('rota/', 'Rota'); i.tab('rooms/', 'Rooms');
      i.group('Volunteers', ['rooms/', 'rota/']);
      i.group('Work', ['projects/']);
    };`))['projects/index.html'];
    assert.deepEqual(sections(grouped), ['../', '../', 'Volunteers', '../rooms/', '../rota/', 'Work', '../projects/']);
    assert.match(grouped, /<summary>Projects<\/summary>/);
    assert.doesNotMatch(grouped, /<aside class="side"/, 'Projects with no project page has no sidebar of its own: one link to itself is no navigation');

    await assert.rejects(load("export default (i) => i.group('Volunteers', ['rota/']);"), /names "rota\/", which is no tab/);
    await assert.rejects(load("export default (i) => { i.tab('rota/', 'Rota'); i.group('A', ['rota/']); i.group('B', ['rota/']); };"), /in two groups \(A and B\)/);
    await assert.rejects(load("export default (i) => { i.tab('rota/', 'Rota'); i.group('A', ['rota/']); i.group('A', ['']); };"), /declared twice/);
    await assert.rejects(load("export default (i) => i.group('A', []);"), /needs a label and a list/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("hide: an extension takes out the kit's sections it replaces, and the Projects tab", async () => {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-hide-'));
  const d = data([project({ counts: { open: 1, done: 0 }, open: [item('Pick the paper', { owners: ['rae'] })] })], {
    recap: [{ date: '2026-10-28', text: 'Proof back', project: 'Spring brochure', page: 'projects/brochure/' }], private: ['grants'],
  });
  const tools = parseTools('- [Packs](packs/) The catalogue.');
  const load = async (code) => {
    const file = join(dir, `ext-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(file, code);
    return loadExtension({ root: dir, data: d, today: TODAY, file });
  };
  const build = (extension) => renderIntranet({ data: d, home: parseHome('# Quickstart\nHi'), tools, css: '', today: TODAY, extension });
  const marks = {
    'home.tiles': /class="tiles"/, 'home.waiting': /id="waiting"/, 'home.projects': /id="projects"|Not read here/,
    'home.moved': /id="moved"/, 'home.tools': /id="tools"/,
  };
  try {
    const none = await load("export default (i) => i.tab('rota/', 'Rota');");
    assert.deepEqual(none.hide, []);
    const plain = build(none);
    for (const re of Object.values(marks)) assert.match(plain['index.html'], re);
    assert.deepEqual((await load("export default (i) => { i.hide(['home.tiles']); i.hide(['home.tiles', 'home.moved']); };")).hide, ['home.tiles', 'home.moved'], 'two calls add up, once each');
    for (const key of HIDE_KEYS.filter((k) => k.startsWith('home.'))) {
      const html = build(await load(`export default (i) => { i.tab('rota/', 'Rota'); i.hide(['${key}']); };`))['index.html'];
      assert.doesNotMatch(html, marks[key], `${key} hidden`);
      for (const [other, re] of Object.entries(marks)) if (other !== key) assert.match(html, re, `${other} kept when ${key} is hidden`);
      assert.match(html, /class="banner"/);
    }
    // An empty workspace: the empty state stands in for the project cards and goes with them.
    assert.doesNotMatch(homePage({ data: data(), home: null, tools: [], today: TODAY, hide: ['home.projects'] }), /start tracking/);

    const all = build(await load(`export default (i) => { i.hide(${JSON.stringify(HIDE_KEYS)}); i.home('top', () => '<h2>Ours</h2>'); };`));
    assert.match(all['index.html'], /<main class="wrap"><h2>Ours<\/h2><\/main>/, 'only the banner and the extension\'s own sections');
    const row = all['index.html'].match(/<nav class="tabs"[^>]*>(.*?)<\/nav>/)[1];
    assert.deepEqual([...row.matchAll(/href="([^"]*)"/g)].map((m) => m[1]), [''], 'no Projects tab');
    assert.ok(all['projects/index.html'] && all['projects/brochure/index.html'], 'the projects\' pages are still built');
    assert.doesNotMatch(all['projects/brochure/index.html'], /class="on">Projects/);
    assert.deepEqual(brokenLinks(all, { also: ['tokens.css'] }), []);

    await assert.rejects(load("export default (i) => i.hide(['home.banner']);"), /nothing called "home\.banner" to hide; the keys are home\.tiles/);
    await assert.rejects(load("export default (i) => i.hide('home.tiles');"), /needs a list of keys/);
    await assert.rejects(load("export default (i) => { i.hide(['tab.projects']); i.group('Work', ['projects/']); };"), /names "projects\/", which is no tab once hidden/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('without hide(), the build is byte for byte what it was', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-nohide-'));
  try {
    const d = data([project({ counts: { open: 1, done: 0 }, open: [item('Pick', { owners: ['rae'] })] })], { recap: [{ date: '2026-10-28', text: 'x', project: 'Spring brochure', page: 'projects/brochure/' }] });
    const file = join(dir, 'ext.mjs');
    writeFileSync(file, "export default (i) => i.tab('rota/', 'Rota');");
    const extension = await loadExtension({ root: dir, data: d, today: TODAY, file });
    const args = { data: d, home: parseHome('# Quickstart\nHi'), tools: parseTools('- [Packs](packs/) x'), css: '', today: TODAY };
    assert.deepEqual(renderIntranet({ ...args, extension }), renderIntranet({ ...args, extension: { ...extension, hide: [] } }));
    assert.equal(homePage({ ...args }), homePage({ ...args, hide: [] }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------- the components (components.mjs)

test('components: a ring clamps to 0..100, bars and gauges count, a chip and initials escape', () => {
  assert.match(ring(140), />100%</);
  assert.match(ring(-5), />0%</);
  assert.doesNotMatch(ring(0), /ui-ring-val/, 'nothing drawn at zero');
  assert.match(ring(42.4, { sub: '3/7', tone: 'late' }), /aria-label="42% done, 3\/7".*ui-t-late.*stroke-dasharray="42 58"/s);
  assert.match(ring(50, { tone: 'nonsense' }), /ui-t-ok/, 'an unknown tone falls back');
  assert.equal(stackedBar([{ n: 0, label: 'x', tone: 'ok' }]), '');
  assert.match(stackedBar([{ n: 1, label: 'held', tone: 'ok' }, { n: 3, label: 'to fill', tone: 'late' }]), /width:25\.00%.*width:75\.00%.*<b>1<\/b> held.*<b>3<\/b> to fill/s);
  assert.match(gauge(2, 8), /aria-label="2 of 8".*width:25%/s);
  assert.match(gauge(0, 0), /width:0%/);
  assert.equal(pct(1, 3), 33);
  assert.match(initials('Ada Lovelace-King'), />AL</);
  assert.match(initials('<b>'), /aria-label="&lt;b&gt;"/);
  assert.match(statusChip('<late>', 'late'), /class="ui-chip ui-chip-late">&lt;late&gt;</);
  assert.match(kpi({ visual: ring(10), label: 'Shifts', line: 'x', href: 'rota/', tone: 'warn' }), /^<a class="card ui-kpi ui-edge-warn" href="rota\/">/);
  assert.match(kpi({ label: 'Rooms' }), /^<div class="card ui-kpi">/);
  assert.equal(todoSourceId('projects/rota/next-steps.md'), 'projects-rota-next-steps');
});

test('components: a tick box without an id or a source is read-only, with both it is wired', () => {
  const ro = checkbox({ text: 'Lock up', done: true }, 'checklist');
  assert.doesNotMatch(ro, /<input/);
  assert.match(ro, /class="ui-check is-done is-static".*✓.*Lock up/s);
  assert.doesNotMatch(checkbox({ text: 'x', id: 'ab12' }, ''), /<input/);
  const live = checkbox({ text: 'Lock <up>', id: 'ab12', done: false }, 'checklist', { extra: '<em>x</em>' });
  assert.match(live, /^<label class="ui-check"><input type="checkbox" data-todo-source="checklist" data-todo-id="ab12">.*Lock &lt;up&gt;.*<em>x<\/em><\/label>$/s);
  const script = checkboxScript();
  for (const w of ['Saving', 'Saved in the repository', 'Not saved', 'do not save']) assert.ok(script.includes(w), w);
  assert.match(script, /\/api\/todos\?source=/);
  assert.match(script, /op: 'toggle'/);
});

test('components: span reads a day, an ISO week, a month, a year and a range', () => {
  assert.deepEqual(span('2026-11-09'), ['2026-11-09', '2026-11-09']);
  assert.deepEqual(span('2026-W46'), ['2026-11-09', '2026-11-15']);
  assert.deepEqual(span('2027-W01'), ['2027-01-04', '2027-01-10']);
  assert.deepEqual(span('2026-02'), ['2026-02-01', '2026-02-28']);
  assert.deepEqual(span('2028-02'), ['2028-02-01', '2028-02-29']);
  assert.deepEqual(span('2026'), ['2026-01-01', '2026-12-31']);
  assert.deepEqual(span('2026-11-02..2026-11-20'), ['2026-11-02', '2026-11-20']);
  assert.deepEqual(span('2026-11-20..2026-11-02'), ['2026-11-02', '2026-11-20']);
  for (const bad of ['', null, 'soon', '2026-13-45x']) assert.equal(span(bad), null, String(bad));
});

/** The bars of a Gantt chart as [{ text, a, b, row }], columns as grid lines. */
const bars = (html) => [...html.matchAll(/class="ui-gantt-i[^"]*" style="grid-column:(\d+) \/ (\d+);grid-row:(\d+)"[^>]*><b>([^<]*)<\/b>/g)]
  .map(([, a, b, row, text]) => ({ text, a: Number(a), b: Number(b), row: Number(row) }));

test('the Gantt chart: a row per group, the calendar first, lanes that never overlap, today across', () => {
  assert.equal(gantt([], { today: '2026-11-09' }), '');
  assert.equal(gantt([{ text: 'no date' }], { today: '2026-11-09' }), '');
  const items = [
    { text: 'Paint day', start: '2026-11-14', kind: 'event' },
    { text: 'Fix the boiler', due: '2026-W46', group: 'Building', kind: 'action' },
    { text: 'Quote', start: '2026-11-10', end: '2026-11-25', group: 'Building', kind: 'milestone' },
    { text: 'Gutters', due: '2026-11', group: 'Building', kind: 'late' },
    { text: 'Old one', start: '2026-11-02', group: 'Building', kind: 'done', done: true },
    { text: 'Fair', due: '2026-12-05..2026-12-06', group: 'Events' },
  ];
  const html = gantt(items, { today: '2026-11-09' });
  const b = bars(html);
  assert.equal(b.length, items.length, 'every item placed');
  for (const x of b) for (const y of b) {
    if (x === y || x.row !== y.row) continue;
    assert.ok(x.b <= y.a || y.b <= x.a, `${x.text} and ${y.text} overlap on row ${x.row}`);
  }
  const labels = [...html.matchAll(/class="ui-gantt-label" style="grid-column:1;grid-row:(\d+) \/ span (\d+)"[^>]*>([^<]*)</g)].map((m) => [m[3], Number(m[1]), Number(m[2])]);
  assert.deepEqual(labels.map((l) => l[0]), ['Calendar', 'Building', 'Events'], 'the ungrouped items on a first row');
  assert.ok(labels[1][2] >= 3, 'the four Building items stack on sub-lanes');
  assert.match(html, /class="ui-gantt-h is-now"[^>]*>.*?<em>this week<\/em>/);
  assert.match(html, /class="ui-gantt-now" style="grid-column:\d+;grid-row:2 \/ \d+;--at:/);
  assert.match(html, /ui-gantt-done is-past/);
  assert.match(html, /ui-gantt-event[^"]* is-point/);
  assert.match(html, /<ul class="ui-legend ui-gantt-legend">.*event.*milestone.*dated action.*done.*late/s);
  assert.match(html, /<div class="ui-gantt-wrap" role="region" aria-label="Timeline" tabindex="0">/);
});

test('the compact Gantt chart places the same items, only its classes and sizes change', () => {
  const items = [
    { text: 'Paint day', start: '2026-11-14' },
    { text: 'Fix the boiler with a long label', sub: 'the old one', due: '2026-W46', group: 'Building' },
    { text: 'Quote', start: '2026-11-10', end: '2026-11-25', group: 'Building' },
    { text: 'Far away', start: '2027-06-01', group: 'Building' },
  ];
  const full = gantt(items, { today: '2026-11-09', weeks: 8 });
  const compact = gantt(items, { today: '2026-11-09', weeks: 8, compact: true });
  assert.deepEqual(bars(compact), bars(full));
  assert.equal(bars(full).length, 3, 'weeks: 8 shows last week and the eight coming ones, nothing beyond');
  assert.match(full, /--n:9;/);
  assert.match(compact, /class="ui-gantt-wrap is-compact"/);
  assert.doesNotMatch(compact, /ui-gantt-legend/, 'no legend in a compact chart');
  assert.doesNotMatch(compact, /<small>the old one<\/small>/, 'one line per bar');
  assert.match(compact, /title="Fix the boiler with a long label · the old one · 2026-11-09 → 2026-11-15"/, 'the full text on hover');
  const strip = (h) => h.replace(/<ul class="ui-legend[\s\S]*$/, '').replace(/ is-compact/g, '').replace(/<small>[^<]*<\/small>/g, '');
  assert.equal(strip(compact), strip(full));
});

test("the components' styles are tokens only, and honour reduced motion", () => {
  const css = readFileSync(join(ROOT, 'apps/dashboard/extension.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.ui-ring-txt[^}]*tabular-nums/);
  const tokens = readFileSync(join(ROOT, 'source/brand/tokens.css'), 'utf8');
  for (const tk of ['--color-ok', '--color-warn', '--color-late', '--color-info', '--text-xs', '--text-2xs', '--shadow-card']) assert.match(tokens, new RegExp(`${tk}:`), tk);
});

test('the example extension: key figures, a compact Gantt chart, and tick boxes on the checklist', () => {
  const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const b = coop({ files: {
    'rota.md': `- ${day(2)} · @sam · Opening shift\n- ${day(3)} · @nobody · Evening close\n`,
    'checklist.md': `- [ ] Check the fire exits @rae due:${day(10)} ^k3p9\n- [x] Order the paint ^m4q2\n- [ ] Ask about the keys #decide\n`,
  } });
  try {
    const home = b.read('index.html');
    assert.match(home, /class="card ui-kpi ui-edge-late" href="rota\/swaps\/"/);
    assert.match(home, /aria-label="50% done, 1\/2"/);
    assert.match(home, /aria-label="33% done, 1\/3"/);
    const rota = b.read('rota/index.html');
    assert.match(rota, /<section class="card coop-plan"><h2>The next eight weeks<\/h2><div class="ui-gantt-wrap is-compact"/);
    assert.deepEqual(bars(rota).map((x) => x.text).sort(), ['Check the fire exits', 'Evening close', 'Opening shift']);
    const list = b.read('checklist/index.html');
    assert.equal((list.match(/<input type="checkbox" data-todo-source="checklist"/g) || []).length, 2, 'a line without ^id is read-only');
    assert.match(list, /data-todo-id="m4q2" checked/);
    assert.match(list, /<section class="card coop-list" data-group>.*data-count>1\/3</s);
    assert.equal((list.match(/\/api\/todos\?source=/g) || []).length, 1, 'the script once, added by the shell');
    assert.doesNotMatch(b.read('rooms/index.html'), /\/api\/todos/, 'and only where there is a box');
  } finally { b.done(); }
});

// ---------------------------------------------------------------- one orientation per level

test('two navigation levels never share an orientation: a build with side pages keeps the sections in a row', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-orient-'));
  const empty = { generated: '2026-10-30T10:00:00Z', org: 'Riverside Co-op', repos: [], private: [], projects: [], recap: [] };
  const load = async (code, d = empty) => {
    const file = join(dir, `ext-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(file, code);
    return loadExtension({ root: dir, data: d, today: TODAY, file });
  };
  const build = (extension, d = empty) => renderIntranet({ data: d, home: null, tools: [], css: '', today: TODAY, extension });
  const tabs = (n, side = false) => `export default (i) => { ${Array.from({ length: n }, (_, k) => `i.tab('s${k}/', 'S${k}'); i.page('s${k}/', () => ({ title: 'S${k}', body: 'x'${side && k === 0 ? ", side: { label: 'S0', links: [{ to: 's0/', label: 'One' }, { to: 's0/two/', label: 'Two' }] }" : ''} }));`).join(' ')} };`;
  try {
    const flat = build(await load(tabs(6)));
    assert.match(flat['index.html'], /<body class="has-nav">/, 'seven sections and no side page: the sidebar, as before');
    const sided = build(await load(tabs(6, true)));
    for (const f of ['index.html', 's0/index.html', 's3/index.html']) {
      assert.doesNotMatch(sided[f], /nav-side|has-nav/, f);
      assert.match(sided[f], /<header class="top many">/, f);
    }
    assert.match(sided['s0/index.html'], /<aside class="side" aria-label="S0">/, 'the section keeps its vertical sidebar');
    assert.match(sided['index.html'], /scrollLeft/, 'the row scrolls with the current tab in view');
    // The kit's own Projects pages count as side pages once a project has a page.
    const withProject = data([project()]);
    const proj = build(await load(tabs(6), withProject), withProject);
    assert.doesNotMatch(proj['index.html'], /has-nav/);
    assert.match(proj['projects/brochure/index.html'], /<aside class="side" aria-label="Projects">/);
    // Groups and side pages: one row, in the groups' order, a rule between groups, no headings.
    const grouped = build(await load(`export default (i) => {
      i.tab('rota/', 'Rota'); i.tab('rooms/', 'Rooms');
      i.page('rota/', () => ({ body: 'x', side: { label: 'Rota', links: [{ to: 'rota/', label: 'Coming' }] } }));
      i.group('Volunteers', ['rooms/', 'rota/']);
    };`));
    const row = grouped['index.html'].match(/<nav class="tabs"[^>]*>(.*?)<\/nav>/)[1];
    assert.deepEqual([...row.matchAll(/href="([^"]*)"|class="(tab-sep)"/g)].map((m) => m[1] ?? m[2]), ['', 'projects/', 'tab-sep', 'rooms/', 'rota/']);
    assert.doesNotMatch(grouped['index.html'], /nav-group-label/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------- French typography

test('a French intranet keeps : ; ? ! and « » on the line of their word; an English one is untouched', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'intranet-fr-'));
  const d = data([project({ counts: { open: 1, done: 0 }, open: [item('Choisir le papier : mat ou brillant ?')] })]);
  const load = async (code) => {
    const file = join(dir, `ext-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(file, code);
    return loadExtension({ root: dir, data: d, today: TODAY, file });
  };
  const body = `<h1>Rota : la semaine</h1><p title="garde : ceci">Qui ? Quoi ! Où ; « ici » pour 12 000 personnes</p><code>a : b</code><pre>c ? d</pre><a href="x/?q=1 : 2">lien</a><script>const s = 'e : f';</script><style>.x::before { content: " :"; }</style>`;
  const page = `i.tab('rota/', 'Rota'); i.page('rota/', () => ({ title: 'Rota : semaine', body: ${JSON.stringify(body)} }));`;
  const build = (extension) => renderIntranet({ data: d, home: null, tools: [], css: '', today: TODAY, extension });
  try {
    await assert.rejects(load("export default (i) => i.locale('French');"), /needs a language tag/);
    const fr = build(await load(`export default (i) => { i.locale('fr-FR'); ${page} };`));
    const html = fr['rota/index.html'];
    assert.match(html, /<html lang="fr">/);
    const text = html.replace(/<(script|style|code|pre)\b[\s\S]*?<\/\1>/g, '').replace(/<[^>]*>/g, '');
    assert.doesNotMatch(text, / [:;?!»]|« /, 'no plain space before a sign or inside guillemets');
    assert.match(html, /Rota : la semaine/);
    assert.match(html, /12 000/);
    assert.match(html, /<title>Rota : semaine/);
    for (const kept of ['title="garde : ceci"', '<code>a : b</code>', '<pre>c ? d</pre>', 'href="x/?q=1 : 2"', "const s = 'e : f';", 'content: " :";']) assert.ok(html.includes(kept), kept);
    assert.match(fr['projects/brochure/index.html'], /papier : mat ou brillant \?/, "the kit's own pages too");
    // English: the same build with and without an explicit English locale, byte for byte.
    const en = build(await load(`export default (i) => { ${page} };`));
    assert.deepEqual(build(await load(`export default (i) => { i.locale('en-GB'); ${page} };`)), en);
    assert.ok(en['rota/index.html'].includes('Rota : la semaine'));
    assert.equal(typeset(en['rota/index.html'], 'en'), en['rota/index.html']);
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
