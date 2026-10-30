// worker.js, driven the way Cloudflare drives it: a signed Access assertion, a KV namespace, and
// GitHub at the other end of fetch. Nothing here talks to the network.
//
// What it holds in place: the gate refuses what it should, a write that changes nothing writes
// nothing, a tick carries the person's day rather than the server's, an id the build cannot produce
// is refused, and a note reaches the central repo's inbox as one signed file.

import test from "node:test";
import assert from "node:assert/strict";
import { company, centralPaths } from "../config.mjs";
import worker from "../worker.js";

const TEAM = "team.example.cloudflareaccess.com";
const AUD = "aud-of-this-app";
const EMAIL = "sam@example.com";

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const keys = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"]
);
const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "k1" };

async function assertion(claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", kid: "k1" }));
  const body = b64url(JSON.stringify({ iss: `https://${TEAM}`, aud: [AUD], email: EMAIL, exp: now + 600, ...claims }));
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, keys.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

/** A KV namespace that counts its writes, which is what "writes nothing" is measured by. */
function kv() {
  const store = new Map();
  const ns = {
    writes: 0,
    async get(k, type) { const v = store.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v; },
    async put(k, v) { ns.writes++; store.set(k, v); },
    async delete(k) { ns.writes++; store.delete(k); },
    async list() { return { keys: [...store.keys()].map((name) => ({ name })) }; },
  };
  return ns;
}

/** fetch as the Worker sees it: the Access key set, and GitHub's contents API. */
const github = [];
let githubAnswer = () => new Response("{}", { status: 201 });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === `https://${TEAM}/cdn-cgi/access/certs`) return Response.json({ keys: [jwk] });
  if (u.startsWith("https://api.github.com/")) { github.push({ url: u, init }); return githubAnswer(u, init); }
  throw new Error(`unexpected fetch ${u}`);
};

const env = (extra = {}) => ({
  // As protect-access.mjs --write-vars writes them: the team domain with its scheme.
  TEAM_DOMAIN: `https://${TEAM}`,
  POLICY_AUD: AUD,
  TODOS: kv(),
  ASSETS: { fetch: async () => new Response("page", { headers: { "Content-Type": "text/plain" } }) },
  ...extra,
});

async function call(e, path, { method = "GET", body, token } = {}) {
  const headers = { "Cf-Access-Jwt-Assertion": token ?? (await assertion()) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return worker.fetch(new Request(`https://intranet.example${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), e);
}

test("the gate refuses a missing configuration, a missing assertion and a forged one", async () => {
  const open = await worker.fetch(new Request("https://intranet.example/"), { ASSETS: env().ASSETS });
  assert.equal(open.status, 503);
  const none = await worker.fetch(new Request("https://intranet.example/"), env());
  assert.equal(none.status, 503);
  const other = await call(env(), "/", { token: await assertion({ aud: ["another-app"] }) });
  assert.equal(other.status, 403);
});

test("a tick and an untick leave the store as it was, and the second writes nothing", async () => {
  const e = env();
  const first = await call(e, "/api/todos/abc12", { method: "POST", body: { done: true, on: new Date().toISOString().slice(0, 10) } });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).doneBy, EMAIL);
  assert.equal(e.TODOS.writes, 1);

  const again = await call(e, "/api/todos/abc12", { method: "POST", body: { done: true } });
  assert.equal(e.TODOS.writes, 1, "ticking what is ticked writes nothing");
  assert.equal((await again.json()).done, true);

  await call(e, "/api/todos/abc12", { method: "POST", body: { done: false } });
  assert.equal(await e.TODOS.get("abc12"), null, "an empty entry is removed");
});

test("a note saved as it already was writes nothing", async () => {
  const e = env();
  await call(e, "/api/todos/abc12", { method: "POST", body: { note: "Called them" } });
  const writes = e.TODOS.writes;
  await call(e, "/api/todos/abc12", { method: "POST", body: { note: "  Called them " } });
  assert.equal(e.TODOS.writes, writes);
});

test("a tick carries the day the page sends when it is plausible, the server's otherwise", async () => {
  const e = env();
  const utc = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const near = await (await call(e, "/api/todos/aa1", { method: "POST", body: { done: true, on: yesterday } })).json();
  assert.equal(near.doneAt, yesterday, "a time zone behind UTC keeps its own day");
  const far = await (await call(e, "/api/todos/aa2", { method: "POST", body: { done: true, on: "2020-01-01" } })).json();
  assert.equal(far.doneAt, utc, "a wrong clock cannot date a tick to another year");
  const junk = await (await call(e, "/api/todos/aa3", { method: "POST", body: { done: true, on: "16/10/2026" } })).json();
  assert.equal(junk.doneAt, utc);
});

test("an id the build cannot produce is refused before it names a key", async () => {
  const e = env();
  for (const id of ["ABC", "a-b", "abcdefgh", "a%2Fb"]) {
    const res = await call(e, `/api/todos/${id}`, { method: "POST", body: { done: true } });
    assert.equal(res.status, 400, id);
  }
  assert.equal(e.TODOS.writes, 0);
});

test("a note from the bubble becomes one signed file in the central inbox", async () => {
  github.length = 0;
  const e = env({ NOTES_TOKEN: "t0ken" });
  // Yesterday, UTC: a day the worker accepts as the author's and that is not the server's.
  const theirs = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const res = await call(e, "/api/notes", { method: "POST", body: { text: "The customer signs on Thursday, to be confirmed.", on: theirs } });
  assert.equal(res.status, 200);
  assert.equal(github.length, 1);
  const { url, init } = github[0];
  assert.match(url, new RegExp(`/repos/${company.org}/${company.central}/contents/${centralPaths.inbox}/\\d{4}-\\d{2}-\\d{2}T\\d{2}h\\d{2}-sam\\.md$`));
  assert.equal(init.method, "PUT");
  assert.equal(init.headers.authorization, "Bearer t0ken");
  const sent = JSON.parse(init.body);
  const file = Buffer.from(sent.content, "base64").toString("utf8");
  assert.match(file, new RegExp(`^date: ${theirs}$`, "m"), "the author's own day");
  assert.match(file, new RegExp(`author: ${EMAIL}`));
  assert.match(file, /The customer signs on Thursday, to be confirmed\.\n$/);
  assert.equal(sent.author.email, EMAIL, "signed with the verified address, never what the page claims");
});

test("a taken name gets a suffix, and a note is never merged into another", async () => {
  github.length = 0;
  let n = 0;
  githubAnswer = () => new Response("{}", { status: n++ === 0 ? 422 : 201 });
  const res = await call(env({ NOTES_TOKEN: "t" }), "/api/notes", { method: "POST", body: { text: "x" } });
  githubAnswer = () => new Response("{}", { status: 201 });
  assert.equal(res.status, 200);
  assert.match(github[1].url, /-2-sam\.md$/);
});

test("the bubble says it is not plugged in, and refuses an empty note", async () => {
  const off = await call(env(), "/api/notes", { method: "POST", body: { text: "x" } });
  assert.equal(off.status, 501);
  assert.match(await off.text(), /NOTES_TOKEN/);
  const empty = await call(env({ NOTES_TOKEN: "t" }), "/api/notes", { method: "POST", body: { text: "   " } });
  assert.equal(empty.status, 400);
});

test("a page for someone outside serves nothing without its own Access, and its page with it", async () => {
  const { default: outside } = await import("../outside/_template/worker.js");
  const assets = { fetch: async () => new Response("<p>la page</p>", { headers: { "Content-Type": "text/html" } }) };
  const ask = async (e, token) => outside.fetch(new Request("https://page.example/", {
    headers: token ? { "Cf-Access-Jwt-Assertion": token } : {},
  }), e);
  const e = { TEAM_DOMAIN: `https://${TEAM}`, POLICY_AUD: AUD, ASSETS: assets };

  assert.equal((await ask({ ASSETS: assets }, await assertion())).status, 503, "no Access values, closed");
  assert.equal((await ask(e)).status, 403, "no token");
  assert.equal((await ask(e, await assertion({ aud: ["the-intranet"] }))).status, 403, "a token for another application");
  const ok = await ask(e, await assertion());
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "<p>la page</p>");
  assert.equal(ok.headers.get("Cache-Control"), "private, no-store");
});
