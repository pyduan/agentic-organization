#!/usr/bin/env node
// Documents: a markdown file becomes a standalone HTML page of real A4 pages, checked in Chrome,
// and printed to PDF from the same build (the central repo's source/formats/document.md).
//
// This file is the company pack's own. The rest of scripts/doc/ is the kit's, copied from the central
// repo and kept identical by vendor-sync, so a fix to the format is made there. This one differs
// because a company does not keep
// its documents beside the build: they live in its repos, its tokens in the central repo, and the
// intranet serves the pages behind its access. The repos are found by ../deck/paths.mjs, the one
// file that knows the layout.
//
//   strategy/documents/<slug>/document.md    the company's own documents
//   customers/documents/<slug>/document.md   a document made for one customer
//   <central>/source/brand/tokens.css        the company's colours and fonts
//   intranet/public/documents/<slug>/        where they are built, served behind the intranet's access
//   <document>/dist/<slug>.pdf               the copy to send (--pdf)
//
//   node scripts/doc/build.mjs new <slug> [--onepager]    start strategy/documents/<slug>/document.md;
//                                                         move the folder to customers/documents/
//                                                         for a customer's document
//   node scripts/doc/build.mjs <slug>... | --all          build, then check in Chrome
//     --pdf          also print <document>/dist/<slug>.pdf
//     --no-check     build only
//     --strict       a blank left, a title rule or a to-complete line fails too
//     --intranet     every document, for `npm run build`: a document with a defect is not served,
//                    and the build goes on (with --strict, a refused or unchecked one exits 1)
//
// A document is refused, never the intranet: the same choice as the decks
// (scripts/deck/intranet.mjs). A blank or a to-complete line refuses nothing there, because a draft
// is read on the intranet before it leaves.
//
// Exit: 0 clean · 1 a defect · 2 nothing to build, or no Chrome to check with.

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { frontmatter } from '../deck/parse.mjs';
import { withChrome, openTab } from '../deck/chrome.mjs';
import { printPdf, stripDark } from '../deck/build.mjs';
import { locate } from '../deck/paths.mjs';
import { esc, inline, renderMarkdown } from './markdown.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// The company's tokens are the intranet's, named its way; doc.css reads the public kit's names.
// The intranet's are mapped onto them, on the page and on a [data-brand] block alike.
const TOKEN_NAMES = `:root, .doc-paged { --color-bg: var(--canvas); --color-surface: var(--surface); --color-ink: var(--ink);
  --color-muted: var(--ink-muted); --color-line: var(--hairline); --color-accent: var(--accent); --font-text: var(--font-ui); }`;

const LABELS = {
  fr: { todo: 'À compléter avant l’envoi', untitled: 'Sans titre' },
  en: { todo: 'To complete before this leaves', untitled: 'Untitled' },
};

const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/** A title names what the document is: no dash splitting it in two, no comma outside a list. */
export function titleProblems(t) {
  const out = [];
  if (!t) return out;
  if (/[—–]/.test(t)) out.push('a dash splits the title in two: keep the label, move the rest to the subtitle');
  if (/,/.test(t) && !/,[^,]+\s(?:and|or|et|ou|und|y|e)\s/i.test(t)) out.push('a comma in the title outside a list is an apposition: move it to the subtitle');
  return out;
}

/** Renders one document's source to HTML; returns the page and what the build noticed. */
export function renderDocument(src, { tokens = '', lang: fallback = 'en' } = {}) {
  const { meta, body } = frontmatter(src);
  const lang = meta.lang || fallback;
  const label = LABELS[String(lang).slice(0, 2)] || LABELS.en;
  const blanks = [];
  const ctx = { lang, blanks };
  const onepager = meta.type === 'one-pager';
  const hero = `<header class="doc-hero">${meta.kicker ? `<div class="doc-kicker">${inline(meta.kicker, ctx)}</div>` : ''}<h1>${inline(meta.title || label.untitled, ctx)}</h1>${
    meta.subtitle ? `<p class="doc-hero-dek">${inline(meta.subtitle, ctx)}</p>` : ''}${
    meta.date || meta.author ? `<div class="doc-hero-meta">${[meta.author, meta.date].filter(Boolean).map((x) => `<span>${inline(String(x), ctx)}</span>`).join('')}</div>` : ''}</header>`;
  const content = renderMarkdown(body, ctx);
  const todo = list(meta['to-complete']);
  const css = readFileSync(join(HERE, 'doc.css'), 'utf8');
  const js = readFileSync(join(HERE, 'paged.js'), 'utf8');
  const html = `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(meta.title || 'Document')}</title>
<style>${tokens}\n${TOKEN_NAMES}\n${css}</style></head>
<body><div class="doc-shell doc-paged"${meta.brand ? ` data-brand="${esc(meta.brand)}"` : ''}${onepager ? ' data-onepager' : ''} data-mark="${esc(meta.mark || meta.title || '')}" data-kicker="${esc(meta['running-head'] || '')}" data-foot="${esc(meta.foot || '')}">
${todo.length ? `<aside class="doc-todo"><b>${label.todo}</b><ul>${todo.map((x) => `<li>${inline(x, { lang })}</li>`).join('')}</ul></aside>` : ''}
<div class="doc-flow">${hero}\n${content}</div><div class="doc-pages"></div></div>
<script>${js}</script></body></html>`;
  return { html, meta, blanks, todo, titles: [...titleProblems(meta.title), ...titleProblems(meta.subtitle).map((p) => `subtitle: ${p}`)] };
}

/** Opens a built document in Chrome and reads what the paginator did. */
export async function checkDocument(htmlFile, port) {
  const tab = await openTab(port, { width: 1100, height: 1400 });
  try {
    await tab.navigate(pathToFileURL(htmlFile).href);
    let state = null;
    for (let i = 0; i < 100 && !state; i++) {
      state = await tab.evaluate("(() => { const r = document.querySelector('.doc-paged'); return r && r.dataset.pages ? { pages: Number(r.dataset.pages), overflow: Number(r.dataset.overflow) } : null; })()");
      if (!state) await new Promise((r) => setTimeout(r, 100));
    }
    return { ...(state || { pages: null, overflow: 0 }), errors: tab.errors() };
  } finally { tab.close(); }
}

const rel = (p) => relative(process.cwd(), p) || '.';

/** Where documents live and where they are built, from the deck engine's map of the repos. */
async function layout() {
  const paths = await locate();
  return {
    // strategy/documents first: `new` starts a document there.
    roots: paths.decks.map((d) => join(dirname(d), 'documents')),
    tokens: paths.tokens.map((t) => stripDark(readFileSync(t, 'utf8'))).join('\n'),
    out: join(paths.root, 'public', 'documents'),
    lang: paths.lang,
  };
}

/** Every document folder, as [{ slug, dir }], in both repos. */
const allDocuments = (roots) => roots.flatMap((r) => (existsSync(r) ? readdirSync(r) : [])
  .filter((s) => existsSync(join(r, s, 'document.md'))).map((slug) => ({ slug, dir: join(r, slug) })));

function start(slug, onepager, roots) {
  if (!/^[a-z0-9-]+$/.test(slug || '')) { console.error('Name it with lowercase letters, digits and dashes.'); return 2; }
  const taken = allDocuments(roots).find((d) => d.slug === slug);
  if (taken) { console.error(`${rel(join(taken.dir, 'document.md'))} exists already: a slug is unique across both repos.`); return 1; }
  const file = join(roots[0], slug, 'document.md');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `---
title: ${slug.replace(/-/g, ' ')}
subtitle: "[one sentence on what the reader will decide or do]"
type: ${onepager ? 'one-pager' : 'document'}
lang: en
date: ${new Date().toISOString().slice(0, 10)}
to-complete: [the figures to confirm before this leaves]
---

## What this is about

[The reader's question, and its answer in two sentences.]
`);
  console.log(`Started ${rel(file)}. Build it with: npm run doc -- ${slug}`);
  console.log(`A document for one customer goes in ${rel(join(roots[1], slug))}/: move the folder there.`);
  return 0;
}

async function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const args = argv.filter((a) => !a.startsWith('--'));
  const intranet = flags.has('--intranet');
  const strict = flags.has('--strict') && !intranet;
  const L = await layout();
  if (args[0] === 'new') return start(args[1], flags.has('--onepager'), L.roots);

  const found = allDocuments(L.roots);
  const docs = [];
  if (intranet || flags.has('--all')) docs.push(...found);
  else for (const slug of args) {
    const at = found.filter((d) => d.slug === slug);
    if (at.length) docs.push(...at);
    else docs.push({ slug, dir: null });
  }
  if (intranet) {
    rmSync(L.out, { recursive: true, force: true });
    if (!docs.length) { console.log('Documents: 0 found.'); return 0; }
  } else if (!docs.length) { console.error('Nothing to build. Name a document, or --all.'); return 2; }

  let code = 0;
  const built = [];
  const refused = new Map();
  const seen = new Map();
  const refuse = (b, m) => { console.log(`  ✘ ${b.slug}: ${m}`); refused.set(b.slug, b); code = 1; };
  for (const d of docs) {
    if (!d.dir) { console.log(`✘ ${d.slug}: no ${rel(join(L.roots[0], d.slug, 'document.md'))}, nor in ${rel(L.roots[1])}`); code = 1; continue; }
    const src = join(d.dir, 'document.md');
    if (seen.has(d.slug)) { console.log(`✘ ${rel(src)}: same name as ${rel(seen.get(d.slug))}, rename one of the two folders`); code = 1; continue; }
    seen.set(d.slug, src);
    let r;
    try { r = renderDocument(readFileSync(src, 'utf8'), { tokens: L.tokens, lang: L.lang }); } catch (e) { console.log(`✘ ${rel(src)}: ${e.message}`); code = 1; continue; }
    const out = join(L.out, d.slug, 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, r.html);
    console.log(`\n• ${rel(src)} → ${rel(out)}`);
    const warn = (m) => { console.log(`  ${strict ? '✘' : '!'} ${m}`); if (strict) code = 1; };
    r.titles.forEach(warn);
    if (r.blanks.length) warn(`${r.blanks.length} blank(s) left: ${r.blanks.map((b) => `[${b}]`).join(', ')}`);
    if (r.todo.length) warn(`${r.todo.length} line(s) still to complete (frontmatter to-complete)`);
    built.push({ slug: d.slug, dir: d.dir, out, meta: r.meta });
  }
  let checked = false;
  if (built.length && !flags.has('--no-check')) {
    try {
      await withChrome(async (port) => {
        for (const b of built) {
          const c = await checkDocument(b.out, port);
          if (c.pages === null) { refuse(b, 'the pagination never finished'); continue; }
          console.log(`  ${b.slug}: ${c.pages} page${c.pages === 1 ? '' : 's'}`);
          if (b.meta.type === 'one-pager' && c.pages !== 1) refuse(b, `a one-pager on ${c.pages} pages, tighten the text`);
          if (c.overflow) refuse(b, `${c.overflow} block(s) taller than a page, split them`);
          for (const e of c.errors) refuse(b, e);
        }
      });
      checked = true;
    } catch (e) {
      console.log(`  ! not checked: ${e.message}`);
      code = Math.max(code, e.code === 2 ? 2 : 1);
    }
  }
  if (flags.has('--pdf')) {
    for (const b of built) {
      const pdf = join(b.dir, 'dist', `${b.slug}.pdf`);
      mkdirSync(dirname(pdf), { recursive: true });
      try { await printPdf(b.out, pdf); console.log(`  PDF: ${rel(pdf)}`); } catch (e) { console.log(`  ✘ no PDF: ${e.message}`); code = 1; }
    }
  }
  if (!intranet) return built.length ? code : code || 2;

  // The intranet serves what passed, and says on every run what it did not serve.
  for (const b of refused.values()) rmSync(dirname(b.out), { recursive: true, force: true });
  const served = built.length - refused.size;
  console.log(`\nDocuments: ${docs.length} found, ${served} built, ${docs.length - served} refused; browser check ${checked ? 'ran' : 'did not run'}.`);
  return flags.has('--strict') && (served < docs.length || (!checked && served)) ? 1 : 0;
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) process.exit(await main(process.argv.slice(2)));
