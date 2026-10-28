#!/usr/bin/env node
// Documents: a markdown file becomes a standalone HTML page of real A4 pages, checked in Chrome,
// and printed to PDF from the same build (source/formats/document.md).
//
//   node scripts/doc/build.mjs new <slug> [--onepager]    start documents/<slug>/document.md
//   node scripts/doc/build.mjs <slug>... | --all          build, then check in Chrome
//     --pdf          also print documents/<slug>/dist/<slug>.pdf
//     --no-check     build only
//     --strict       a blank left, a title rule or a to-complete line fails too
//
// Exit: 0 clean · 1 a defect · 2 nothing to build, or no Chrome to check with.

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { frontmatter } from '../deck/parse.mjs';
import { withChrome, openTab } from '../deck/chrome.mjs';
import { printPdf } from '../deck/build.mjs';
import { esc, inline, renderMarkdown } from './markdown.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const DOCS = join(ROOT, 'documents');
const TOKENS = join(ROOT, 'source', 'brand', 'tokens.css');

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
export function renderDocument(src, { tokens = '' } = {}) {
  const { meta, body } = frontmatter(src);
  const lang = meta.lang || 'en';
  const blanks = [];
  const ctx = { lang, blanks };
  const onepager = meta.type === 'one-pager';
  const hero = `<header class="doc-hero">${meta.kicker ? `<div class="doc-kicker">${inline(meta.kicker, ctx)}</div>` : ''}<h1>${inline(meta.title || 'Untitled', ctx)}</h1>${
    meta.subtitle ? `<p class="doc-hero-dek">${inline(meta.subtitle, ctx)}</p>` : ''}${
    meta.date || meta.author ? `<div class="doc-hero-meta">${[meta.author, meta.date].filter(Boolean).map((x) => `<span>${inline(String(x), ctx)}</span>`).join('')}</div>` : ''}</header>`;
  const content = renderMarkdown(body, ctx);
  const todo = list(meta['to-complete']);
  const css = readFileSync(join(HERE, 'doc.css'), 'utf8');
  const js = readFileSync(join(HERE, 'paged.js'), 'utf8');
  const html = `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(meta.title || 'Document')}</title>
<style>${tokens}\n${css}</style></head>
<body><div class="doc-shell doc-paged"${meta.brand ? ` data-brand="${esc(meta.brand)}"` : ''}${onepager ? ' data-onepager' : ''} data-mark="${esc(meta.mark || meta.title || '')}" data-kicker="${esc(meta['running-head'] || '')}" data-foot="${esc(meta.foot || '')}">
${todo.length ? `<aside class="doc-todo"><b>To complete before this leaves</b><ul>${todo.map((x) => `<li>${inline(x, { lang })}</li>`).join('')}</ul></aside>` : ''}
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

function start(slug, onepager) {
  if (!/^[a-z0-9-]+$/.test(slug || '')) { console.error('Name it with lowercase letters, digits and dashes.'); return 2; }
  const file = join(DOCS, slug, 'document.md');
  if (existsSync(file)) { console.error(`${rel(file)} exists already.`); return 1; }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `---
title: ${slug.replace(/-/g, ' ')}
subtitle: "[one sentence on what the reader will decide or do]"
type: ${onepager ? 'one-pager' : 'document'}
lang: en
date: ${new Date().toISOString().slice(0, 10)}
to-complete: [the figures to confirm before it leaves]
---

## What this is about

[The reader's question, answered in two sentences.]
`);
  console.log(`Started ${rel(file)}. Build it with: node scripts/doc/build.mjs ${slug}`);
  return 0;
}

async function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const args = argv.filter((a) => !a.startsWith('--'));
  if (args[0] === 'new') return start(args[1], flags.has('--onepager'));
  const slugs = flags.has('--all') ? (existsSync(DOCS) ? readdirSync(DOCS).filter((s) => existsSync(join(DOCS, s, 'document.md'))) : []) : args;
  if (!slugs.length) { console.error('Nothing to build. Name a document, or --all.'); return 2; }
  const tokens = existsSync(TOKENS) ? readFileSync(TOKENS, 'utf8') : '';
  let code = 0;
  const built = [];
  for (const slug of slugs) {
    const src = join(DOCS, slug, 'document.md');
    if (!existsSync(src)) { console.log(`✘ ${slug}: no ${rel(src)}`); code = 1; continue; }
    let r;
    try { r = renderDocument(readFileSync(src, 'utf8'), { tokens }); } catch (e) { console.log(`✘ ${slug}: ${e.message}`); code = 1; continue; }
    const out = join(DOCS, slug, 'index.html');
    writeFileSync(out, r.html);
    console.log(`\n• ${rel(src)} → ${rel(out)}`);
    const warn = (m) => { console.log(`  ${flags.has('--strict') ? '✘' : '!'} ${m}`); if (flags.has('--strict')) code = 1; };
    r.titles.forEach(warn);
    if (r.blanks.length) warn(`${r.blanks.length} blank(s) left: ${r.blanks.map((b) => `[${b}]`).join(', ')}`);
    if (r.todo.length) warn(`${r.todo.length} line(s) still to complete (frontmatter to-complete)`);
    built.push({ slug, out, meta: r.meta });
  }
  if (!built.length) return code || 2;
  if (!flags.has('--no-check')) {
    try {
      await withChrome(async (port) => {
        for (const b of built) {
          const c = await checkDocument(b.out, port);
          if (c.pages === null) { console.log(`  ✘ ${b.slug}: the pagination never finished`); code = 1; continue; }
          console.log(`  ${b.slug}: ${c.pages} page${c.pages === 1 ? '' : 's'}`);
          if (b.meta.type === 'one-pager' && c.pages !== 1) { console.log(`  ✘ ${b.slug}: a one-pager on ${c.pages} pages, tighten the text`); code = 1; }
          if (c.overflow) { console.log(`  ✘ ${b.slug}: ${c.overflow} block(s) taller than a page, split them`); code = 1; }
          for (const e of c.errors) { console.log(`  ✘ ${b.slug}: ${e}`); code = 1; }
        }
      });
    } catch (e) {
      console.log(`  ! not checked: ${e.message}`);
      code = Math.max(code, e.code === 2 ? 2 : 1);
    }
  }
  if (flags.has('--pdf')) {
    for (const b of built) {
      const pdf = join(DOCS, b.slug, 'dist', `${b.slug}.pdf`);
      mkdirSync(dirname(pdf), { recursive: true });
      try { await printPdf(b.out, pdf); console.log(`  PDF: ${rel(pdf)}`); } catch (e) { console.log(`  ✘ no PDF: ${e.message}`); code = 1; }
    }
  }
  return code;
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) process.exit(await main(process.argv.slice(2)));
