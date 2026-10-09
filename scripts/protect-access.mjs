#!/usr/bin/env node
// Put a Worker behind Cloudflare Access: a list of email addresses, each signing in
// with a one-time code sent to that address. No screen to click through.
//
// This is the kit's default for anything private, and above all for giving someone
// outside the organization a page they can read or answer: a relative co-deciding a
// file, a partner, an accountant. On a live project a third party was given
// hand-built secret links instead, because the owner had ruled out provider screens
// and the tooling of the day could not set Access without them. A secret link can
// be forwarded, copied and kept; an address on a list is revoked by deleting a line.
// When the API right arrived, nothing said the choice made under constraint should
// be replayed, and later work was built on it. This script is that API right, used.
//
// Access is attached to the Worker, not to a hostname, so it covers the workers.dev
// URL, preview URLs and any domain added later.
//
// ## The token
//
// wrangler's own login can read Access but not write it. Create an API token once at
// https://dash.cloudflare.com/profile/api-tokens ("Create Custom Token"), on the
// account that runs the Worker:
//
//   Account · Access: Apps and Policies                             · Edit
//   Account · Access: Organizations, Identity Providers, and Groups · Edit
//   Account · Workers Scripts                                       · Read
//
// Export it for the command and never write it to a file in a repo.
//
// ## Usage
//
//   export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…
//   node scripts/protect-access.mjs --worker=<name> --emails=<file> [options]
//
//   --emails=<file>       one address per line, `#` starts a comment. The list lives in
//                         the owner's repo, beside the app, so it is reread before a
//                         link is shared and changed in one place.
//   --app-name=<name>     the Access application's name (default: the Worker's name)
//   --session=24h         how long a sign-in lasts
//   --no-auto-redirect    show a one-button chooser instead of sending straight to the
//                         code form; see "This code has already been used" below
//   --write-vars=<file>   fill TEAM_DOMAIN and POLICY_AUD in that wrangler.jsonc, for a
//                         Worker that verifies identity in code (lib/access.mjs)
//   --dry-run             read everything, change nothing, say what would change
//
//   TEAM_DOMAIN=<team>.cloudflareaccess.com   when it cannot be read back from the API
//   WORKER_ID=<id>                            for a token without Workers Scripts · Read
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   sign in with Google instead of a code
//
// Idempotent: rerun it and it updates what exists. Remove an address, rerun, and that
// person's access is gone.
//
// ## "This code has already been used"
//
// A code is single use, and requesting a newer one for the same address invalidates
// the one in the inbox. With auto-redirect on, every arrival requests one unasked: a
// second tab, a refresh, a chat client generating a link preview. Each burns the code
// the person is about to type. --no-auto-redirect makes every request deliberate at
// the cost of one click; signing in with Google removes the code altogether.
//
// Zero dependencies, Node built-ins only. Exports `protect` for its tests.

import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.cloudflare.com/client/v4';

/** Read an address list: one per line, `#` comments, blank lines ignored. */
export function readEmails(text) {
  const out = [];
  const bad = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line) ? out : bad).push(line);
  }
  return { emails: [...new Set(out.map((e) => e.toLowerCase()))], bad };
}

/**
 * A token pasted with quotes, a trailing newline or "Bearer " in front reaches the API
 * malformed, and Cloudflare answers 6111, which reads like a revoked token. Fixed here
 * rather than explained.
 */
export function normaliseToken(t) {
  return String(t || '').trim().replace(/^["']|["']$/g, '').trim().replace(/^Bearer\s+/i, '').trim();
}

/** Why a write failed, or that it is a conflict, which means the write was allowed. */
export function classify(body) {
  if (body?.success) return { kind: 'ok', id: body.result?.id || null };
  const errs = body?.errors || [];
  const codes = new Set(errs.map((e) => e.code));
  const chain = new Set(errs.flatMap((e) => (e.error_chain || []).map((c) => c.code)));
  const blob = JSON.stringify(errs).toLowerCase();
  if (codes.has(12132) || blob.includes('already exists') || blob.includes('duplicate')) return { kind: 'exists' };
  if ([1010, 9106, 10000].some((c) => codes.has(c) || chain.has(c)) || blob.includes('forbidden') || blob.includes('authentication error')) return { kind: 'forbidden', errs };
  if (blob.includes('organization') && blob.includes('not found')) return { kind: 'noorg', errs };
  if (blob.includes('invalid_request') || codes.has(12130)) return { kind: 'invalid', errs };
  return { kind: 'error', errs };
}

const TOKEN_HELP = [
  'The token needs, on this account:',
  '  Account · Access: Apps and Policies                             · Edit',
  '  Account · Access: Organizations, Identity Providers, and Groups · Edit',
  '  Account · Workers Scripts                                       · Read',
  'https://dash.cloudflare.com/profile/api-tokens',
].join('\n');

class Stop extends Error {}

/**
 * Do it. Every network call goes through `fetchImpl`, so the tests drive it against a
 * fake API. Returns { teamDomain, aud, appId, changes } and logs each step.
 */
export async function protect({
  token, accountId, workerName, emails, appName = workerName, session = '24h', autoRedirect = true,
  teamDomain = '', workerId = '', google = null, dryRun = false, fetchImpl = fetch, log = console.log,
}) {
  const changes = [];
  const cf = async (method, path, body) => {
    const res = await fetchImpl(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };
  const read = async (path) => {
    const d = await cf('GET', path);
    if (!d.success) throw new Stop(`Could not read ${path}: ${JSON.stringify(d.errors)}\n${TOKEN_HELP}`);
    return d.result;
  };
  const write = async (what, method, path, body) => {
    if (dryRun) { changes.push(`${what} (dry run, not sent)`); return { kind: 'ok', id: null }; }
    const r = classify(await cf(method, path, body));
    if (r.kind === 'forbidden') throw new Stop(`Cloudflare refused ${what}: ${JSON.stringify(r.errs)}\n${TOKEN_HELP}`);
    if (r.kind === 'noorg') throw new Stop('This account has no Zero Trust organization yet. Creating one is a first-run step in the dashboard: open https://one.dash.cloudflare.com once, choose a team name, then rerun.');
    if (r.kind === 'invalid' || r.kind === 'error') throw new Stop(`Cloudflare rejected ${what}: ${JSON.stringify(r.errs)}. The token got this far, so this is the request, not the token.`);
    if (r.kind === 'ok') changes.push(what);
    return r;
  };
  const acct = `/accounts/${accountId}/access`;

  log('→ Token');
  // A token created under the user's profile verifies at /user/tokens/verify; an
  // account-owned token (dashboard ▸ Manage account ▸ API tokens, or minted from a CLI
  // session) is unknown there and verifies only under its account. Both are fine here.
  let v = await cf('GET', '/user/tokens/verify');
  if (!v.success) v = await cf('GET', `/accounts/${accountId}/tokens/verify`);
  if (!v.success) throw new Stop(`The token was refused: ${JSON.stringify(v.errors)}\nThis must be an API token, not the Global API Key.\n${TOKEN_HELP}`);

  log('→ Zero Trust organization');
  if (!teamDomain) {
    const org = await cf('GET', `${acct}/organizations`);
    teamDomain = org.success ? org.result?.auth_domain || '' : '';
  }
  if (!teamDomain) throw new Stop('No Zero Trust organization could be read. Open https://one.dash.cloudflare.com once to choose a team name, or pass TEAM_DOMAIN=<team>.cloudflareaccess.com.');
  log(`  ${teamDomain}`);

  log('→ Identity provider');
  const idps = (await read(`${acct}/identity_providers`)) || [];
  let idp = (idps.find((x) => x.type === 'onetimepin') || {}).id;
  if (!idp) {
    const r = await write('one-time-code provider', 'POST', `${acct}/identity_providers`, { name: 'Email code', type: 'onetimepin', config: {} });
    idp = r.id || ((await read(`${acct}/identity_providers`)) || []).find((x) => x.type === 'onetimepin')?.id;
  }
  let useIdp = idp;
  if (google) {
    const g = idps.find((x) => x.type === 'google');
    const body = { name: 'Google', type: 'google', config: { client_id: google.id, client_secret: google.secret } };
    const r = g ? await write('Google provider', 'PUT', `${acct}/identity_providers/${g.id}`, body)
      : await write('Google provider', 'POST', `${acct}/identity_providers`, body);
    useIdp = g?.id || r.id;
  }
  // An empty id would post allowed_idps: [""], which Cloudflare accepts and nobody can sign in through.
  if (!useIdp && !dryRun) throw new Stop('The identity provider exists but its id could not be read back. Stopping rather than posting an application nobody could sign in to.');
  log(`  ${google ? 'Google' : 'one-time code by email'}`);

  log(`→ Worker ${workerName}`);
  if (!workerId) {
    const scripts = await cf('GET', `/accounts/${accountId}/workers/scripts`);
    if (!scripts.success) throw new Stop(`Could not list the Workers on this account: ${JSON.stringify(scripts.errors)}\nAdd Workers Scripts · Read to the token, or pass WORKER_ID=<id>.`);
    const w = (scripts.result || []).find((x) => x.id === workerName);
    if (!w) throw new Stop(`No Worker called ${workerName} on this account. Deploy it first. Workers here: ${(scripts.result || []).map((x) => x.id).join(', ') || 'none'}`);
    workerId = w.tag || w.etag;
  }
  if (!workerId) throw new Stop(`${workerName} came back without an id to attach Access to.`);

  log('→ Access application');
  const apps = (await read(`${acct}/apps`)) || [];
  let app = apps.find((x) => x.name === appName);
  const appBody = {
    name: appName,
    type: 'self_hosted',
    session_duration: session,
    destinations: [{ type: 'worker', worker_id: workerId }],
    allowed_idps: useIdp ? [useIdp] : [],
    // Cloudflare allows auto-redirect only when allowed_idps names exactly one provider.
    auto_redirect_to_identity: Boolean(autoRedirect && useIdp),
    app_launcher_visible: false,
  };
  if (app) await write('application update', 'PUT', `${acct}/apps/${app.id}`, appBody);
  else app = { id: (await write('application', 'POST', `${acct}/apps`, appBody)).id };
  let aud = '';
  if (app.id) aud = (await read(`${acct}/apps/${app.id}`))?.aud || '';

  log(`→ Policy, ${emails.length} address(es)`);
  for (const e of emails) log(`     ${e}`);
  const policy = { name: 'Allowed people', decision: 'allow', include: emails.map((email) => ({ email: { email } })) };
  if (app.id) {
    const pols = (await read(`${acct}/apps/${app.id}/policies`)) || [];
    const pol = pols.find((x) => x.name === policy.name);
    if (pol) await write('policy update', 'PUT', `${acct}/apps/${app.id}/policies/${pol.id}`, policy);
    else await write('policy', 'POST', `${acct}/apps/${app.id}/policies`, policy);
  } else changes.push('policy (dry run, not sent)');

  return { teamDomain, aud, appId: app.id || null, changes };
}

/** Fill TEAM_DOMAIN and POLICY_AUD in a wrangler.jsonc, keeping its comments. */
export function writeVars(text, { teamDomain, aud }) {
  let missing = [];
  const set = (s, key, value) => {
    const re = new RegExp(`("${key}"\\s*:\\s*)"[^"]*"`);
    if (!re.test(s)) { missing.push(key); return s; }
    return s.replace(re, `$1"${value}"`);
  };
  let out = set(text, 'TEAM_DOMAIN', `https://${teamDomain.replace(/^https?:\/\//, '')}`);
  out = set(out, 'POLICY_AUD', aud);
  return { text: out, missing };
}

const isMain = (() => {
  try { return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
  try {
    const token = normaliseToken(process.env.CLOUDFLARE_API_TOKEN);
    if (!/^[A-Za-z0-9_-]{30,}$/.test(token)) throw new Stop(`CLOUDFLARE_API_TOKEN is ${token ? `not shaped like an API token (${token.length} characters after trimming, expected about 40)` : 'not set'}. See the header of this script.`);
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!accountId) throw new Stop('Set CLOUDFLARE_ACCOUNT_ID.');
    const workerName = opt('worker');
    if (!workerName) throw new Stop('Name the Worker: --worker=<name>.');
    if (!opt('emails')) throw new Stop('Give the address list: --emails=<file>, one address per line.');
    const { emails, bad } = readEmails(readFileSync(opt('emails'), 'utf8'));
    if (bad.length) throw new Stop(`Not addresses, in ${opt('emails')}: ${bad.join(', ')}`);
    if (!emails.length) throw new Stop(`${opt('emails')} lists nobody. An empty list would lock everyone out; nothing was changed.`);
    const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET } : null;
    const r = await protect({
      token, accountId, workerName, emails, google,
      appName: opt('app-name') || workerName, session: opt('session') || '24h',
      autoRedirect: !args.includes('--no-auto-redirect'), dryRun: args.includes('--dry-run'),
      teamDomain: process.env.TEAM_DOMAIN || '', workerId: process.env.WORKER_ID || '',
    });
    if (opt('write-vars') && !args.includes('--dry-run')) {
      const path = opt('write-vars');
      const { text, missing } = writeVars(readFileSync(path, 'utf8'), r);
      writeFileSync(path, text);
      if (missing.length) console.log(`⚠ ${path} has no ${missing.join(' or ')} under vars; add them by hand: TEAM_DOMAIN=https://${r.teamDomain}, POLICY_AUD=${r.aud}`);
      else console.log(`→ ${path}: TEAM_DOMAIN and POLICY_AUD written. Deploy for them to take effect.`);
    }
    console.log(`\n${args.includes('--dry-run') ? 'Dry run. Would change' : 'Changed'}: ${r.changes.join('; ') || 'nothing, it was already in place'}.`);
    console.log('Now check from a browser that is not signed in: a login page or a 403 is right, a 200 is an incident.');
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    console.error(e.message);
    process.exit(1);
  }
}
