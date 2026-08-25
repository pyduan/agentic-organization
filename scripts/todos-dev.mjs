#!/usr/bin/env node
// The to-do app's API, served from the local filesystem instead of GitHub.
//
// Same contract as apps/todos/worker.js, so the UI cannot tell the difference.
// It exists so the app is developable and testable without a GitHub token and
// without committing on every click:  node scripts/todos-dev.mjs
//
// The write path here is the same one the Worker uses — lib/todo.mjs — so a bug
// in patching shows up locally rather than in a commit.

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, apply, ensureIds } from '../lib/todo.mjs';

// Resolved from this file, not from the cwd, so it can be started from anywhere.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8788);
// Same source list as production, read from the generated sources.json, so local
// development spans the same repos instead of being a special case. Each entry
// carries the local checkout in `dir`; only this file uses it.
//
// Falls back to an explicit TODO_FILES for a quick one-off against a single file.
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleCase = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const labelFrom = (p) => {
  const m = p.match(/(?:^|\/)projects\/([^/]+)\//);
  return titleCase(m ? m[1] : p.replace(/\.md$/, '').split('/').pop());
};

function loadSources() {
  if (process.env.TODO_FILES) {
    return process.env.TODO_FILES.split(',').map((s) => s.trim()).filter(Boolean)
      .map((path) => ({ id: slug(path), label: labelFrom(path), repo: 'local', path, dir: ROOT }));
  }
  try {
    const list = JSON.parse(readFileSync(join(ROOT, 'apps/todos/sources.json'), 'utf8'));
    return list.map((s) => ({ ...s, dir: s.dir || ROOT }));
  } catch {
    return [];
  }
}

const SOURCES = loadSources();

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/files') {
    return send(res, 200, { email: 'local@dev', sources: SOURCES.map(({ id, label, repo }) => ({ id, label, repo })) });
  }
  if (url.pathname !== '/api/todos') return send(res, 404, { error: 'not found' });

  const body = req.method === 'POST'
    ? await new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(JSON.parse(b || '{}'))); })
    : {};
  const src = SOURCES.find((s) => s.id === (url.searchParams.get('source') || body.source));
  if (!src) return send(res, 400, { error: 'unknown source' });

  const full = join(src.dir || ROOT, src.path);
  try {
    const markdown = await readFile(full, 'utf8');

    if (req.method === 'GET') return send(res, 200, { source: src.id, label: src.label, repo: src.repo, path: src.path, sha: 'local', items: parse(markdown) });

    if (req.method === 'POST') {
      const seeded = ensureIds(markdown);
      let out = seeded.markdown;
      const rejected = [];
      for (const intent of body.intents || []) {
        const r = apply(out, intent);
        if (r.changed) out = r.markdown;
        else if (r.reason) rejected.push({ intent, reason: r.reason });
      }
      if (out !== markdown) await writeFile(full, out, 'utf8');
      return send(res, 200, { source: src.id, sha: 'local', items: parse(out), rejected });
    }

    return send(res, 405, { error: 'method not allowed' });
  } catch (err) {
    return send(res, err.code === 'ENOENT' ? 404 : 500, { error: String(err.message) });
  }
});

server.listen(PORT, () => {
  if (!SOURCES.length) {
    console.log(`todos dev API on http://127.0.0.1:${PORT} — no sources.`);
    console.log('Run `npm run todos:sources` to derive them from ORGANIGRAM.md,');
    console.log('or set TODO_FILES=path/to/next-steps.md for a one-off.');
    return;
  }
  console.log(`todos dev API on http://127.0.0.1:${PORT} → ${SOURCES.map((s) => s.label).join(', ')}`);
});
