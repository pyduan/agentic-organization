#!/usr/bin/env node
// Reads an old PowerPoint deck as data: what it says, and how it looks, measured.
//
//   node scripts/deck/read-pptx.mjs <file.pptx> [--out=<folder>] [--media=all] [--render]
//
// Writes, next to the .pptx unless --out says otherwise (<name>/):
//   outline.md   every slide's text in order, with its size, weight and colour, its tables, the
//                images it shows and its speaker notes. The facts to fold into the content files.
//   style.md     the deck's design, measured: canvas, fonts, type scale, text and fill colours,
//                the header band if there is one, the images that recur (logos, backgrounds).
//                What a brand deck theme is written from.
//   style.json   the same, for a script.
//   media/       the recurring images (logos, seals, backgrounds), or every image with --media=all
//   slides/      one PNG per slide with --render, when LibreOffice and pdftoppm are installed
//
// Why measure rather than look: a .pptx is a zip of XML that stores every position, size and colour
// exactly. Eyeballing a screenshot got the header height, the type scale and the density wrong
// twice on the deck that taught this; reading the XML got them right the first time. A PDF only
// gives text and pixels, so a .pptx is the better reference whenever there is one.
//
// What it does not do: decide. An old deck mixes facts that have since changed with facts that
// still hold, and several old decks contradict each other. The outline is evidence with a date on
// it; which version is true is the owner's call, made once, in the content files.

import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, basename, extname, posix } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ── Zip ───────────────────────────────────────────────────────────────────────────────────────
export function readZip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file (is it really a .pptx?)');
  let count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  // Zip64: the real values sit in the zip64 end record.
  if (off === 0xffffffff || count === 0xffff) {
    const loc = eocd - 20;
    if (buf.readUInt32LE(loc) === 0x07064b50) {
      const rec = Number(buf.readBigUInt64LE(loc + 8));
      count = Number(buf.readBigUInt64LE(rec + 32));
      off = Number(buf.readBigUInt64LE(rec + 48));
    }
  }
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    let csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28), xlen = buf.readUInt16LE(off + 30), clen = buf.readUInt16LE(off + 32);
    let lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    if (csize === 0xffffffff || lho === 0xffffffff) {
      let x = off + 46 + nlen;
      const end = x + xlen;
      while (x < end) {
        const id = buf.readUInt16LE(x), size = buf.readUInt16LE(x + 2);
        if (id === 1) {
          let y = x + 4;
          if (buf.readUInt32LE(off + 24) === 0xffffffff) y += 8;
          if (csize === 0xffffffff) { csize = Number(buf.readBigUInt64LE(y)); y += 8; }
          if (lho === 0xffffffff) lho = Number(buf.readBigUInt64LE(y));
        }
        x += 4 + size;
      }
    }
    entries.set(name, { method, csize, lho });
    off += 46 + nlen + xlen + clen;
  }
  const get = (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const n = buf.readUInt16LE(e.lho + 26), x = buf.readUInt16LE(e.lho + 28);
    const data = buf.subarray(e.lho + 30 + n + x, e.lho + 30 + n + x + e.csize);
    return e.method === 0 ? data : inflateRawSync(data);
  };
  return { names: [...entries.keys()], get, text: (name) => get(name)?.toString('utf8') ?? null };
}

// ── XML: a small tree, enough for OOXML ───────────────────────────────────────────────────────
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unent = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? m));
export function xml(src) {
  const root = { name: '#root', attrs: {}, kids: [] };
  const stack = [root];
  const re = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[5] !== undefined) { stack.at(-1).kids.push({ text: unent(m[5]) }); continue; } // a run of one space is a word gap
    if (!m[2]) continue;
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    const attrs = {};
    for (const a of m[3].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = unent(a[2] ?? a[3]);
    const node = { name: m[2], attrs, kids: [] };
    stack.at(-1).kids.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}
const local = (n) => n.name?.split(':').pop();
const kids = (n, name) => (n?.kids || []).filter((k) => k.name && (local(k) === name || k.name === name));
const kid = (n, name) => kids(n, name)[0];
const path = (n, ...names) => names.reduce((x, nm) => kid(x, nm), n);
function* walk(n) { yield n; for (const k of n.kids || []) if (k.name) yield* walk(k); }
const textOf = (n) => (n.kids || []).map((k) => (k.text !== undefined ? k.text : textOf(k))).join('');

// ── The deck ──────────────────────────────────────────────────────────────────────────────────
const EMU_PX = 9525; // 914400 EMU per inch, 96 px per inch
const px = (v) => Math.round(Number(v || 0) / EMU_PX);

function rels(zip, part) {
  const p = posix.join(posix.dirname(part), '_rels', `${posix.basename(part)}.rels`);
  const src = zip.text(p);
  const out = {};
  if (!src) return out;
  for (const r of walk(xml(src))) if (local(r) === 'Relationship') out[r.attrs.Id] = { target: posix.normalize(posix.join(posix.dirname(part), r.attrs.Target)), type: r.attrs.Type, external: r.attrs.TargetMode === 'External' };
  return out;
}

function themeOf(zip, master) {
  const r = Object.values(rels(zip, master)).find((x) => /theme$/.test(x.type));
  const src = r && zip.text(r.target);
  const out = { colors: {}, major: null, minor: null };
  if (!src) return out;
  const t = xml(src);
  for (const n of walk(t)) {
    if (local(n) === 'clrScheme') {
      for (const c of n.kids.filter((k) => k.name)) {
        const v = kid(c, 'srgbClr')?.attrs.val || kid(c, 'sysClr')?.attrs.lastClr;
        if (v) out.colors[local(c)] = `#${v.toUpperCase()}`;
      }
    }
    if (local(n) === 'majorFont') out.major = kid(n, 'latin')?.attrs.typeface;
    if (local(n) === 'minorFont') out.minor = kid(n, 'latin')?.attrs.typeface;
  }
  return out;
}

function colorOf(fillParent, theme) {
  if (!fillParent) return null;
  const s = kid(fillParent, 'srgbClr');
  if (s) return `#${s.attrs.val.toUpperCase()}`;
  const sc = kid(fillParent, 'schemeClr');
  if (sc) {
    const map = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };
    return theme.colors[map[sc.attrs.val] || sc.attrs.val] || `scheme:${sc.attrs.val}`;
  }
  return null;
}

function fillOf(spPr, theme) {
  if (!spPr) return null;
  const solid = kid(spPr, 'solidFill');
  if (solid) return { solid: colorOf(solid, theme) };
  const grad = kid(spPr, 'gradFill');
  if (grad) return { gradient: kids(kid(grad, 'gsLst'), 'gs').map((g) => colorOf(g, theme)).filter(Boolean), angle: Number(kid(grad, 'lin')?.attrs.ang || 0) / 60000 };
  return null;
}

function paragraphs(txBody, theme, defaults = {}) {
  const out = [];
  for (const p of kids(txBody, 'p')) {
    const runs = [...walk(p)].filter((n) => local(n) === 'r' || local(n) === 'fld');
    // Runs in order, a line break inside a paragraph read as a space: "systèmes<br>capables".
    const text = [...walk(p)].filter((n) => ['r', 'fld', 'br'].includes(local(n)))
      .map((n) => (local(n) === 'br' ? ' ' : textOf(kid(n, 't') || { kids: [] }))).join('').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const rPr = kid(runs[0], 'rPr') || {};
    const a = rPr.attrs || {};
    const latin = kid(rPr, 'latin')?.attrs.typeface;
    const font = latin === '+mj-lt' ? theme.major : latin === '+mn-lt' || !latin ? (latin ? theme.minor : null) : latin;
    out.push({
      text,
      level: Number(kid(p, 'pPr')?.attrs.lvl || 0),
      size: a.sz ? Number(a.sz) / 100 : defaults.size ?? null,
      bold: a.b === '1' || runs.every((r) => kid(r, 'rPr')?.attrs.b === '1') || Boolean(defaults.bold),
      italic: a.i === '1',
      color: colorOf(kid(rPr, 'solidFill'), theme),
      font,
      bullet: Boolean(kid(kid(p, 'pPr'), 'buChar')) || Boolean(kid(kid(p, 'pPr'), 'buAutoNum')),
    });
  }
  return out;
}

/** One slide: its shapes in reading order, flattened out of their groups. */
function readSlide(zip, part, theme) {
  const doc = xml(zip.text(part));
  const sld = kid(doc, 'sld');
  const hidden = sld?.attrs.show === '0';
  const r = rels(zip, part);
  const shapes = [];
  const visit = (node, ox = 0, oy = 0, sx = 1, sy = 1) => {
    for (const n of node.kids.filter((k) => k.name)) {
      const kind = local(n);
      if (!['sp', 'pic', 'graphicFrame', 'grpSp', 'cxnSp'].includes(kind)) continue;
      const xf = path(n, 'spPr', 'xfrm') || path(n, 'grpSpPr', 'xfrm') || kid(n, 'xfrm');
      const off = kid(xf, 'off')?.attrs || {}, ext = kid(xf, 'ext')?.attrs || {};
      const box = { x: Math.round(ox + px(off.x) * sx), y: Math.round(oy + px(off.y) * sy), w: Math.round(px(ext.cx) * sx), h: Math.round(px(ext.cy) * sy) };
      if (kind === 'grpSp') {
        const ch = kid(xf, 'chOff')?.attrs || {}, che = kid(xf, 'chExt')?.attrs || {};
        const kx = che.cx ? Number(ext.cx) / Number(che.cx) : 1, ky = che.cy ? Number(ext.cy) / Number(che.cy) : 1;
        visit(n, box.x - px(ch.x) * kx * sx, box.y - px(ch.y) * ky * sy, sx * kx, sy * ky);
        continue;
      }
      const nv = [...walk(n)].find((k) => local(k) === 'cNvPr')?.attrs || {};
      const ph = [...walk(n)].find((k) => local(k) === 'ph')?.attrs;
      const shape = { kind, name: nv.name || '', box, placeholder: ph ? ph.type || 'body' : null };
      if (kind === 'sp') {
        shape.geometry = path(n, 'spPr', 'prstGeom')?.attrs.prst || null;
        shape.fill = fillOf(kid(n, 'spPr'), theme);
        shape.paragraphs = paragraphs(kid(n, 'txBody'), theme);
      }
      if (kind === 'pic') {
        const blip = [...walk(n)].find((k) => local(k) === 'blip');
        const rid = blip?.attrs['r:embed'];
        shape.image = rid && r[rid] ? r[rid].target : null;
      }
      if (kind === 'graphicFrame') {
        const tbl = [...walk(n)].find((k) => local(k) === 'tbl');
        if (tbl) shape.table = kids(tbl, 'tr').map((tr) => kids(tr, 'tc').map((tc) => paragraphs(kid(tc, 'txBody'), theme).map((p) => p.text).join(' ')));
        const chart = [...walk(n)].find((k) => local(k) === 'chart');
        if (chart) shape.chart = true;
      }
      shapes.push(shape);
    }
  };
  const tree = path(sld, 'cSld', 'spTree');
  if (tree) visit(tree);
  let notes = '';
  const nrel = Object.values(r).find((x) => /notesSlide$/.test(x.type));
  if (nrel) {
    const nd = xml(zip.text(nrel.target) || '');
    notes = [...walk(nd)].filter((k) => local(k) === 'sp' && [...walk(k)].some((q) => local(q) === 'ph' && q.attrs.type === 'body'))
      .flatMap((sp) => paragraphs(kid(sp, 'txBody'), theme).map((p) => p.text)).join('\n');
  }
  const layout = Object.values(r).find((x) => /slideLayout$/.test(x.type));
  const layoutName = layout ? [...walk(xml(zip.text(layout.target) || ''))].find((k) => local(k) === 'cSld')?.attrs.name : null;
  return { part, hidden, shapes, notes, layout: layoutName };
}

export function readPptx(file) {
  const zip = readZip(readFileSync(file));
  const pres = xml(zip.text('ppt/presentation.xml'));
  const presEl = kid(pres, 'presentation');
  const size = kid(presEl, 'sldSz')?.attrs || {};
  const canvas = { w: px(size.cx), h: px(size.cy) };
  const prel = rels(zip, 'ppt/presentation.xml');
  const order = kids(kid(presEl, 'sldIdLst'), 'sldId').map((s) => prel[s.attrs['r:id']]?.target).filter(Boolean);
  const master = Object.values(prel).find((x) => /slideMaster$/.test(x.type))?.target;
  const theme = master ? themeOf(zip, master) : { colors: {} };
  const slides = order.map((part, i) => ({ n: i + 1, ...readSlide(zip, part, theme) }));
  return { file, canvas, theme, slides, zip };
}

// ── What the deck says ────────────────────────────────────────────────────────────────────────
function titleOf(slide, canvas) {
  const ph = slide.shapes.find((s) => ['title', 'ctrTitle'].includes(s.placeholder) && s.paragraphs?.length);
  if (ph) return ph.paragraphs.map((p) => p.text).join(' ');
  // The largest sized text near the top, else the largest on the slide (a cover's title sits low).
  const all = slide.shapes.filter((s) => s.paragraphs?.length).flatMap((s) => s.paragraphs.map((p) => ({ ...p, y: s.box.y }))).filter((p) => p.size);
  const bySize = (a, b) => b.size - a.size || a.y - b.y;
  const top = all.filter((p) => p.y < canvas.h * 0.22 && p.size >= 18).sort(bySize);
  const big = [...all].sort(bySize)[0];
  if (!top[0] || (big && big.size > top[0].size * 1.4 && big.y < canvas.h * 0.6)) return big?.text || '';
  return top[0].text;
}

export function outline(deck, name) {
  const lines = [`# ${name}`, '', `Read on ${new Date().toISOString().slice(0, 10)} by scripts/deck/read-pptx.mjs: ${deck.slides.length} slides, canvas ${deck.canvas.w} × ${deck.canvas.h}.`,
    'Dated evidence, not a source of truth: a fact taken from here goes into the content files with this deck and its date as its source.', ''];
  for (const s of deck.slides) {
    const title = titleOf(s, deck.canvas);
    lines.push(`## ${s.n}. ${title || '(untitled)'}${s.hidden ? ' (hidden)' : ''}`, '');
    const texts = s.shapes.filter((x) => x.paragraphs?.length).sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
    for (const sh of texts) {
      for (const p of sh.paragraphs) {
        if (p.text === title) continue;
        const tag = [p.size && `${p.size}pt`, p.bold && 'bold', p.italic && 'italic', p.color && p.color !== '#000000' && p.color].filter(Boolean).join(' ');
        lines.push(`${'  '.repeat(p.level)}- ${p.text}${tag ? `  _(${tag})_` : ''}`);
      }
    }
    for (const t of s.shapes.filter((x) => x.table)) {
      lines.push('', ...t.table.map((row, i) => `| ${row.join(' | ')} |${i === 0 ? `\n|${row.map(() => ' --- |').join('')}` : ''}`));
    }
    const pics = s.shapes.filter((x) => x.image);
    const big = pics.filter((p) => p.box.w * p.box.h > deck.canvas.w * deck.canvas.h * 0.25 && !(p.box.w > deck.canvas.w * 0.95 && p.box.h < deck.canvas.h * 0.4));
    if (big.length && !texts.some((t) => t.box.y > deck.canvas.h * 0.18)) lines.push(`- **This slide's content is an image** (${big.map((b) => basename(b.image)).join(', ')}): its text cannot be read here, open the image and retype its facts.`);
    if (pics.length) lines.push(`- Images: ${pics.map((p) => `${basename(p.image || '?')} (${p.box.w}×${p.box.h} at ${p.box.x},${p.box.y})`).join(', ')}`);
    if (s.shapes.some((x) => x.chart)) lines.push('- A PowerPoint chart: its data is in the .pptx, not in this text.');
    if (s.notes) lines.push('', `> Notes: ${s.notes.replace(/\n/g, ' / ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ── How it looks ──────────────────────────────────────────────────────────────────────────────
const tally = (arr) => [...arr.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);

export function style(deck) {
  const visible = deck.slides.filter((s) => !s.hidden);
  const paras = visible.flatMap((s) => s.shapes.flatMap((x) => x.paragraphs || []));
  const fonts = tally(paras.map((p) => p.font || deck.theme.minor || '?'));
  const sizes = tally(paras.filter((p) => p.size).map((p) => `${p.size}${p.bold ? 'B' : ''}`)).map(([k, n]) => {
    const pt = parseFloat(k);
    return { pt, bold: k.endsWith('B'), px: Math.round(pt * 96 / 72 * (1280 / (deck.canvas.w || 1280)) * 10) / 10, count: n };
  });
  const textColors = tally(paras.map((p) => p.color || 'default'));
  const fills = tally(visible.flatMap((s) => s.shapes.filter((x) => x.fill).map((x) => (x.fill.solid ? x.fill.solid : `gradient ${x.fill.gradient.join(' → ')}`))));
  // A band across the top of most slides: the header the deck is recognised by.
  const bands = visible.map((s) => s.shapes.find((x) => x.box.y <= deck.canvas.h * 0.05 && x.box.w >= deck.canvas.w * 0.8 && x.box.h < deck.canvas.h * 0.4 && (x.fill || x.image)))
    .filter(Boolean);
  // What shows of it: an arrow shape's shaft is half its height, and nothing shows above the slide.
  const shown = (b) => {
    let top = b.box.y, bottom = b.box.y + b.box.h;
    if (b.geometry === 'rightArrow' || b.geometry === 'leftArrow') { top = b.box.y + b.box.h / 4; bottom = b.box.y + (3 * b.box.h) / 4; }
    return { top: Math.max(0, Math.round(top)), height: Math.round(Math.min(deck.canvas.h, bottom) - Math.max(0, top)) };
  };
  const band = bands.length >= visible.length * 0.4 ? tally(bands.map((b) => JSON.stringify({ y: b.box.y, h: b.box.h, shown: shown(b), fill: b.fill || { image: basename(b.image) }, geometry: b.geometry }))) : [];
  const pics = visible.flatMap((s) => s.shapes.filter((x) => x.image).map((x) => ({ ...x, n: s.n })));
  const recurring = tally(pics.map((p) => p.image)).filter(([, n]) => n >= 2).map(([image, n]) => {
    const at = pics.filter((p) => p.image === image);
    const b = at[0].box;
    const role = b.w >= deck.canvas.w * 0.9 ? 'background' : b.y > deck.canvas.h * 0.75 ? 'bottom of the slide' : b.y < deck.canvas.h * 0.15 ? 'top of the slide' : 'in the slide';
    return { image, slides: n, box: b, role };
  });
  const lefts = tally(visible.flatMap((s) => s.shapes.filter((x) => x.paragraphs?.length && x.box.w < deck.canvas.w * 0.95).map((x) => Math.round(x.box.x / 4) * 4))).slice(0, 5);
  const words = visible.map((s) => s.shapes.flatMap((x) => x.paragraphs || []).reduce((a, p) => a + p.text.split(/\s+/).length, 0)).sort((a, b) => a - b);
  const layouts = tally(visible.map((s) => s.layout || '?'));
  return {
    canvas: deck.canvas,
    theme: { fonts: { major: deck.theme.major, minor: deck.theme.minor }, colors: deck.theme.colors },
    fonts, sizes, textColors, fills: fills.slice(0, 16), band: band.map(([k, n]) => ({ ...JSON.parse(k), slides: n })),
    recurring, lefts, layouts,
    words: { median: words[Math.floor(words.length / 2)] || 0, max: words.at(-1) || 0 },
    slides: { total: deck.slides.length, hidden: deck.slides.length - visible.length, imageOnly: 0 },
  };
}

export function styleMd(st, name) {
  const scale = 1280 / (st.canvas.w || 1280);
  const L = [`# The measured style of ${name}`, '',
    `Canvas: ${st.canvas.w} × ${st.canvas.h} px${st.canvas.w === 1280 ? ', the size of the deck engine: positions carry over as they are.' : `; multiply by ${scale.toFixed(3)} for the engine's 1280 × 720 stage.`}`,
    `Theme fonts: titles ${st.theme.fonts.major || '?'}, text ${st.theme.fonts.minor || '?'}. Fonts actually used: ${st.fonts.slice(0, 4).map(([f, n]) => `${f} (${n})`).join(', ')}.`,
    `Density: ${st.words.median} words per slide (median), ${st.words.max} at most.`, '',
    '## Type scale', '', '| pt | px (1280 stage) | bold | count |', '| --- | --- | --- | --- |',
    ...st.sizes.slice(0, 14).map((s) => `| ${s.pt} | ${s.px} | ${s.bold ? 'yes' : ''} | ${s.count} |`), '',
    '## Text colours', '', ...st.textColors.slice(0, 10).map(([c, n]) => `- ${c}: ${n} paragraphs`), '',
    '## Fills and gradients', '', ...st.fills.map(([c, n]) => `- ${c}: ${n} shapes`), ''];
  if (st.band.length) L.push('## The header band', '', ...st.band.map((b) => `- visible from y = ${b.shown.top}, ${b.shown.height} px high, ${b.fill.gradient ? `gradient ${b.fill.gradient.join(' → ')}` : b.fill.solid || `image ${b.fill.image}`}${b.geometry ? ` (a ${b.geometry} shape placed at y = ${b.y}, ${b.h} px high)` : ''}, on ${b.slides} slides`), '');
  if (st.recurring.length) L.push('## Recurring images', '', 'Copied into media/: logos, seals and backgrounds are among them; the rest are project photos.', '',
    ...st.recurring.slice(0, 16).map((r) => `- ${basename(r.image)}: ${r.role}, on ${r.slides} slides, ${r.box.w} × ${r.box.h} at (${r.box.x}, ${r.box.y})`), st.recurring.length > 16 ? `- and ${st.recurring.length - 16} more, on two slides each` : '', '');
  L.push('## Margins', '', `Most frequent left edges of text boxes: ${st.lefts.map(([x, n]) => `${x} px (${n})`).join(', ')}.`, '',
    '## Layouts', '', ...st.layouts.map(([l, n]) => `- ${l}: ${n}`), '',
    'For a deck theme: sizes go into `--dk-size-*`, colours into `--dk-*`, the band and the recurring images into the brand\'s `theme.css`. A text colour that fails the contrast check keeps its hue in graphics and takes a darker shade as text: `check-contrast` says which.');
  return L.join('\n');
}

// ── Command ───────────────────────────────────────────────────────────────────────────────────
const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
  if (!files.length) { console.error('usage: node scripts/deck/read-pptx.mjs <file.pptx> [--out=<folder>] [--media=all] [--render]'); process.exit(2); }
  for (const f of files) {
    const file = resolve(f);
    const name = basename(file, extname(file));
    const out = resolve(opt.out && files.length === 1 ? opt.out : join(dirname(file), name));
    mkdirSync(join(out, 'media'), { recursive: true });
    const deck = readPptx(file);
    const st = style(deck);
    writeFileSync(join(out, 'outline.md'), outline(deck, name));
    writeFileSync(join(out, 'style.md'), styleMd(st, name));
    writeFileSync(join(out, 'style.json'), JSON.stringify(st, null, 2));
    const wanted = opt.media === 'all' ? deck.zip.names.filter((n) => n.startsWith('ppt/media/')) : st.recurring.map((r) => r.image);
    for (const m of wanted) { const d = deck.zip.get(m); if (d) writeFileSync(join(out, 'media', basename(m)), d); }
    let rendered = '';
    if (opt.render) {
      try {
        execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', out, file], { stdio: 'ignore', timeout: 600000 });
        mkdirSync(join(out, 'slides'), { recursive: true });
        execFileSync('pdftoppm', ['-r', '72', '-png', join(out, `${name}.pdf`), join(out, 'slides', 's')], { stdio: 'ignore' });
        rendered = `, slides rendered in ${join(out, 'slides')}`;
      } catch { rendered = ', no render (LibreOffice and pdftoppm are needed; the outline and the measurements do not need them)'; }
    }
    console.log(`${name}: ${deck.slides.length} slides (${st.slides.hidden} hidden), ${st.recurring.length} recurring images → ${out}/outline.md, style.md, media/${rendered}`);
  }
}
