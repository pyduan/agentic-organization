// check-contrast on a fixture deck. Skipped, and saying why, on a machine with no
// Chrome: a test that cannot run must not pass.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'check-contrast.mjs');
const HAS_CHROME = process.env.CHROME_PATH || ['Google Chrome', 'Chromium', 'Microsoft Edge']
  .some((n) => existsSync(`/Applications/${n}.app/Contents/MacOS/${n}`))
  || spawnSync('which', ['google-chrome']).status === 0 || spawnSync('which', ['chromium']).status === 0;

const deck = (body) => {
  const dir = mkdtempSync(join(tmpdir(), 'contrast-'));
  writeFileSync(join(dir, 'index.html'), `<html><body style="background:#fff;font-family:sans-serif">${body}</body></html>`);
  return join(dir, 'index.html');
};
const run = (file) => spawnSync('node', [SCRIPT, file, '--json'], { encoding: 'utf8' });

test('dark on dark is caught, on a hidden slide too, and a gradient is measured at its worst stop', { skip: !HAS_CHROME && 'no Chrome on this machine' }, () => {
  const r = run(deck(`
    <section style="background:#2e6b3c;color:#fff"><h1>Fine</h1><p style="color:#1f4d2b;font-size:40px;font-weight:700">12 000</p></section>
    <section style="display:none"><p style="color:#bbb">Too light</p></section>
    <section style="background:#fff linear-gradient(#000,#333)"><p style="color:#eee">Fine on dark</p></section>
    <section style="background:#fff radial-gradient(rgba(255,255,255,.9),transparent)"><p style="color:#ddd">Pale on a glow</p></section>`));
  assert.equal(r.status, 1, r.stderr);
  const [res] = JSON.parse(r.stdout);
  const failing = res.failures.map((f) => f.text);
  assert.deepEqual(failing.sort(), ['12 000', 'Pale on a glow', 'Too light']);
});

test('a page whose text all reads passes, and a page with no text gets no verdict', { skip: !HAS_CHROME && 'no Chrome on this machine' }, () => {
  assert.equal(run(deck('<section style="background:#111;color:#fafafa"><p>Readable</p></section>')).status, 0);
  assert.equal(run(deck('<div></div>')).status, 2, 'measuring nothing is not passing');
});

test('a glow is judged where it is painted, and a photo is measured rather than waved through', { skip: !HAS_CHROME && 'no Chrome on this machine' }, () => {
  const glow = 'radial-gradient(120% 130% at 0% 100%,rgba(236,122,60,.07),transparent 42%),#F5EEE1';
  const photo = (fill) => `url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#${fill}"/></svg>`)}')`;
  const r = run(deck(`
    <section style="position:relative;width:1200px;height:675px;background:${glow}">
      <p style="position:absolute;top:20px;left:40px;margin:0;font-size:15px;color:#B0501E">Kicker far from the glow</p>
      <p style="position:absolute;bottom:8px;left:8px;margin:0;font-size:15px;color:#B0501E">Caption inside the glow</p>
    </section>
    <section style="background:${photo('111')};padding:20px"><p style="color:#fafafa">Light on a dark photo</p><p style="color:#333">Dark on a dark photo</p></section>
    <section style="display:none;background:${photo('111')}"><p style="color:#fafafa">On a photo nobody can see</p></section>`));
  assert.equal(r.status, 1, r.stderr);
  const [res] = JSON.parse(r.stdout);
  assert.deepEqual(res.failures.map((f) => f.text).sort(), ['Caption inside the glow', 'Dark on a dark photo']);
  assert.ok(res.failures.every((f) => f.by === 'pixels'));
  assert.deepEqual(res.unmeasurable.map((u) => u.text), ['On a photo nobody can see'], 'what cannot be shown stays unmeasured, never passed');
});
