// Measures a built deck in a real browser, every slide, and photographs it.
//
// What a person reviewing slides by eye misses, and what every deck that went wrong had in common:
// the text that runs under the footer on slide 14, the caption cut in half, the 11px label, the
// card row where one card is taller, the slide whose content sits in its top-left corner with the
// rest empty, the photo blown up past its resolution, the figure dark on dark. Each is measured
// here on the laid-out page (?check puts every slide on screen at full size), so the verdict is
// the same on any machine and for any reviewer.
//
//   defects   fail the check: overflow, margin, spill, overlap, clipped, small, image, grid, error,
//             contrast
//   warnings  are read: bunched, sparse, dense, blurry
//
// Thresholds come from the deck's own theme (--dk-min-font, --dk-max-words), so a brand whose
// decks are denser by design says so once, in its theme, rather than arguing with the check.
//
// Then it writes one PNG per slide and a contact sheet to <deck>/.check/. Looking at the sheet is
// part of the check: a measurement finds what is wrong, it does not find what is ugly.

import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { withChrome, openTab } from './chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Runs inside the page, in check mode. */
function auditInPage() {
  const TOL = 2;
  const px = Math.round;
  const out = [];
  const visible = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02 && r.width > 0 && r.height > 0;
  };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();
  const label = (el) => (el.tagName === 'IMG' ? `image ${decodeURIComponent((el.getAttribute('src') || '').split('/').pop()).slice(0, 40)}` : (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70));
  const bleed = (el) => getComputedStyle(el).getPropertyValue('--dk-bleed').trim() === '1' || Boolean(el.closest('.dk-bleed, .dk-foot, .dk-notes'));
  // The kit's stage, or another viewer built on the same classes (an intranet's .dk-frame).
  const slides = [...document.querySelectorAll('.dk-stage > .dk-slide, .dk-frame > .dk-slide')];

  slides.forEach((s, i) => {
    const n = i + 1; // by position: another viewer may use data-n for something else
    const add = (level, issue, el, detail) => out.push({ n, level, issue, text: el ? label(el) : '', detail });
    const sr = s.getBoundingClientRect();
    const cs = getComputedStyle(s);
    const minFont = parseFloat(cs.getPropertyValue('--dk-min-font')) || 13;
    const maxWords = parseFloat(cs.getPropertyValue('--dk-max-words')) || 140;
    const safe = { l: sr.left + parseFloat(cs.paddingLeft), r: sr.right - parseFloat(cs.paddingRight), t: sr.top + parseFloat(cs.paddingTop), b: sr.bottom - parseFloat(cs.paddingBottom) };
    const els = [...s.querySelectorAll('*')].filter(visible);
    const leaves = els.filter((el) => el.tagName === 'IMG' || ownText(el));

    for (const el of leaves) {
      const r = el.getBoundingClientRect();
      const out1 = Math.max(sr.left - r.left, r.right - sr.right, sr.top - r.top, r.bottom - sr.bottom);
      if (!bleed(el) && out1 > 1) { add('defect', 'overflow', el, `runs ${px(out1)}px outside the slide`); continue; }
      if (bleed(el)) continue;
      const out2 = Math.max(safe.l - r.left, r.right - safe.r, safe.t - r.top, r.bottom - safe.b);
      if (out2 > TOL) add('defect', 'margin', el, `runs ${px(out2)}px into the slide's margin${r.bottom - safe.b > TOL ? ' (it collides with the footer)' : ''}`);
    }

    // Text spilling out of its own block, or a block lying over the next one: what a squeezed
    // column or a fixed-height box does to its words while every edge of the slide stays clean.
    for (const el of leaves) {
      if (bleed(el)) continue;
      const box = el.closest('.dk-block, .dk-head');
      if (!box || box === el) continue;
      const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      const spill = Math.max(b.top - r.top, r.bottom - b.bottom, b.left - r.left, r.right - b.right);
      if (spill > TOL) add('defect', 'spill', el, `runs ${px(spill)}px out of its block, over what is next to it`);
    }
    for (const parent of [s.querySelector(':scope > .dk-body'), ...s.querySelectorAll('.dk-col')].filter(Boolean)) {
      const kids = [...parent.children].filter(visible).map((k) => ({ k, r: k.getBoundingClientRect() }));
      for (let x = 1; x < kids.length; x++) {
        const a = kids[x - 1], b = kids[x];
        const over = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        const side = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        if (over > TOL && side > TOL) add('defect', 'overlap', b.k, `lies ${px(over)}px over the block above it`);
      }
    }

    // Text cut by a box that hides its overflow.
    for (const el of els) {
      if (el === s) continue;
      const c = getComputedStyle(el);
      if (!/hidden|clip|auto|scroll/.test(c.overflowX + c.overflowY)) continue;
      if (!el.innerText?.trim()) continue;
      const dy = el.scrollHeight - el.clientHeight;
      const dx = el.scrollWidth - el.clientWidth;
      if (dy > TOL || dx > TOL) add('defect', 'clipped', el, `content cut by ${px(Math.max(dx, dy))}px`);
      if (c.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) add('defect', 'clipped', el, 'text ends in an ellipsis');
    }

    for (const el of leaves) {
      if (el.tagName === 'IMG' || el.closest('.dk-foot')) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < minFont - 0.1) add('defect', 'small', el, `${size}px text (the floor is ${minFont}px)`);
    }

    for (const im of s.querySelectorAll('img')) {
      if (!im.complete || !im.naturalWidth) { add('defect', 'image', im, 'did not load'); continue; }
      if (!visible(im)) continue;
      const r = im.getBoundingClientRect();
      const fit = getComputedStyle(im).objectFit;
      const k = fit === 'contain' ? Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight) : Math.max(r.width / im.naturalWidth, r.height / im.naturalHeight);
      if (k > 1.6 && r.width * r.height > 40000) add('warning', 'blurry', im, `shown at ${k.toFixed(1)}× its resolution (${im.naturalWidth}×${im.naturalHeight})`);
    }

    // Grids of boxes: boxes on one row share a height (layout.md, measured since 2026-09-29).
    const isBox = (el) => {
      if (!visible(el)) return false;
      const c = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 48) return false;
      const bg = c.backgroundColor;
      const hasBg = bg && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(bg);
      const border = ['Top', 'Right', 'Bottom', 'Left'].every((k) => parseFloat(c[`border${k}Width`]) > 0 && c[`border${k}Style`] !== 'none');
      return hasBg || border || (c.boxShadow && c.boxShadow !== 'none');
    };
    for (const c of els) {
      const d = getComputedStyle(c);
      if (!(d.display.includes('grid') || (d.display.includes('flex') && d.flexDirection.startsWith('row')))) continue;
      const kids = [...c.children].filter(isBox).map((k) => ({ k, r: k.getBoundingClientRect() }));
      if (kids.length < 2) continue;
      const overlap = (a, b) => a.left < b.right - TOL && b.left < a.right - TOL && a.top < b.bottom - TOL && b.top < a.bottom - TOL;
      if (kids.some((a, x) => kids.some((b, y) => x < y && overlap(a.r, b.r)))) continue;
      const rows = [];
      for (const it of kids) {
        let row = rows.find((q) => Math.abs(q.top - it.r.top) <= TOL);
        if (!row) rows.push((row = { top: it.r.top, items: [] }));
        row.items.push(it);
      }
      for (const row of rows) {
        const hs = row.items.map((q) => q.r.height);
        if (row.items.length > 1 && Math.max(...hs) - Math.min(...hs) > TOL) add('defect', 'grid', c, `boxes on one row are ${hs.map(px).join(' / ')}px high`);
      }
    }

    // Where the content sits in the space it was given.
    const body = s.querySelector(':scope > .dk-body');
    if (body && (s.dataset.kind || 'slide') === 'slide' && !s.matches('.dk-cover, .dk-divider, .dk-closing, .dk-statement')) {
      const br = body.getBoundingClientRect();
      const inner = leaves.filter((el) => body.contains(el)).map((el) => el.getBoundingClientRect());
      if (inner.length) {
        const u = inner.reduce((a, r) => ({ l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) }), { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
        const below = br.bottom - u.b, above = u.t - br.top, right = br.right - u.r;
        if (u.b - u.t < 0.55 * br.height && below > 1.5 * above + 60) add('warning', 'bunched', body, `content sits at the top, ${px(below)}px empty under it`);
        if (u.r - u.l < 0.62 * br.width && right > 220) add('warning', 'bunched', body, `content sits on the left, ${px(right)}px empty on the right: pair it with an image, a figure or a second column`);
        if (((u.r - u.l) * (u.b - u.t)) / (br.width * br.height) < 0.28) add('warning', 'sparse', body, 'the content fills under a third of the slide');
      }
    }
    const words = (s.innerText || '').replace(s.querySelector('.dk-foot')?.innerText || '', '').split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
    if (words > maxWords) add('warning', 'dense', null, `${words} words (this deck's theme reads up to ${maxWords})`);
  });

  return { slides: slides.map((s, i) => { const r = s.getBoundingClientRect(); return { n: i + 1, title: s.dataset.title, top: r.top + scrollY, left: r.left + scrollX, width: r.width, height: r.height }; }), findings: out };
}

const sheetHtml = (shots, title) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#e9e7e3;font:500 13px/1.3 system-ui,sans-serif;color:#222}
h1{font-size:16px;margin:0 0 16px}main{display:grid;grid-template-columns:repeat(4,320px);gap:18px 14px}
figure{margin:0}img{width:320px;height:180px;display:block;box-shadow:0 1px 4px rgba(0,0,0,.2)}figcaption{margin-top:5px}
.bad img{outline:3px solid #c0392b}.warn img{outline:3px solid #d4a017}</style><h1>${title}</h1><main>${shots.map((s) => `<figure class="${s.cls}"><img src="${s.file}"><figcaption>${s.n}. ${s.title.replace(/</g, '&lt;')}</figcaption></figure>`).join('')}</main>`;

/**
 * Checks one built deck. Returns { defects, warnings, contrast, shots, sheet } or { skipped }.
 * opts: { shots: true, contrast: true, outDir, width, height (the window, 1280×720 by default) }
 */
export async function checkDeck(htmlFile, opts = {}) {
  // A file, or a URL when the page needs a server (absolute /_astro/ paths do not resolve on file://).
  const remote = /^https?:/.test(htmlFile);
  const file = remote ? htmlFile : resolve(htmlFile);
  const url = remote ? `${htmlFile}${htmlFile.includes('?') ? '&' : '?'}check` : `${pathToFileURL(file).href}?check`;
  const outDir = opts.outDir || (remote ? resolve('.check') : join(dirname(file), '.check'));
  let contrastMod = null;
  if (opts.contrast !== false) {
    const p = join(HERE, '..', 'check-contrast.mjs');
    if (existsSync(p)) { try { contrastMod = await import(pathToFileURL(p).href); } catch { contrastMod = null; } }
  }
  try {
    return await withChrome(async (port) => {
      const tab = await openTab(port, { width: opts.width || 1280, height: opts.height || 720 });
      await tab.navigate(url);
      const audit = await tab.evaluate(`(${auditInPage})()`);
      const errors = tab.errors();
      const defects = audit.findings.filter((f) => f.level === 'defect');
      const warnings = audit.findings.filter((f) => f.level === 'warning');
      for (const e of errors) defects.push({ n: 0, level: 'defect', issue: 'error', text: '', detail: e });

      let shots = [];
      let sheet = null;
      if (opts.shots !== false) {
        if (existsSync(outDir)) for (const f of readdirSync(outDir)) if (/^slide-\d+\.png$|^sheet\.png$/.test(f)) rmSync(join(outDir, f));
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, '.gitignore'), '*\n');
        for (const s of audit.slides) {
          const shot = await tab.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: s.left, y: s.top, width: s.width, height: s.height, scale: 1 } });
          const name = `slide-${String(s.n).padStart(2, '0')}.png`;
          writeFileSync(join(outDir, name), Buffer.from(shot.result.data, 'base64'));
          const mine = audit.findings.filter((f) => f.n === s.n);
          shots.push({ n: s.n, title: s.title || '', file: name, cls: mine.some((f) => f.level === 'defect') ? 'bad' : mine.length ? 'warn' : '' });
        }
        writeFileSync(join(outDir, 'sheet.html'), sheetHtml(shots, opts.title || file.split('/').slice(-2).join('/')));
        const rows = Math.ceil(shots.length / 4);
        await tab.send('Emulation.setDeviceMetricsOverride', { width: 4 * 320 + 3 * 14 + 48, height: 70 + rows * 220, deviceScaleFactor: 1, mobile: false });
        await tab.navigate(pathToFileURL(join(outDir, 'sheet.html')).href);
        const pic = await tab.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(join(outDir, 'sheet.png'), Buffer.from(pic.result.data, 'base64'));
        sheet = join(outDir, 'sheet.png');
        shots = shots.map((s) => ({ ...s, file: join(outDir, s.file) }));
      }
      tab.close();

      let contrast = null;
      if (contrastMod?.measure) {
        const m = await contrastMod.measure(port, url);
        contrast = { measured: m.measured, byPixels: m.byPixels, unmeasurable: m.unmeasurable };
        for (const f of m.failures) defects.push({ n: f.slide || 0, level: 'defect', issue: 'contrast', text: f.text, detail: `${f.ratio}:1, needs ${f.min}:1 (${f.fg} on ${f.bg}, ${f.size}px)` });
        for (const u of m.unmeasurable) warnings.push({ n: u.slide || 0, level: 'warning', issue: 'contrast', text: u.text, detail: 'on an image that could not be measured: look at it' });
      }
      return { slides: audit.slides.length, defects, warnings, contrast, shots, sheet };
    });
  } catch (e) {
    if (e.code === 2) return { skipped: e.message };
    throw e;
  }
}

/** Prints a report the way an author reads it: by slide, defects first. Returns the exit code. */
export function printReport(r, { title = '', strict = false, log = console.log } = {}) {
  if (r.skipped) { log(`  ✘ not checked in a browser: ${r.skipped}. Overflow, contrast and grids are unverified.`); return 2; }
  const order = [...r.defects.map((f) => ({ ...f, mark: '✘' })), ...r.warnings.map((f) => ({ ...f, mark: '!' }))].sort((a, b) => a.n - b.n || (a.mark === '✘' ? -1 : 1));
  for (const f of order) log(`  ${f.mark} ${f.n ? `slide ${f.n}` : 'deck'} · ${f.issue}${f.text ? ` «${f.text}»` : ''}: ${f.detail}`);
  const c = r.contrast ? `, contrast measured on ${r.contrast.measured} texts` : ', contrast not measured (no check-contrast.mjs)';
  log(`${r.defects.length ? '✘' : '✓'} ${title}${r.slides} slides: ${r.defects.length} defect(s), ${r.warnings.length} warning(s)${c}`);
  if (r.sheet) log(`  Look at every slide: ${r.sheet}`);
  return r.defects.length || (strict && r.warnings.length) ? 1 : 0;
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) { console.error('usage: node check.mjs <deck>/index.html [--strict] [--no-shots]'); process.exit(2); }
  let code = 0;
  for (const f of files) {
    const r = await checkDeck(f, { shots: !args.includes('--no-shots') });
    code = Math.max(code, printReport(r, { title: `${f}: `, strict: args.includes('--strict') }));
  }
  process.exit(code);
}
