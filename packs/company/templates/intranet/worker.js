/**
 * The gate in front of the intranet.
 *
 * Cloudflare Access, with a one-time code sent by email to a named address. Access is attached to
 * this Worker itself, so it covers every route the Worker answers on, including the workers.dev URL,
 * without depending on a domain the company does not have yet.
 *
 * The allowlist is the Access policy, and it has one home: `access.txt`, which
 * `scripts/protect-access.mjs` applies, mirrored from `administrative/people/emails.md`. It is deliberately not repeated here. A list in two places
 * is a list that disagrees with itself, which is the failure this whole repo exists to avoid.
 *
 * ## Why this file verifies anything at all
 *
 * With Access attached to the Worker, an unauthenticated request never reaches this code. So the
 * verification below is not what keeps strangers out on a normal day.
 *
 * It is what makes "fails closed" true rather than assumed. If the Access application is deleted,
 * detached, or rebuilt pointing somewhere else, this Worker would otherwise start serving the
 * pipeline, the equity intent and everyone's addresses to anyone who guessed the hostname, silently
 * and with no error anywhere. Checking the assertion means that mistake produces a locked site
 * instead of a public one.
 *
 * Both variables, TEAM_DOMAIN and POLICY_AUD, are written into wrangler.jsonc by
 * `scripts/protect-access.mjs --write-vars=wrangler.jsonc` after it creates the application. Without them this Worker serves nothing.
 */

import { company, centralPaths } from "./config.mjs";

const JSON_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
};

function closed(body, status = 503) {
  return new Response(body, { status, headers: JSON_HEADERS });
}

/** base64url, which is not what atob expects. */
function decodeSegment(segment) {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function decodeJson(segment) {
  return JSON.parse(new TextDecoder().decode(decodeSegment(segment)));
}

/**
 * Access rotates its signing keys, so the key set is fetched rather than pinned, and cached for an
 * hour against the Worker's own cache. An unknown `kid` bypasses the cache once, so a rotation
 * costs one slow request rather than an hour of refusals.
 */
const jwksCache = new Map();

async function signingKey(teamDomain, kid) {
  const cached = jwksCache.get(kid);
  if (cached && cached.expires > Date.now()) return cached.key;

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!response.ok) throw new Error(`key set unavailable (${response.status})`);
  const { keys } = await response.json();

  let found = null;
  for (const jwk of keys ?? []) {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    jwksCache.set(jwk.kid, { key, expires: Date.now() + 3600_000 });
    if (jwk.kid === kid) found = key;
  }
  return found;
}

/** Returns the verified email, or throws with the reason. */
async function verifiedEmail(token, teamDomain, aud) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed assertion");

  const header = decodeJson(parts[0]);
  if (header.alg !== "RS256") throw new Error(`unexpected algorithm ${header.alg}`);

  const key = await signingKey(teamDomain, header.kid);
  if (!key) throw new Error("assertion signed by an unknown key");

  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    decodeSegment(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error("bad signature");

  const claims = decodeJson(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) throw new Error("assertion expired");
  if (claims.nbf && claims.nbf > now + 60) throw new Error("assertion not yet valid");
  if (claims.iss !== `https://${teamDomain}`) throw new Error("wrong issuer");

  // aud is the application, and this is the check that matters: an assertion minted for a different
  // Access application on the same account is a valid signature and the wrong door.
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(aud)) throw new Error("assertion is for another application");

  return claims.email ?? claims.common_name ?? "unknown";
}


/** The shape todoId() in src/lib/content.mjs produces: an unsigned 32-bit hash in base 36. */
const TODO_ID = /^[0-9a-z]{1,7}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The day a person ticked or wrote something, as their own calendar says it.
 *
 * The server's clock is UTC, so `toISOString()` dated an evening tick in Paris to the next day, or a
 * tick at half past midnight to the day before. The page sends its local day; it is kept when it is
 * a real date within a day of the server's, which is every time zone, and replaced by the server's
 * day otherwise, so a wrong clock cannot date a tick to last year.
 */
function dayOf(claimed) {
  const utc = new Date().toISOString().slice(0, 10);
  if (typeof claimed !== "string" || !DAY.test(claimed) || Number.isNaN(Date.parse(claimed))) return utc;
  return Math.abs(Date.parse(claimed) - Date.parse(utc)) <= 864e5 ? claimed : utc;
}

const plain = (body, status) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * Todo state: what someone ticked, and what they wrote on it.
 *
 * The questions live in each repo's INDEX.md and are read at build time. Only the tick and the note
 * live here, keyed by a hash of the repo and the question text. Losing this store loses ticks and
 * notes; it cannot lose a question.
 *
 * Every write is attributed to the verified Access identity, which is the point of having one. A
 * write that changes nothing writes nothing: ticking what is ticked keeps who ticked it and when.
 */
async function todoApi(request, env, email) {
  const url = new URL(request.url);
  const id = url.pathname.slice("/api/todos/".length);
  // An id the build cannot produce is not the page. Refused before it can name a KV key.
  if (id && !TODO_ID.test(id)) return plain("Unknown identifier.\n", 400);

  if (request.method === "GET" && url.pathname === "/api/todos") {
    const list = await env.TODOS.list({ limit: 1000 });
    const entries = await Promise.all(
      list.keys.map(async (k) => [k.name, await env.TODOS.get(k.name, "json")])
    );
    return Response.json(Object.fromEntries(entries.filter(([, v]) => v)));
  }

  if (request.method === "POST" && id && !id.includes("/")) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return plain("Unreadable request: a JSON object is expected.\n", 400);
    }
    const previous = (await env.TODOS.get(id, "json")) ?? {};
    const next = { ...previous };
    let changed = false;

    if ("done" in body && Boolean(body.done) !== Boolean(previous.done)) {
      next.done = Boolean(body.done);
      next.doneBy = next.done ? email : undefined;
      next.doneAt = next.done ? dayOf(body.on) : undefined;
      changed = true;
    }
    if ("note" in body) {
      // A note is a sentence, not a document. The cap stops one paste filling the namespace.
      const note = String(body.note ?? "").slice(0, 2000).trim();
      if (note !== (previous.note ?? "")) {
        next.note = note || undefined;
        next.noteBy = note ? email : undefined;
        next.noteAt = note ? dayOf(body.on) : undefined;
        changed = true;
      }
    }
    if (!changed) return Response.json(previous);

    const empty = !next.done && !next.note;
    if (empty) await env.TODOS.delete(id);
    else await env.TODOS.put(id, JSON.stringify(next));
    return Response.json(empty ? {} : next);
  }

  return new Response("Not found.\n", { status: 404 });
}

/** UTF-8 to base64, in chunks: a spread of a long note's bytes overflows the call stack. */
function base64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * The note bubble: what a cofounder wants to say from wherever they are, a figure heard on a call,
 * a piece of news, an idea, before it waits for a keyboard and does not survive the wait.
 *
 * A note is input, never a record. Each one becomes its own file in the central repo's
 * `source/inbox/notes/`, dated, signed with the verified address, and the next agent session files
 * what it says into the markdown it belongs to and deletes it (`source/inbox/README.md` there). Nothing on the site
 * reads a note back, so the site stays a view of the files.
 *
 * It writes with `NOTES_TOKEN`, a GitHub token limited to that one repo's contents. Without it the
 * bubble answers that it is not plugged in, in words a person can act on.
 */
async function notesApi(request, env, email) {
  if (request.method !== "POST") return plain("Method not allowed.\n", 405);
  if (!company.central) {
    return plain("Notes are not plugged in: config.mjs does not name the central repo (company.central).\n", 501);
  }
  if (!env.NOTES_TOKEN) {
    return plain("Notes are not plugged in: the NOTES_TOKEN secret is missing (intranet/README.md, \"The note bubble\").\n", 501);
  }
  const body = await request.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  if (!text) return plain("The note is empty.\n", 400);
  if (text.length > 20000) return plain("Note too long: 20,000 characters at most.\n", 400);

  const stamp = new Date().toISOString();
  // The author is the verified identity, never what the page claims.
  const author = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "anonymous";
  const content = `---\ndate: ${dayOf(body?.on)}\nreceived: ${stamp}\nauthor: ${email}\nvia: intranet\n---\n\n${text}\n`;

  // One file per note, never rewritten: a name already taken (two notes in the same minute) gets a
  // suffix rather than a merge. GitHub refuses a create over an existing path with 422.
  for (let n = 0; n < 3; n++) {
    const name = `${stamp.slice(0, 16).replace(/:/g, "h")}${n ? `-${n + 1}` : ""}-${author}.md`;
    const response = await fetch(
      `https://api.github.com/repos/${company.org}/${company.central}/contents/${centralPaths.inbox}/${name}`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${env.NOTES_TOKEN}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "user-agent": `${company.worker}-intranet`,
        },
        body: JSON.stringify({
          message: `inbox: note from ${author}, via the intranet`,
          content: base64(content),
          author: { name: author, email },
        }),
      }
    );
    if (response.status === 422 || response.status === 409) continue;
    if (!response.ok) return plain(`GitHub refused the note (${response.status}). It is not saved.\n`, 502);
    return Response.json({ ok: true, file: name });
  }
  return plain("The note found no free name; try again in a moment.\n", 409);
}

/** Shows the note bubble, which the page renders hidden: its endpoint exists only behind this Worker. */
class Reveal {
  element(element) {
    element.removeAttribute("hidden");
  }
}

/** Puts the signed-in address into the footer, so it is obvious who the page is showing. */
class Identity {
  constructor(email) {
    this.email = email;
  }
  element(element) {
    element.setInnerContent(this.email);
    element.removeAttribute("hidden");
  }
}

export default {
  async fetch(request, env) {
    // protect-access.mjs writes it as https://<team>.cloudflareaccess.com; the checks below want the host.
    const teamDomain = String(env.TEAM_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    const aud = env.POLICY_AUD;

    if (!teamDomain || !aud) {
      return closed(
        "This intranet is closed.\n\n" +
          "Cloudflare Access is not configured for it, so there is nothing verifying who you are,\n" +
          "and it will not serve the pipeline to an unauthenticated request.\n\n" +
          "Run scripts/protect-access.mjs with --write-vars=wrangler.jsonc, then deploy again.\n"
      );
    }

    const token =
      request.headers.get("Cf-Access-Jwt-Assertion") ||
      (request.headers.get("Cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];

    if (!token) {
      return closed(
        "This intranet is closed.\n\n" +
          "The request carried no Cloudflare Access assertion, which means Access is not in front of\n" +
          "this Worker. Until it is, the Worker serves nothing.\n\n" +
          "Check the Access application still targets this Worker, then deploy again.\n"
      );
    }

    let email;
    try {
      email = await verifiedEmail(token, teamDomain, aud);
    } catch (error) {
      return closed(`Access assertion rejected: ${error.message}\n`, 403);
    }

    const url = new URL(request.url);
    if (url.pathname === "/api/notes") {
      const result = await notesApi(request, env, email);
      result.headers.set("Cache-Control", "no-store");
      return result;
    }
    if (url.pathname.startsWith("/api/todos")) {
      const result = await todoApi(request, env, email);
      result.headers.set("Cache-Control", "no-store");
      return result;
    }

    const response = await env.ASSETS.fetch(request);

    const out = new Response(response.body, response);
    // Behind a login, so never in a shared cache and never in an index.
    out.headers.set("Cache-Control", "private, no-store");
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
    out.headers.set("X-Access-Identity", email);

    const type = out.headers.get("Content-Type") || "";
    if (!type.includes("text/html")) return out;
    return new HTMLRewriter()
      .on("[data-identity]", new Identity(email))
      .on("[data-note-bubble]", new Reveal())
      .transform(out);
  },
};
