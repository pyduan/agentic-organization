#!/usr/bin/env node
// A local preview of a built folder, on this machine only: the intranet, a deck, a document.
//
// A page is iterated here first, as fast as the person needs, and published only when they say
// "publish" (AGENTS.md ▸ Working rules, the artefact route). The website has its own preview
// (`npm run dev` inside site/); this serves everything else the kit builds into a static folder.
//
// Usage:  node scripts/preview.mjs [folder] [--port=8789]
//         npm run preview -- decks/<slug>
//         npm run intranet:preview            (builds the intranet, then serves apps/dashboard/dist)
//
// It listens on 127.0.0.1 only, so nobody else on the network can open it, and it serves nothing
// outside the folder it was given. No reload on change: rebuild, then refresh the browser.
// Zero dependencies, Node built-ins only. Exports `createPreview` for its tests.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

/** A server for `root`. Resolves a request path to a file inside root, or answers 404. */
export function createPreview(root) {
  const base = resolve(root);
  return createServer(async (req, res) => {
    let path;
    try {
      path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    let file = resolve(join(base, path));
    if (file !== base && !file.startsWith(base + sep)) {
      res.writeHead(404).end('Not found');
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) {
        if (!path.endsWith('/')) {
          res.writeHead(301, { Location: path + '/' }).end();
          return;
        }
        file = join(file, 'index.html');
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const folder = args.find((a) => !a.startsWith('--')) || 'apps/dashboard/dist';
  const port = Number((args.find((a) => a.startsWith('--port=')) || '').slice(7) || process.env.PORT || 8789);
  try {
    if (!(await stat(folder)).isDirectory()) throw new Error();
  } catch {
    console.error(`Nothing to preview: ${folder} is not a built folder. Build it first (npm run intranet, npm run deck -- build <slug>, npm run doc -- build <slug>).`);
    process.exit(1);
  }
  const server = createPreview(folder);
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `Port ${port} is taken: a preview may already be running, or pass --port=<another>.` : e.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Preview of ${relative(process.cwd(), resolve(folder)) || '.'} at http://localhost:${port}/  (this machine only; Ctrl+C stops it)`);
  });
}
