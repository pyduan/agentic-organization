#!/usr/bin/env node
// Builds decks: a deck.mdx in, one self-contained HTML page out, measured in a browser.
//
//   node scripts/deck/build.mjs new <slug>             a deck folder with its frontmatter and a plan
//   node scripts/deck/build.mjs components             every component a deck can use, with its props
//   node scripts/deck/build.mjs build <slug|folder>    → <deck>/index.html, then the check
//   node scripts/deck/build.mjs build <slug> --share   → <deck>/dist/<slug>.html: one file, images inside, no notes
//   node scripts/deck/build.mjs build <slug> --pdf     → <deck>/dist/<slug>.pdf, one slide per page
//   node scripts/deck/build.mjs build --all            every deck
//   node scripts/deck/build.mjs list                   every deck, its status, whether its build is stale
//   node scripts/deck/build.mjs publish <slug>         a copy on the website (only when the owner asked)
//
// Options: --no-check (skip the browser) · --strict (warnings and a skipped check fail too)
//
// Exit: 0 built and clean · 1 an error or a defect · 2 nothing to build.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync, realpathSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename, relative, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseDeck, DeckError } from './parse.mjs';
import { renderDeck } from './render.mjs';
import { components as kitComponents, helpers } from './components.mjs';
import { checkDeck, printReport } from './check.mjs';
import { findChrome } from './chrome.mjs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { locate } from './paths.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' };

/** The kit's components, then the brand's: a brand may add a shape or restyle one it owns. */
export async function loadRegistry(paths, log = () => {}) {
  const registry = { ...kitComponents };
  const file = join(paths.brand, 'components.mjs');
  if (existsSync(file)) {
    const mod = await import(`${pathToFileURL(file).href}?t=${statSync(file).mtimeMs}`);
    const extra = typeof mod.default === 'function' ? mod.default(helpers) : mod.components || {};
    for (const [name, def] of Object.entries(extra)) {
      if (registry[name]) log(`  brand component ${name} replaces the kit's`);
      registry[name] = def;
    }
  }
  return registry;
}

/** Drops what only a dark interface needs: a deck is always on paper. */
export function stripDark(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '', i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) { out += src.slice(i); break; }
    const prelude = src.slice(i, open);
    let depth = 1, j = open + 1;
    while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
    if (!/prefers-color-scheme:\s*dark|data-theme=["']?dark|\.dark\b/.test(prelude)) out += src.slice(i, j);
    i = j;
  }
  return out;
}

function makeAsset({ deckDir, brandDir, outDir, mode, errors, warnings }) {
  const seen = new Map();
  return (src, where) => {
    if (/^data:/.test(src)) return src;
    if (/^https?:/.test(src)) { errors.push(`${where}: ${src} is on the internet: download it into the deck's assets/ so the deck opens offline and does not change under you`); return ''; }
    const file = src.startsWith('brand:') ? join(brandDir, 'assets', src.slice(6)) : resolve(deckDir, src);
    if (!existsSync(file)) { errors.push(`${where}: image not found: ${src}${src.startsWith('brand:') ? ` (looked in ${relative(process.cwd(), join(brandDir, 'assets'))})` : ''}`); return ''; }
    if (seen.has(file)) return seen.get(file);
    const size = statSync(file).size;
    if (size > 2.5e6) warnings.push(`${where}: ${basename(file)} weighs ${(size / 1e6).toFixed(1)} MB: resize it to 2000px wide (sips -Z 2000 "${relative(process.cwd(), file)}")`);
    let url;
    if (mode === 'inline') url = `data:${MIME[extname(file).toLowerCase()] || 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`;
    else if (mode === 'copy') {
      const name = `${createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 10)}${extname(file).toLowerCase()}`;
      mkdirSync(join(outDir, '_a'), { recursive: true });
      copyFileSync(file, join(outDir, '_a', name));
      url = `_a/${name}`;
    } else url = relative(outDir, file).split(sep).map(encodeURIComponent).join('/');
    seen.set(file, url);
    return url;
  };
}

/** Engine, brand tokens, kit theme, brand deck theme: the order a brand overrides the kit in. */
export function assembleCss(paths, asset) {
  const parts = [readFileSync(join(HERE, 'engine.css'), 'utf8')];
  for (const t of paths.tokens) parts.push(`/* brand tokens: ${basename(t)} */\n${stripDark(readFileSync(t, 'utf8'))}`);
  parts.push(readFileSync(join(HERE, 'theme.css'), 'utf8'));
  const brandTheme = join(paths.brand, 'theme.css');
  if (existsSync(brandTheme)) {
    const css = readFileSync(brandTheme, 'utf8').replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => {
      if (/^(data:|https?:|#)/.test(u)) return m;
      return `url("${asset(`brand:${relative(join(paths.brand, 'assets'), resolve(paths.brand, u)).split(sep).join('/')}`, 'brand theme')}")`;
    });
    parts.push(`/* brand deck theme */\n${css}`);
  }
  return parts.join('\n');
}

/** A slug, a folder or a file → the deck's file. */
export function findDeck(arg, paths) {
  const tries = [resolve(arg), join(resolve(arg), 'deck.mdx'), ...paths.decks.map((d) => join(d, arg, 'deck.mdx'))];
  const hit = tries.find((p) => existsSync(p) && statSync(p).isFile());
  if (!hit) throw new DeckError(`no deck "${arg}" (looked for ${tries.map((p) => relative(process.cwd(), p) || '.').join(', ')})`);
  return hit;
}

export function allDecks(paths) {
  return paths.decks.filter(existsSync).flatMap((d) => readdirSync(d)
    .filter((s) => !s.startsWith('_') && !s.startsWith('.') && existsSync(join(d, s, 'deck.mdx')))
    .map((s) => join(d, s, 'deck.mdx')));
}

/**
 * Builds one deck. Returns { file, out, errors, warnings, slides, meta }.
 * opts: { share, outFile, mode: link|inline|copy, log }
 */
export async function buildDeck(deckFile, paths, opts = {}) {
  const log = opts.log || console.log;
  const deckDir = dirname(deckFile);
  const slug = basename(deckDir);
  const share = Boolean(opts.share);
  // Where the built page goes: next to its source, unless the repo says otherwise (an intranet
  // serves its decks from its own public folder, behind its own access).
  const outFile = opts.outFile || (share ? join(deckDir, 'dist', `${slug}.html`) : paths.outFor?.(deckDir, slug) || join(deckDir, 'index.html'));
  const outDir = dirname(outFile);
  const mode = opts.mode || (share ? 'inline' : paths.assetMode || 'link');
  const errors = [], warnings = [];
  let deck;
  try { deck = parseDeck(readFileSync(deckFile, 'utf8')); } catch (e) {
    return { file: deckFile, out: null, errors: [e.message], warnings, slides: [], meta: {} };
  }
  mkdirSync(outDir, { recursive: true });
  if (share) writeFileSync(join(outDir, '.gitignore'), '*\n');
  const asset = makeAsset({ deckDir, brandDir: paths.brand, outDir, mode, errors, warnings });
  const registry = await loadRegistry(paths, log);
  const css = assembleCss(paths, asset);
  const js = readFileSync(join(HERE, 'engine.js'), 'utf8');
  const r = renderDeck(deck, { registry, asset, css, js, shareMode: share });
  errors.push(...r.errors);
  warnings.push(...r.warnings);
  if (!errors.length) writeFileSync(outFile, r.html);
  return { file: deckFile, out: errors.length ? null : outFile, errors, warnings, slides: r.slides, meta: deck.meta, slug };
}

// Chrome's own print command, not the debugging protocol: Page.printToPDF stalled on decks that
// print fine this way, and this is the command deck.md has always given for a clean export.
export async function printPdf(htmlFile, pdfFile) {
  const chrome = findChrome();
  if (!chrome) throw new Error('no Chrome, Chromium or Edge found (set CHROME_PATH)');
  const profile = mkdtempSync(join(tmpdir(), 'deck-pdf-'));
  rmSync(pdfFile, { force: true });
  try {
    await new Promise((ok, ko) => {
      const p = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-pdf-header-footer', `--user-data-dir=${profile}`,
        '--virtual-time-budget=10000', `--print-to-pdf=${pdfFile}`, pathToFileURL(htmlFile).href], { stdio: 'ignore' });
      // Headless Chrome does not always exit once the PDF is written (seen on macOS): watch for a
      // complete file, same size twice and ending in %%EOF, then stop it.
      let last = -1;
      const done = (err) => { clearInterval(watch); clearTimeout(t); p.kill(); err ? ko(err) : ok(); };
      const watch = setInterval(() => {
        if (!existsSync(pdfFile)) return;
        const size = statSync(pdfFile).size;
        if (size > 0 && size === last && readFileSync(pdfFile).subarray(-1024).toString('latin1').includes('%%EOF')) done();
        last = size;
      }, 500);
      const t = setTimeout(() => done(new Error('Chrome took more than two minutes to print')), 120000);
      p.on('exit', () => { if (existsSync(pdfFile)) setTimeout(() => done(), 600); else done(new Error('Chrome exited without writing the PDF')); });
    });
  } finally {
    await new Promise((r) => setTimeout(r, 400)); // Chrome may still be writing its profile as it stops
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* a temp folder left behind */ }
  }
}

const rel = (p) => relative(process.cwd(), p) || '.';

async function cmdBuild(targets, flags, paths) {
  const files = flags.all ? allDecks(paths) : targets.map((t) => findDeck(t, paths));
  if (!files.length) { console.error('Nothing to build. Name a deck, or --all.'); return 2; }
  let code = 0;
  for (const f of files) {
    const share = flags.share || flags.pdf;
    const r = await buildDeck(f, paths, { share });
    console.log(`\n${r.errors.length ? '✘' : '•'} ${rel(f)}: ${r.slides.length} slides${r.out ? ` → ${rel(r.out)}` : ''}`);
    for (const e of r.errors) console.log(`  ✘ ${e}`);
    for (const w of r.warnings) console.log(`  ! ${w}`);
    if (r.errors.length) { code = 1; continue; }
    if (flags.pdf) {
      const pdf = r.out.replace(/\.html$/, '.pdf');
      try { await printPdf(r.out, pdf); console.log(`  PDF: ${rel(pdf)}`); } catch (e) { console.log(`  ✘ no PDF: ${e.message}`); code = 1; }
    }
    if (!flags['no-check']) {
      const c = await checkDeck(r.out, { outDir: join(dirname(f), '.check') });
      const k = printReport(c, { strict: flags.strict });
      if (k === 1 || (k === 2 && flags.strict)) code = 1;
    }
    if (flags.strict && r.warnings.length) code = 1;
  }
  return code;
}

function cmdNew([slug], flags, paths) {
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) { console.error('A slug in lowercase with dashes: new copil-2026-10'); return 2; }
  const dir = join(paths.decks[0], slug);
  if (existsSync(join(dir, 'deck.mdx'))) { console.error(`${rel(dir)} already has a deck.`); return 2; }
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', '.gitkeep'), '');
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dir, 'deck.mdx'), `---
title: "${flags.title || 'The deck title'}"
date: ${today}
lang: ${flags.lang || 'fr'}
audience: "Who will be in the room, and what they already know"
takeaway: "The one thing they should remember"
status: draft
footer: ""
---

{/* The plan, approved by whoever presents before any slide is composed.
   One line per slide: its title, then what the slide proves.
   1. …
   2. …
   Facts come from the content files, each with its source. No invented figure. */}

<Cover title="${flags.title || 'The deck title'}" date="${today}" />

<Slide title="A title that names what the slide is about">
  <Bullets items={["One fact per point", "Another fact"]} />
</Slide>

<Closing title="The next step" />
`);
  console.log(`New deck: ${rel(join(dir, 'deck.mdx'))}\nNext: write the plan in its comment, get it approved, then compose (node scripts/deck/build.mjs components).`);
  return 0;
}

async function cmdComponents(paths) {
  const registry = await loadRegistry(paths);
  const brand = existsSync(join(paths.brand, 'components.mjs')) ? Object.keys((await import(pathToFileURL(join(paths.brand, 'components.mjs')).href)).default?.(helpers) || {}) : [];
  const describe = (t) => {
    if (!t) return '?';
    const r = t.required ? '!' : '';
    if (t.k === 'list') return `[${describe(t.of)}]${r}`;
    if (t.k === 'obj') return `{ ${Object.entries(t.shape).map(([k, v]) => `${k}: ${describe(v)}`).join(', ')} }${r}`;
    if (t.k === 'textOr') return `text | { ${Object.entries(t.shape).map(([k, v]) => `${k}: ${describe(v)}`).join(', ')} }${r}`;
    if (t.k === 'enum') return `${t.values.map((v) => `"${v}"`).join('|')}${r}`;
    return `${t.k}${r}`;
  };
  for (const kind of [true, false]) {
    console.log(kind ? '\nWHOLE SLIDES (one per slide, at the top level)' : '\nBLOCKS (inside a <Slide>, or a column of a <Split>)');
    for (const [name, def] of Object.entries(registry).filter(([, d]) => Boolean(d.slide) === kind)) {
      console.log(`\n<${name}>${brand.includes(name) ? '  (brand)' : ''}  ${def.doc || ''}`);
      const common = ['chapter', 'notes', 'id', 'ground', 'source'];
      for (const [k, t] of Object.entries(def.props)) if (!(kind && common.includes(k) && name !== 'Slide')) console.log(`    ${k}: ${describe(t)}`);
      if (def.children !== 'none') console.log(`    children: ${def.children}`);
    }
  }
  console.log('\nEvery whole slide also takes chapter, notes, id, ground (paper|tint|dark|accent) and source.');
  console.log('Text props take *accent*, **bold** and `code`. "!" marks a required prop. Images: a path in the deck folder, or brand:<file> for the brand\'s assets.');
  return 0;
}

function cmdList(paths) {
  const files = allDecks(paths);
  if (!files.length) { console.log('No decks yet. node scripts/deck/build.mjs new <slug>'); return 0; }
  for (const f of files) {
    let meta = {}, n = '?';
    try { const d = parseDeck(readFileSync(f, 'utf8')); meta = d.meta; n = d.slides.length; } catch (e) { meta = { title: `✘ ${e.message}` }; }
    const out = paths.outFor?.(dirname(f), basename(dirname(f))) || join(dirname(f), 'index.html');
    const state = !existsSync(out) ? 'not built' : statSync(out).mtimeMs < statSync(f).mtimeMs ? 'stale' : 'built';
    console.log(`${basename(dirname(f)).padEnd(32)} ${String(meta.status || '').padEnd(8)} ${String(n).padStart(3)} slides  ${state.padEnd(9)}  ${meta.title || ''}`);
  }
  return 0;
}

async function cmdPublish([slug], flags, paths) {
  if (!paths.publish) { console.error('This repo has no public website for decks. The built deck is the deliverable.'); return 2; }
  const f = findDeck(slug, paths);
  const r = await buildDeck(f, paths, { share: true });
  if (r.errors.length) { r.errors.forEach((e) => console.log(`  ✘ ${e}`)); return 1; }
  const c = await checkDeck(r.out, { shots: false, outDir: join(dirname(f), '.check') });
  if (printReport(c, {}) === 1) { console.log('Not published: fix the defects first.'); return 1; }
  const dest = join(paths.publish, r.slug, 'index.html');
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(r.out, dest);
  console.log(`Published copy (no speaker notes): ${rel(dest)}. It goes live on the next push: say so to the owner, who asked for it.`);
  return 0;
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const argv = process.argv.slice(2);
  const [cmd, ...rest] = argv;
  const flags = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
  const args = rest.filter((a) => !a.startsWith('--'));
  const paths = await locate();
  const run = { build: () => cmdBuild(args, flags, paths), new: () => cmdNew(args, flags, paths), components: () => cmdComponents(paths), list: () => cmdList(paths), publish: () => cmdPublish(args, flags, paths) }[cmd];
  if (!run) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 16).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(cmd ? 2 : 0);
  }
  try { process.exit(await run()); } catch (e) { console.error(`✘ ${e.message}`); process.exit(e instanceof DeckError ? 1 : 2); }
}
