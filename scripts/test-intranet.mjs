// The intranet: the owner's banner and tools parsed from source/content/, who waits on what, the
// pages rendered, and the build run end to end on an invented workspace.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseHome, parseTools, waiting, stats, homePage, projectsPage, projectPage, renderIntranet,
} from '../apps/dashboard/intranet.mjs';

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
  assert.ok(h.sections.some((s) => /quickstart/i.test(s.heading)));
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
