#!/usr/bin/env node
// Build the packs catalogue: apps/packs/index.html, from packs/*/pack.json.
//
// This is the whole "store", and it is deliberately a page rather than a product.
// The hard part of sharing is triage, not distribution, so what is worth building
// is the thing that makes a pack legible before you install it: what it adds,
// what it needs, and whether anyone is standing behind it.
//
// Read-only, so by the kit's own ladder it is a static page and not an app.

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/packs');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let dirs = [];
try { dirs = (await readdir(join(ROOT, 'packs'), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name); } catch {}

const packs = [];
for (const slug of dirs.sort()) {
  try { packs.push({ slug, ...JSON.parse(await readFile(join(ROOT, 'packs', slug, 'pack.json'), 'utf8')) }); }
  catch { /* check-packs.mjs is what complains about a broken manifest */ }
}

const RANK = { canonical: 0, experimental: 1 };
packs.sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || a.slug.localeCompare(b.slug));

const card = (p) => {
  const adds = Object.entries(p.adds || {})
    .map(([k, v]) => `${[].concat(v).length} ${k}`).join(' · ');
  const settings = Object.entries(p.settings || {});
  return `
  <article class="pack">
    <header>
      <h2>${esc(p.title || p.slug)}</h2>
      <span class="tag ${p.status === 'canonical' ? 'ok' : 'exp'}">${p.status === 'canonical' ? 'maintenu' : 'expérimental'}</span>
    </header>
    <p class="desc">${esc(p.description)}</p>
    ${p.suits ? `<p class="suits"><b>Pour qui</b> · ${esc(p.suits)}</p>` : ''}
    <dl>
      <div><dt>Ajoute</dt><dd>${esc(adds) || '—'}</dd></div>
      <div><dt>Demande</dt><dd>kit ${esc(p.requires?.kit || '?')}${p.requires?.services?.length ? ' · ' + esc(p.requires.services.join(', ')) : ''}</dd></div>
      <div><dt>À régler</dt><dd>${settings.length ? settings.map(([k]) => `<code>${esc(k)}</code>`).join(' ') : 'rien'}</dd></div>
    </dl>
    <p class="path"><code>packs/${esc(p.slug)}/</code> · <span title="Cite this when you report something">${esc(p.id || 'no id')}</span></p>
  </article>`;
};

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Packs</title>
<style>
  :root { --paper:#fbfaf8; --ink:#1a1a1a; --muted:#6b6b6b; --line:#e4e1db; --ok:#1a1a1a; color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { :root { --paper:#131313; --ink:#f2f0ec; --muted:#9a9a9a; --line:#2c2c2c; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.5 ui-sans-serif,-apple-system,system-ui,sans-serif; }
  main { max-width:52rem; margin:0 auto; padding:2.5rem 1rem 4rem; }
  h1 { font-size:1.6rem; margin:0 0 .3rem; letter-spacing:-.01em; }
  .lede { color:var(--muted); font-size:.9rem; margin:0 0 2rem; max-width:40rem; }
  .pack { border:1px solid var(--line); border-radius:.8rem; padding:1.1rem 1.2rem; margin-bottom:1rem; }
  .pack header { display:flex; align-items:baseline; gap:.6rem; }
  .pack h2 { font-size:1.05rem; margin:0; }
  .tag { font-size:.68rem; border:1px solid var(--line); border-radius:999px; padding:.05rem .5rem; color:var(--muted); white-space:nowrap; }
  .tag.ok { border-color:currentColor; color:var(--ink); font-weight:600; }
  .desc { margin:.5rem 0 .3rem; font-size:.9rem; }
  .suits { margin:.2rem 0 .7rem; font-size:.8rem; color:var(--muted); }
  dl { display:grid; grid-template-columns:1fr; gap:.15rem; margin:0 0 .6rem; font-size:.8rem; }
  @media (min-width:34rem) { dl { grid-template-columns:repeat(3,1fr); } }
  dt { color:var(--muted); font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; }
  dd { margin:0; }
  code { font-size:.85em; }
  .path { margin:0; font-size:.75rem; color:var(--muted); }
  .empty { color:var(--muted); font-size:.9rem; }
  footer { margin-top:2rem; font-size:.75rem; color:var(--muted); }
</style>
<main>
  <h1>Packs</h1>
  <p class="lede">Ce que d'autres organisations qui font tourner ce kit ont construit, et qui s'installe
  ailleurs. Un pack ajoute des fichiers et ne modifie jamais ceux du kit&nbsp;: c'est ce qui permet d'en
  installer deux sans arbitrer entre eux. Les règles sont dans <code>source/formats/pack.md</code>.</p>
  ${packs.length ? packs.map(card).join('\n') : '<p class="empty">Aucun pack pour l’instant. Le premier s’extrait d’un projet qui fait déjà tourner la chose.</p>'}
  <footer>« Maintenu » veut dire que quelqu’un répond quand ça casse. « Expérimental » veut dire que
  ça a marché quelque part, et que vous êtes le deuxième.</footer>
</main>
`;

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'index.html'), html);
console.log(`packs page: ${packs.length} pack(s) → apps/packs/index.html`);
