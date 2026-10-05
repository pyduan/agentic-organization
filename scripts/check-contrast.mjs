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
// installs nothing. Text over an image or a gradient cannot be measured honestly and
// is listed as such, never counted as passing. A run that measured nothing exits 2:
// no verdict is printed over nothing.
//
// Usage:
//   node scripts/check-contrast.mjs site/public/decks/<slug>/index.html [more files or URLs]
//   node scripts/check-contrast.mjs <file> --json
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
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const img = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : '';
      if (/url\(/.test(img)) return { image: true };
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
    return { grounds };
  };
  const slideOf = (el) => {
    const s = el.closest('section, .slide, [data-slide]');
    if (!s) return null;
    const all = [...document.querySelectorAll('section, .slide, [data-slide]')];
    return all.indexOf(s) + 1;
  };

  let measured = 0;
  const failures = [];
  const unmeasurable = [];
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
    if (bgr.image) { unmeasurable.push(where); continue; }
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const min = large ? 3 : 4.5;
    let worst = null;
    for (const g of bgr.grounds) {
      const r = ratio(over(fg, g), g);
      if (!worst || r < worst.r) worst = { r, g };
    }
    measured++;
    if (worst.r < min) failures.push({ ...where, ratio: Math.round(worst.r * 100) / 100, min, fg: hex(fg), bg: hex(worst.g), size });
  }
  return { measured, failures, unmeasurable };
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
  await send('Page.enable');
  await send('Page.navigate', { url });
  for (let i = 0; i < 150 && !events.some((e) => e.method === 'Page.loadEventFired'); i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 300)); // late styles and web fonts
  const res = await send('Runtime.evaluate', { expression: `(${measureInPage})()`, returnByValue: true });
  ws.close();
  if (res.result?.exceptionDetails) throw new Error(`measuring ${url}: ${res.result.exceptionDetails.text}`);
  return res.result.result.value;
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
        console.log(`  ✘ ${f.slide ? `slide ${f.slide} · ` : ''}${f.tag} «${f.text}» ${f.ratio}:1 (needs ${f.min}:1) — ${f.fg} on ${f.bg}, ${f.size}px`);
      }
      for (const u of r.unmeasurable.slice(0, 10)) console.log(`  ? ${u.slide ? `slide ${u.slide} · ` : ''}«${u.text}» sits on an image or gradient: check it by eye`);
      if (r.unmeasurable.length > 10) console.log(`  ? … and ${r.unmeasurable.length - 10} more on images or gradients`);
      const verdict = !r.measured ? '✘ measured nothing' : r.failures.length ? '✘' : '✓';
      console.log(`${verdict} ${r.target}: ${r.measured} text(s) measured, ${r.failures.length} under the threshold, ${r.unmeasurable.length} on an image`);
    }
    if (!r.measured) code = Math.max(code, 2);
    else if (r.failures.length) code = Math.max(code, 1);
  }
} catch (e) {
  console.error(`check-contrast: ${e.message}`);
  code = e.code || 2;
}
process.exit(code);
