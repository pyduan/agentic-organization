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
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, apply, ensureIds } from '../lib/todo.mjs';

// Resolved from this file, not from the cwd, so it can be started from anywhere.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8788);
const FILES = (process.env.TODO_FILES || 'apps/todos/example/next-steps.md')
  .split(',').map((s) => s.trim()).filter(Boolean);

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/files') return send(res, 200, { files: FILES, email: 'local@dev' });
  if (url.pathname !== '/api/todos') return send(res, 404, { error: 'not found' });

  const body = req.method === 'POST'
    ? await new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(JSON.parse(b || '{}'))); })
    : {};
  const path = url.searchParams.get('path') || body.path;
  if (!FILES.includes(path)) return send(res, 400, { error: 'file not allowed' });

  const full = join(ROOT, path);
  try {
    const markdown = await readFile(full, 'utf8');

    if (req.method === 'GET') return send(res, 200, { path, sha: 'local', items: parse(markdown) });

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
      return send(res, 200, { sha: 'local', items: parse(out), rejected });
    }

    return send(res, 405, { error: 'method not allowed' });
  } catch (err) {
    return send(res, err.code === 'ENOENT' ? 404 : 500, { error: String(err.message) });
  }
});

server.listen(PORT, () => console.log(`todos dev API on http://127.0.0.1:${PORT} → ${FILES.join(', ')}`));
