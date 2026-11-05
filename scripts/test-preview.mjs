// The local preview: serves the folder it was given, index.html for a directory, and nothing
// outside the folder, whatever the request path says.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createPreview } from './preview.mjs';

const dir = mkdtempSync(join(tmpdir(), 'preview-'));
const site = join(dir, 'site');
mkdirSync(join(site, 'notes'), { recursive: true });
writeFileSync(join(site, 'index.html'), '<h1>Home</h1>');
writeFileSync(join(site, 'notes', 'index.html'), '<h1>Notes</h1>');
writeFileSync(join(site, 'data.json'), '{"ok":true}');
writeFileSync(join(dir, 'secret.txt'), 'outside');

// Raw request path, so a `..` reaches the server as sent instead of being normalised by a client.
function get(port, path) {
  return new Promise((ok, ko) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d)).on('end', () => ok({ status: res.statusCode, type: res.headers['content-type'], location: res.headers.location, body }));
    });
    req.on('error', ko);
    req.end();
  });
}

test('serves the folder, and only the folder', async () => {
  const server = createPreview(site);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const home = await get(port, '/');
    assert.equal(home.status, 200);
    assert.match(home.body, /Home/);
    assert.match(home.type, /text\/html/);

    assert.equal((await get(port, '/notes')).location, '/notes/');
    assert.match((await get(port, '/notes/')).body, /Notes/);
    assert.match((await get(port, '/data.json')).type, /application\/json/);
    assert.equal((await get(port, '/missing.html')).status, 404);

    for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/notes/../../secret.txt', '/..%2fsecret.txt', '/notes/..%2f..%2fsecret.txt']) {
      const r = await get(port, p);
      assert.notEqual(r.body, 'outside', `${p} escaped the folder`);
    }
  } finally {
    server.close();
  }
});
