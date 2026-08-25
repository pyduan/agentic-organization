// The to-do app's Worker: identity from Access, storage in GitHub, no database.
//
// Read  GET  /api/files                → the sources this app may edit
//       GET  /api/todos?source=…       → { source, sha, items }
// Write POST /api/todos  { source, intents[] }
//
// **The client names a source, never a path.** One app usually spans several
// projects, often in several repositories, and letting the browser send a repo
// and a path would put the allow-list at the mercy of string comparison. A
// source id resolves server-side against the configured list, so a path the
// owner did not configure cannot be expressed at all.
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

/**
 * The configured sources, normalised.
 *
 * Preferred form, one entry per project (TODO_SOURCES, a JSON array in vars):
 *   [{ "id": "brochure", "label": "Brochure", "repo": "acme/site",
 *      "path": "projects/brochure/next-steps.md" }]
 *
 * Short form for a single repo, kept because most projects start there:
 *   TODO_REPO = "acme/site", TODO_FILES = "next-steps.md,projects/x/next-steps.md"
 */
function sources(env) {
  const raw = env.TODO_SOURCES;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' && raw.trim() ? JSON.parse(raw) : null;

  if (list) {
    return list
      .filter((s) => s && s.repo && s.path)
      .map((s) => ({
        id: s.id || slug(`${s.repo}/${s.path}`),
        label: s.label || labelFrom(s.path, s.repo),
        repo: s.repo,
        path: s.path,
        branch: s.branch || env.TODO_BRANCH || 'main',
      }));
  }

  return (env.TODO_FILES || '')
    .split(',').map((x) => x.trim()).filter(Boolean)
    .map((path) => ({
      id: slug(`${env.GITHUB_REPO}/${path}`),
      label: labelFrom(path, env.GITHUB_REPO),
      repo: env.GITHUB_REPO,
      path,
      branch: env.TODO_BRANCH || 'main',
    }));
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Name a source after the *project*, not the plumbing.
 * `projects/brochure/next-steps.md` is "Brochure", not "acme/site ▸ projects/…".
 * Which repository a project lives in is an implementation detail the owner
 * should not have to hold in their head — the same rule the dashboard follows.
 */
function labelFrom(path, repo) {
  const m = path.match(/(?:^|\/)projects\/([^/]+)\//);
  if (m) return titleCase(m[1]);
  if (path === 'next-steps.md') return titleCase((repo || '').split('/').pop() || 'Next steps');
  return titleCase(path.replace(/\.md$/, '').split('/').pop());
}

const titleCase = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const gh = (env, repo, path, init = {}) =>
  fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'agentic-organization-todos',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

async function readFile(env, src) {
  const res = await gh(env, src.repo, `${src.path}?ref=${src.branch}`);
  if (!res.ok) throw Object.assign(new Error(`read ${src.repo}/${src.path}: ${res.status}`), { status: res.status });
  const body = await res.json();
  // The Contents API returns base64 with newlines in it.
  const markdown = new TextDecoder().decode(
    Uint8Array.from(atob(body.content.replace(/\n/g, '')), (c) => c.charCodeAt(0)),
  );
  return { markdown, sha: body.sha };
}

async function writeFile(env, src, markdown, sha, message, email) {
  const res = await gh(env, src.repo, src.path, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: btoa(String.fromCharCode(...new TextEncoder().encode(markdown))),
      sha,
      branch: src.branch,
      author: { name: email.split('@')[0], email },
    }),
  });
  if (res.status === 409 || res.status === 422) return { conflict: true };
  if (!res.ok) throw Object.assign(new Error(`write ${src.repo}/${src.path}: ${res.status}`), { status: res.status });
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

function summarize(done, label) {
  const bits = [];
  if (done.toggled) bits.push(`${done.toggled} ticked`);
  if (done.edited) bits.push(`${done.edited} edited`);
  if (done.reordered) bits.push('reordered');
  // The project, not the file: this lands in the history of a repo that may hold
  // several of them, and "todos: 2 ticked" alone says nothing a month later.
  return `todos (${label}): ${bits.join(', ') || 'no change'}`;
}

export default {
  async fetch(request, env) {
    const email = identify(request, env);
    if (!email) return json({ error: 'not authenticated' }, 403);

    const url = new URL(request.url);
    const configured = sources(env);

    if (url.pathname === '/api/files') {
      // Only what the client needs to render a picker. The repo travels for the
      // rare case where two projects share a name; it is never accepted back.
      return json({
        email,
        sources: configured.map(({ id, label, repo }) => ({ id, label, repo })),
      });
    }

    if (url.pathname !== '/api/todos') return env.ASSETS.fetch(request);

    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const wanted = url.searchParams.get('source') || body.source;

    // The allow-list is the security boundary, and it works by resolution rather
    // than comparison: an id that is not configured resolves to nothing, so a
    // path the owner never listed cannot be named at all.
    const src = configured.find((s) => s.id === wanted);
    if (!src) return json({ error: 'unknown source' }, 400);

    try {
      if (request.method === 'GET') {
        const { markdown, sha } = await readFile(env, src);
        // repo and path travel outward only, so the hand-off prompt can name a
        // real file. They are never read back off a request.
        return json({ source: src.id, label: src.label, repo: src.repo, path: src.path, sha, items: parse(markdown) });
      }

      if (request.method === 'POST') {
        const { intents } = body;
        if (!Array.isArray(intents) || !intents.length) return json({ error: 'no intents' }, 400);

        // The client's sha is deliberately not used as a precondition. Intents are
        // semantic ("tick ^k3f9"), so they apply correctly to whatever the file says
        // now, including a version someone else just wrote. The only race left is
        // between our own read and our own write, and that is what the retry covers.
        for (let attempt = 0; attempt < 3; attempt++) {
          const base = await readFile(env, src);
          const seeded = ensureIds(base.markdown);
          const { markdown, done, rejected } = applyBatch(seeded.markdown, intents);

          if (markdown === base.markdown) {
            return json({ source: src.id, sha: base.sha, items: parse(base.markdown), rejected });
          }

          const res = await writeFile(env, src, markdown, base.sha, summarize(done, src.label), email);
          if (res.conflict) continue; // someone wrote between our read and our write
          return json({ source: src.id, sha: res.sha, items: parse(markdown), rejected });
        }
        return json({ error: 'the file kept changing under us; try again' }, 409);
      }

      return json({ error: 'method not allowed' }, 405);
    } catch (err) {
      return json({ error: String(err.message || err) }, err.status || 500);
    }
  },
};
