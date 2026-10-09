// The Chrome already on the machine, driven through its debugging protocol: nothing to install.
// Shared by the deck checker, the PDF export and the screenshots.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const mac = ['Google Chrome', 'Chromium', 'Microsoft Edge', 'Brave Browser'].map((n) => `/Applications/${n}.app/Contents/MacOS/${n}`);
  const win = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
    .flatMap((d) => [join(d, 'Google/Chrome/Application/chrome.exe'), join(d, 'Microsoft/Edge/Application/msedge.exe')]);
  for (const p of platform() === 'darwin' ? mac : platform() === 'win32' ? win : []) if (existsSync(p)) return p;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    try { return execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* next */ }
  }
  return null;
}

/** Starts a headless Chrome on a throwaway profile, hands its port to fn, and always cleans up. */
export async function withChrome(fn) {
  const chrome = findChrome();
  if (!chrome) throw Object.assign(new Error('no Chrome, Chromium or Edge found (set CHROME_PATH)'), { code: 2 });
  const profile = mkdtempSync(join(tmpdir(), 'deck-'));
  const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--allow-file-access-from-files', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let port = null;
    for (let i = 0; i < 150 && !port; i++) {
      try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    if (!port) throw Object.assign(new Error('Chrome started but never opened its debugging port'), { code: 2 });
    return await fn(port);
  } finally {
    proc.kill();
    await new Promise((r) => setTimeout(r, 200));
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file on Windows */ }
  }
}

/** A tab: send(method, params), evaluate(fn-source), and the events it saw. */
export async function openTab(port, { width = 1280, height = 720 } = {}) {
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
    if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.description || res.result.exceptionDetails.text);
    return res.result?.result?.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const navigate = async (url) => {
    events.length = 0;
    await send('Page.navigate', { url });
    for (let i = 0; i < 300 && !events.some((e) => e.method === 'Page.loadEventFired'); i++) await new Promise((r) => setTimeout(r, 50));
    await evaluate('document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))');
  };
  const errors = () => events.flatMap((e) => {
    if (e.method === 'Runtime.exceptionThrown') return [e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text];
    if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') return [e.params.args.map((a) => a.value ?? a.description).join(' ')];
    if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') return [`${e.params.entry.text}${e.params.entry.url ? ` (${e.params.entry.url.split('/').pop()})` : ''}`];
    return [];
  });
  return { send, evaluate, navigate, errors, close: () => ws.close() };
}
