// protect-access against a fake Cloudflare API: it must create what is missing,
// update what exists instead of duplicating it, stop on a refused write with the
// token help, and change nothing on a dry run.

import test from 'node:test';
import assert from 'node:assert/strict';
import { protect, readEmails, writeVars, normaliseToken, classify } from './protect-access.mjs';

/** A minimal Access API: organizations, identity providers, workers, apps, policies. */
function fakeApi({ org = 'acme.cloudflareaccess.com', idps = [], apps = [], workers = [{ id: 'acme-dash', tag: 'w-1' }], refuse = null } = {}) {
  const state = { idps: [...idps], apps: [...apps], policies: {}, calls: [] };
  let n = 0;
  const ok = (result) => ({ json: async () => ({ success: true, result }) });
  const fetchImpl = async (url, { method, body }) => {
    const path = url.replace('https://api.cloudflare.com/client/v4', '');
    state.calls.push(`${method} ${path}`);
    const data = body ? JSON.parse(body) : null;
    if (refuse && method !== 'GET' && path.includes(refuse)) {
      return { json: async () => ({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }) };
    }
    if (path === '/user/tokens/verify') return ok({ status: 'active' });
    if (path.endsWith('/access/organizations')) return ok(org ? { auth_domain: org } : null);
    if (path.endsWith('/access/identity_providers')) {
      if (method === 'GET') return ok(state.idps);
      const x = { id: `idp-${++n}`, ...data }; state.idps.push(x); return ok(x);
    }
    if (path.endsWith('/workers/scripts')) return ok(workers);
    if (/\/access\/apps$/.test(path)) {
      if (method === 'GET') return ok(state.apps);
      const x = { id: `app-${++n}`, aud: `aud-${n}`, ...data }; state.apps.push(x); return ok(x);
    }
    const appM = path.match(/\/access\/apps\/([^/]+)$/);
    if (appM) {
      const a = state.apps.find((x) => x.id === appM[1]);
      if (method === 'PUT') Object.assign(a, data);
      return ok(a);
    }
    const polM = path.match(/\/access\/apps\/([^/]+)\/policies(?:\/([^/]+))?$/);
    if (polM) {
      const list = (state.policies[polM[1]] ||= []);
      if (method === 'GET') return ok(list);
      if (method === 'POST') { const x = { id: `pol-${++n}`, ...data }; list.push(x); return ok(x); }
      Object.assign(list.find((x) => x.id === polM[2]), data); return ok({ id: polM[2] });
    }
    throw new Error(`fake API: unhandled ${method} ${path}`);
  };
  return { state, fetchImpl };
}

const base = { token: 't', accountId: 'a1', workerName: 'acme-dash', emails: ['sam@example.com', 'alex@example.org'], log: () => {} };

test('a fresh account gets a code provider, an application on the Worker, and the list as policy', async () => {
  const api = fakeApi();
  const r = await protect({ ...base, fetchImpl: api.fetchImpl });
  assert.equal(r.teamDomain, 'acme.cloudflareaccess.com');
  assert.ok(r.aud);
  const app = api.state.apps[0];
  assert.deepEqual(app.destinations, [{ type: 'worker', worker_id: 'w-1' }]);
  assert.deepEqual(app.allowed_idps, [api.state.idps[0].id]);
  assert.equal(api.state.idps[0].type, 'onetimepin');
  const pol = api.state.policies[app.id][0];
  assert.deepEqual(pol.include.map((x) => x.email.email), base.emails);
});

test('a second run updates in place and never duplicates', async () => {
  const api = fakeApi();
  await protect({ ...base, fetchImpl: api.fetchImpl });
  await protect({ ...base, emails: ['sam@example.com'], fetchImpl: api.fetchImpl });
  assert.equal(api.state.apps.length, 1);
  assert.equal(api.state.idps.length, 1);
  const pols = api.state.policies[api.state.apps[0].id];
  assert.equal(pols.length, 1);
  assert.deepEqual(pols[0].include.map((x) => x.email.email), ['sam@example.com'], 'removing an address revokes it');
});

test('a refused write stops with what the token needs', async () => {
  const api = fakeApi({ refuse: '/access/apps' });
  await assert.rejects(protect({ ...base, fetchImpl: api.fetchImpl }), /Access: Apps and Policies/);
});

test('a dry run reads and changes nothing', async () => {
  const api = fakeApi();
  const r = await protect({ ...base, dryRun: true, fetchImpl: api.fetchImpl });
  assert.ok(api.state.calls.every((c) => c.startsWith('GET')), api.state.calls.join(', '));
  assert.ok(r.changes.length > 0);
});

test('no organization, or no Worker of that name, stops before any write', async () => {
  await assert.rejects(protect({ ...base, fetchImpl: fakeApi({ org: null }).fetchImpl }), /Zero Trust organization/);
  await assert.rejects(protect({ ...base, workerName: 'nope', fetchImpl: fakeApi().fetchImpl }), /No Worker called nope/);
});

test('the address list, the token and the vars are read defensively', () => {
  assert.deepEqual(readEmails('sam@example.com  # owner\n\nSAM@example.com\nnot-an-address\n'),
    { emails: ['sam@example.com'], bad: ['not-an-address'] });
  assert.equal(normaliseToken(' "Bearer abc" \n'), 'abc');
  const jsonc = '{\n  // keep me\n  "vars": {\n    "TEAM_DOMAIN": "",\n    "POLICY_AUD": ""\n  }\n}\n';
  const { text, missing } = writeVars(jsonc, { teamDomain: 'acme.cloudflareaccess.com', aud: 'xyz' });
  assert.match(text, /\/\/ keep me/);
  assert.match(text, /"TEAM_DOMAIN": "https:\/\/acme\.cloudflareaccess\.com"/);
  assert.match(text, /"POLICY_AUD": "xyz"/);
  assert.deepEqual(missing, []);
  assert.equal(classify({ success: false, errors: [{ code: 12132 }] }).kind, 'exists', 'a conflict means the write was allowed');
});
