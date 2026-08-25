// The to-do app's Worker: identity from Access, storage in GitHub, no database.
//
// Read  GET  /api/files                → the files this app is allowed to edit
//       GET  /api/todos?path=…         → { path, sha, items }
// Write POST /api/todos  { path, sha, intents[] }
//
// A write applies every intent in the batch to the file, then commits once. If the
// blob moved since the client read it, GitHub refuses the write (that is the point
// of sending the sha) and we re-read, re-apply the same intents to the newer file,
// and try once more. Re-applying is safe because an intent names an item by its
// ^id, never by a line number.

import { parse, apply, ensureIds } from '../../lib/todo.mjs';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Access sits in front and sets this header. No header, no app: fail closed. */
function identify(request, env) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (email) return email;
  if (env.ALLOW_UNAUTHENTICATED === '1') return 'local@dev';
  return null;
}

function allowedFiles(env) {
  return (env.TODO_FILES || '').split(',').map((s) => s.trim()).filter(Boolean);
}

const gh = (env, path, init = {}) =>
  fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'agentic-organization-todos',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

async function readFile(env, path) {
  const res = await gh(env, `${path}?ref=${env.GITHUB_BRANCH || 'main'}`);
  if (!res.ok) throw Object.assign(new Error(`read ${path}: ${res.status}`), { status: res.status });
  const body = await res.json();
  // The Contents API returns base64 with newlines in it.
  const markdown = new TextDecoder().decode(
    Uint8Array.from(atob(body.content.replace(/\n/g, '')), (c) => c.charCodeAt(0)),
  );
  return { markdown, sha: body.sha };
}

async function writeFile(env, path, markdown, sha, message, email) {
  const res = await gh(env, path, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: btoa(String.fromCharCode(...new TextEncoder().encode(markdown))),
      sha,
      branch: env.GITHUB_BRANCH || 'main',
      author: { name: email.split('@')[0], email },
    }),
  });
  if (res.status === 409 || res.status === 422) return { conflict: true };
  if (!res.ok) throw Object.assign(new Error(`write ${path}: ${res.status}`), { status: res.status });
  const body = await res.json();
  return { sha: body.content.sha };
}

/** Apply a batch, and say what it did so the commit message is worth reading. */
function applyBatch(markdown, intents) {
  let out = markdown;
  const done = { toggled: 0, edited: 0, reordered: 0 };
  const rejected = [];
  for (const intent of intents) {
    const r = apply(out, intent);
    if (!r.changed) {
      if (r.reason) rejected.push({ intent, reason: r.reason });
      continue;
    }
    out = r.markdown;
    if (intent.op === 'toggle') done.toggled++;
    else if (intent.op === 'reorder') done.reordered++;
    else done.edited++;
  }
  return { markdown: out, done, rejected };
}

function summarize(done) {
  const bits = [];
  if (done.toggled) bits.push(`${done.toggled} ticked`);
  if (done.edited) bits.push(`${done.edited} edited`);
  if (done.reordered) bits.push('reordered');
  return `todos: ${bits.join(', ') || 'no change'}`;
}

export default {
  async fetch(request, env) {
    const email = identify(request, env);
    if (!email) return json({ error: 'not authenticated' }, 403);

    const url = new URL(request.url);
    const files = allowedFiles(env);

    if (url.pathname === '/api/files') return json({ files, email });

    if (url.pathname !== '/api/todos') return env.ASSETS.fetch(request);

    const path = url.searchParams.get('path') || (await request.clone().json().catch(() => ({}))).path;
    // The allow-list is the security boundary: without it this endpoint edits any
    // file in the repo, which is a very different app from the one we shipped.
    if (!files.includes(path)) return json({ error: 'file not allowed' }, 400);

    try {
      if (request.method === 'GET') {
        const { markdown, sha } = await readFile(env, path);
        return json({ path, sha, items: parse(markdown) });
      }

      if (request.method === 'POST') {
        const { intents } = await request.json();
        if (!Array.isArray(intents) || !intents.length) return json({ error: 'no intents' }, 400);

        // The client's sha is deliberately not used as a precondition. Intents are
        // semantic ("tick ^k3f9"), so they apply correctly to whatever the file says
        // now, including a version someone else just wrote. The only race left is
        // between our own read and our own write, and that is what the retry covers.
        for (let attempt = 0; attempt < 3; attempt++) {
          const base = await readFile(env, path);
          const seeded = ensureIds(base.markdown);
          const { markdown, done, rejected } = applyBatch(seeded.markdown, intents);

          if (markdown === base.markdown) {
            return json({ sha: base.sha, items: parse(base.markdown), rejected });
          }

          const res = await writeFile(env, path, markdown, base.sha, summarize(done), email);
          if (res.conflict) continue; // someone wrote between our read and our write
          return json({ sha: res.sha, items: parse(markdown), rejected });
        }
        return json({ error: 'the file kept changing under us; try again' }, 409);
      }

      return json({ error: 'method not allowed' }, 405);
    } catch (err) {
      return json({ error: String(err.message || err) }, err.status || 500);
    }
  },
};
