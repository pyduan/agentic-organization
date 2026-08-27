// The to-do app's Worker: identity from Access, storage in GitHub, no database.
//
// Read  GET  /api/todos/files          → the sources this app may edit
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
import { verifyAccessJwt } from '../../lib/access.mjs';
// Generated from ORGANIGRAM.md by scripts/todo-sources.mjs. The kit keeps one map
// of the workspace; this file is that map answered for this app, not a second one.
import generated from './sources.json' with { type: 'json' };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/**
 * Access sits in front; the proof is its signed token, never a plain header.
 * `Cf-Access-Authenticated-User-Email` is a string any client can send, and a
 * Worker cannot tell the copy Access set from a forged one — Cloudflare's docs
 * say in as many words that validating the header alone is not sufficient. So
 * the JWT in `Cf-Access-Jwt-Assertion` is verified against the team's keys and
 * this app's AUD (lib/access.mjs), and the email comes out of the verified
 * payload. No valid token, no app: fail closed.
 */
async function identify(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const payload = await verifyAccessJwt(token, { teamDomain: env.TEAM_DOMAIN, aud: env.POLICY_AUD });
  if (payload && payload.email) return payload.email;
  if (env.ALLOW_UNAUTHENTICATED === '1') return 'local@dev';
  return null;
}

/**
 * The projects this app may edit.
 *
 * Normally there is nothing to configure. `npm run todos:sources` walks the repos
 * on ORGANIGRAM.md, finds every projects/<slug>/next-steps.md, and writes
 * sources.json — so whatever topology the workspace has (one repo with several
 * projects, several repos with one each, an annex repo beside a common one) is
 * described once, on the map, and never here as well.
 *
 * `TODO_SOURCES` in vars overrides it, for what the map cannot express.
 */
function sources(env) {
  const raw = env.TODO_SOURCES;
  const configured = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.trim() ? JSON.parse(raw) : generated;

  return (Array.isArray(configured) ? configured : [])
    .filter((s) => s && s.repo && s.path)
    .map((s) => ({
      id: s.id || slug(`${s.repo}/${s.path}`),
      label: s.label || labelFrom(s.path, s.repo),
      repo: s.repo,
      path: s.path,
      branch: s.branch || env.TODO_BRANCH || 'main',
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
function applyBatch(markdown, intents, email) {
  let out = markdown;
  const done = { toggled: 0, edited: 0, reordered: 0, commented: 0 };
  const rejected = [];
  for (const intent of intents) {
    // The author of a comment is the authenticated identity, never what the
    // client claims. Anything else lets a browser sign someone else's name.
    const r = apply(out, intent.op === 'comment' ? { ...intent, by: email } : intent);
    if (!r.changed) {
      if (r.reason) rejected.push({ intent, reason: r.reason });
      continue;
    }
    out = r.markdown;
    if (intent.op === 'toggle') done.toggled++;
    else if (intent.op === 'reorder') done.reordered++;
    else if (intent.op === 'comment') done.commented++;
    else done.edited++;
  }
  return { markdown: out, done, rejected };
}

function summarize(done, label) {
  const bits = [];
  if (done.toggled) bits.push(`${done.toggled} ticked`);
  if (done.edited) bits.push(`${done.edited} edited`);
  if (done.commented) bits.push(`${done.commented} update${done.commented > 1 ? 's' : ''}`);
  if (done.reordered) bits.push('reordered');
  // The project, not the file: this lands in the history of a repo that may hold
  // several of them, and "todos: 2 ticked" alone says nothing a month later.
  return `todos (${label}): ${bits.join(', ') || 'no change'}`;
}

export default {
  async fetch(request, env) {
    // A missing var is a configuration mistake, not an intruder: say which one,
    // or the owner sees an eternal 403 with nothing to act on.
    if ((!env.TEAM_DOMAIN || !env.POLICY_AUD) && env.ALLOW_UNAUTHENTICATED !== '1') {
      return json({ error: 'TEAM_DOMAIN and POLICY_AUD must be set in apps/todos/wrangler.jsonc (see its comments)' }, 500);
    }

    const email = await identify(request, env);
    if (!email) return json({ error: 'not authenticated' }, 403);

    const url = new URL(request.url);
    const configured = sources(env);

    if (url.pathname === '/api/todos/files') {
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
          const { markdown, done, rejected } = applyBatch(seeded.markdown, intents, email);

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
