#!/usr/bin/env node
// Is every piece of text on a page readable against what is behind it?
//
// A deck went live with its four headline figures dark green on a green ground,
// contrast 1.26, invisible; the owner saw it on the published version. A full sweep
// then found thirty more texts under the threshold. The deck's dominant colour had
// been inverted and only the component someone suspected was checked. A visual
// change made to a whole document is checked on the whole document, by measurement,
// and that is what this does: every element carrying text, on every slide including
// the hidden ones, against the WCAG thresholds (4.5:1, or 3:1 for large text).
//
// It drives the Chrome already on the machine through its debugging protocol, so it
// installs nothing. Each text is first measured from the styles, against the worst
// colour any ground behind it can take. When that verdict rests on a gradient or an
// image, which the styles cannot place, the text is hidden and the pixels actually
// painted under it are measured instead: a glow in the opposite corner of a slide no
// longer fails a title, and a title over a photo is measured rather than waved
// through. A text that cannot be brought on screen keeps the strict verdict. A run
// that measured nothing exits 2: no verdict is printed over nothing.
//
// Pixels are measured at one window size (--viewport, 1440x900 by default), so a
// responsive page is worth a second run at phone width. Text over an <img> or a
// <video> placed behind it is still measured against the styles only.
//
// Usage:
//   node scripts/check-contrast.mjs site/public/decks/<slug>/index.html [more files or URLs]
//   node scripts/check-contrast.mjs <file> --json
//   node scripts/check-contrast.mjs <file> --viewport=390x844
//   CHROME_PATH=/path/to/chrome node scripts/check-contrast.mjs <file>
//
// Exit: 0 all readable · 1 something under the threshold · 2 nothing measured or no browser.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const targets = args.filter((a) => !a.startsWith('--'));
const [WIDTH, HEIGHT] = (args.find((a) => a.startsWith('--viewport='))?.slice(11) || '1440x900').split('x').map(Number);

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const mac = ['Google Chrome', 'Chromium', 'Microsoft Edge', 'Brave Browser']
    .map((n) => `/Applications/${n}.app/Contents/MacOS/${n}`);
  const win = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
    .flatMap((d) => [join(d, 'Google/Chrome/Application/chrome.exe'), join(d, 'Microsoft/Edge/Application/msedge.exe')]);
  for (const p of platform() === 'darwin' ? mac : platform() === 'win32' ? win : []) if (existsSync(p)) return p;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch { /* next */ }
  }
  return null;
}

/** Runs inside the page. Returns { measured, failures, unmeasurable }. */
function measureInPage() {
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a: Number.isNaN(a) ? 1 : a };
  };
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a), a: 1,
  });
  const lum = ({ r, g, b }) => [r, g, b].map((v) => {
    const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }).reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  // The grounds actually behind an element: its own and its ancestors' layers,
  // composited from the page up. A gradient is measured at every one of its colour
  // stops and the worst one counts, so a soft glow over a solid colour is measured
  // rather than excused. Only a real image (url()) makes the text unmeasurable.
  const backgroundOf = (el) => {
    const layers = [];
    let gradient = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const img = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : '';
      if (/url\(/.test(img)) return { image: true };
      if (img) gradient = true;
      const stops = img ? (img.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean) : [];
      const c = parse(cs.backgroundColor);
      if ((c && c.a > 0) || stops.length) layers.push({ c: c && c.a > 0 ? c : null, stops });
      if (c && c.a >= 1) break;
    }
    let grounds = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (const { c, stops } of layers.reverse()) {
      if (c) grounds = grounds.map((g) => over(c, g));
      // A transparent stop composites to the ground below, so it is covered by the map.
      if (stops.length) grounds = grounds.flatMap((g) => stops.map((st) => over(st, g)));
      // Only the extremes can give the worst contrast: keep the darkest and the lightest.
      grounds.sort((a, b) => lum(a) - lum(b));
      if (grounds.length > 2) grounds = [grounds[0], grounds[grounds.length - 1]];
    }
    return { grounds, gradient };
  };
  const slideOf = (el) => {
    const s = el.closest('section, .slide, [data-slide]');
    if (!s) return null;
    const all = [...document.querySelectorAll('section, .slide, [data-slide]')];
    return all.indexOf(s) + 1;
  };

  let measured = 0;
  let probes = 0;
  const failures = [];
  const unmeasurable = [];
  // A verdict the styles cannot settle is marked, so the pixels can settle it later.
  const probe = (el) => { el.setAttribute('data-contrast-probe', String(++probes)); return probes; };
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'svg', 'SVG'].includes(el.tagName)) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const bgr = backgroundOf(el);
    const where = { text: text.slice(0, 60), slide: slideOf(el), tag: el.tagName.toLowerCase() };
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const min = large ? 3 : 4.5;
    if (bgr.image) { unmeasurable.push({ ...where, min, fg: hex(fg), size, color: fg, probe: probe(el) }); continue; }
    let worst = null;
    for (const g of bgr.grounds) {
      const r = ratio(over(fg, g), g);
      if (!worst || r < worst.r) worst = { r, g };
    }
    measured++;
    if (worst.r < min) {
      failures.push({ ...where, ratio: Math.round(worst.r * 100) / 100, min, fg: hex(fg), bg: hex(worst.g), size,
        ...(bgr.gradient ? { color: fg, probe: probe(el) } : {}) });
    }
  }
  return { measured, failures, unmeasurable };
}

/** Runs inside the page: hides every text and freezes motion, so a screenshot shows only the grounds. */
function hideTextInPage() {
  const s = document.createElement('style');
  s.textContent = '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;'
    + 'text-shadow:none!important;transition:none!important;animation:none!important;scroll-behavior:auto!important}';
  document.head.append(s);
}

/** Runs inside the page: brings one marked text on screen and returns the box its own text paints, in page coordinates. */
async function boxInPage(n) {
  const el = document.querySelector(`[data-contrast-probe="${n}"]`);
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  // Two frames for the layout, then a moment for anything that reveals itself on scroll.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 80));
  // A text in a layer still faded out once on screen (the next screen of a phone demo,
  // say) is not painted, so the pixels under it belong to something else.
  for (let a = el; a; a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (Number(cs.opacity) === 0 || cs.visibility === 'hidden') return null;
  }
  // The text's own lines, not the element's box: a heading's block runs the full width
  // of its column, and the far end of it may sit on a ground the words never touch.
  let box = null;
  for (const t of el.childNodes) {
    if (t.nodeType !== 3 || !t.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(t);
    for (const q of range.getClientRects()) {
      if (q.width < 1 || q.height < 1) continue;
      box = box ? { l: Math.min(box.l, q.left), t: Math.min(box.t, q.top), r: Math.max(box.r, q.right), b: Math.max(box.b, q.bottom) }
        : { l: q.left, t: q.top, r: q.right, b: q.bottom };
    }
  }
  if (!box) return null;
  // Only what is painted: the window, and every ancestor that clips its content.
  const clip = (q) => { box = { l: Math.max(box.l, q.left), t: Math.max(box.t, q.top), r: Math.min(box.r, q.right), b: Math.min(box.b, q.bottom) }; };
  clip({ left: 0, top: 0, right: innerWidth, bottom: innerHeight });
  for (let a = el.parentElement; a; a = a.parentElement) {
    if (getComputedStyle(a).overflow !== 'visible') clip(a.getBoundingClientRect());
  }
  if (box.r - box.l < 1 || box.b - box.t < 1) return null;
  return { x: box.l + scrollX, y: box.t + scrollY, width: box.r - box.l, height: box.b - box.t };
}

/** Runs inside the page: the contrast of a colour against the pixels of a screenshot. */
async function groundInPage(src, fg) {
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a), a: 1,
  });
  const lum = ({ r, g, b }) => [r, g, b].map((v) => {
    const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }).reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const byColour = new Map();
  const all = [];
  for (let i = 0; i < d.length; i += 4) {
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let r = byColour.get(key);
    if (r === undefined) {
      const g = { r: d[i], g: d[i + 1], b: d[i + 2], a: 1 };
      r = ratio(over(fg, g), g);
      byColour.set(key, r);
    }
    all.push([r, key]);
  }
  if (!all.length) return null;
  all.sort((a, b) => a[0] - b[0]);
  // The worst pixel counts, less the worst one percent: an antialiased border or a
  // decorative dot inside the line is not what the words are read against.
  const [r, key] = all[Math.min(all.length - 1, Math.floor(all.length * 0.01))];
  return { ratio: Math.round(r * 100) / 100, bg: '#' + key.toString(16).padStart(6, '0') };
}

async function withChrome(fn) {
  const chrome = findChrome();
  if (!chrome) throw Object.assign(new Error('No Chrome, Chromium or Edge found. Set CHROME_PATH.'), { code: 2 });
  const profile = mkdtempSync(join(tmpdir(), 'contrast-'));
  const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let port = null;
    for (let i = 0; i < 100 && !port; i++) {
      try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); }
      catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    if (!port) throw Object.assign(new Error('Chrome started but never opened its debugging port.'), { code: 2 });
    return await fn(port);
  } finally {
    proc.kill();
    await new Promise((r) => setTimeout(r, 200));
    rmSync(profile, { recursive: true, force: true });
  }
}

async function measure(port, url) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d);
  };
  const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.result?.exceptionDetails) throw new Error(`measuring ${url}: ${res.result.exceptionDetails.exception?.description || res.result.exceptionDetails.text}`);
    return res.result.result.value;
  };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  for (let i = 0; i < 150 && !events.some((e) => e.method === 'Page.loadEventFired'); i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 300)); // late styles and web fonts
  const out = await evaluate(`(${measureInPage})()`);

  // What the styles could not settle, the pixels do.
  const open = [...out.failures, ...out.unmeasurable].filter((x) => x.probe);
  if (open.length) {
    await evaluate(`(${hideTextInPage})()`);
    for (const x of open) {
      const box = await evaluate(`(${boxInPage})(${x.probe})`);
      if (!box) continue;
      const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: 1 } });
      if (!shot.result?.data) continue;
      const g = await evaluate(`(${groundInPage})(${JSON.stringify(`data:image/png;base64,${shot.result.data}`)}, ${JSON.stringify(x.color)})`);
      if (g) Object.assign(x, g, { by: 'pixels' });
    }
  }
  ws.close();
  const clean = ({ color, probe, ...x }) => x;
  const pixelled = out.unmeasurable.filter((u) => u.by === 'pixels');
  return {
    measured: out.measured + pixelled.length,
    failures: [...out.failures, ...pixelled].filter((f) => f.ratio < f.min).map(clean),
    unmeasurable: out.unmeasurable.filter((u) => u.by !== 'pixels').map(({ min, fg, size, ...u }) => clean(u)),
    byPixels: open.filter((x) => x.by === 'pixels').length,
  };
}

if (!targets.length) {
  console.error('Name one or more HTML files or URLs to check.');
  process.exit(2);
}

let code = 0;
try {
  const results = await withChrome(async (port) => {
    const out = [];
    for (const t of targets) {
      const url = /^https?:|^file:/.test(t) ? t : pathToFileURL(resolve(t)).href;
      out.push({ target: t, ...(await measure(port, url)) });
    }
    return out;
  });
  if (AS_JSON) console.log(JSON.stringify(results, null, 2));
  for (const r of results) {
    if (!AS_JSON) {
      for (const f of r.failures) {
        console.log(`  ✘ ${f.slide ? `slide ${f.slide} · ` : ''}${f.tag} «${f.text}» ${f.ratio}:1 (needs ${f.min}:1) — ${f.fg} on ${f.bg}, ${f.size}px${f.by === 'pixels' ? ', on the painted pixels' : ''}`);
      }
      for (const u of r.unmeasurable.slice(0, 10)) console.log(`  ? ${u.slide ? `slide ${u.slide} · ` : ''}«${u.text}» sits on an image that could not be brought on screen: check it by eye`);
      if (r.unmeasurable.length > 10) console.log(`  ? … and ${r.unmeasurable.length - 10} more on images`);
      const verdict = !r.measured ? '✘ measured nothing' : r.failures.length ? '✘' : '✓';
      console.log(`${verdict} ${r.target}: ${r.measured} text(s) measured (${r.byPixels} on the painted pixels, at ${WIDTH}x${HEIGHT}), `
        + `${r.failures.length} under the threshold, ${r.unmeasurable.length} not measurable`);
    }
    if (!r.measured) code = Math.max(code, 2);
    else if (r.failures.length) code = Math.max(code, 1);
  }
} catch (e) {
  console.error(`check-contrast: ${e.message}`);
  code = e.code || 2;
}
process.exit(code);
