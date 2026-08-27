// Tests for lib/access.mjs — the Access token check the todos Worker relies on.
//
// The keypair is generated here and the "team" is a stub fetcher, so the tests
// prove the verifier's behaviour (signature, audience, issuer, expiry, fail
// closed) without any network. What they cannot prove is the deployment itself:
// the check that counts there stays "request the deployed app logged out".
//
// Run: node --test scripts/test-access.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessJwt } from '../lib/access.mjs';

const TEAM = 'https://example-team.cloudflareaccess.com';
const AUD = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
const KID = 'test-key-1';

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
  true,
  ['sign', 'verify'],
);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: KID, alg: 'RS256', use: 'sig' };

async function sign(payload, { kid = KID, key = privateKey } = {}) {
  const head = `${b64url({ alg: 'RS256', kid, typ: 'JWT' })}.${b64url(payload)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head));
  return `${head}.${Buffer.from(sig).toString('base64url')}`;
}

const NOW = 1_700_000_000_000;
const nowSec = Math.floor(NOW / 1000);
const claims = (over = {}) => ({
  aud: [AUD], iss: TEAM, email: 'sam@example.com',
  iat: nowSec - 10, nbf: nowSec - 10, exp: nowSec + 600,
  ...over,
});

function stubFetcher(keys = [jwk]) {
  const fetcher = async () => ({ ok: true, json: async () => ({ keys }) });
  return fetcher;
}

const opts = (over = {}) => ({ teamDomain: TEAM, aud: AUD, fetcher: stubFetcher(), now: NOW, ...over });

test('a valid token yields its payload, and the email with it', async () => {
  const payload = await verifyAccessJwt(await sign(claims()), opts());
  assert.equal(payload?.email, 'sam@example.com');
});

test('a tampered payload is rejected even with a once-valid signature', async () => {
  const token = await sign(claims());
  const [h, , s] = token.split('.');
  const forged = `${h}.${b64url(claims({ email: 'intruder@example.com' }))}.${s}`;
  assert.equal(await verifyAccessJwt(forged, opts()), null);
});

test('a token for another application (wrong aud) is rejected', async () => {
  const token = await sign(claims({ aud: ['0000000000000000000000000000000000000000000000000000000000000000'] }));
  assert.equal(await verifyAccessJwt(token, opts()), null);
});

test('an expired token is rejected', async () => {
  const token = await sign(claims({ exp: nowSec - 3600 }));
  assert.equal(await verifyAccessJwt(token, opts()), null);
});

test('a token from another team (wrong issuer) is rejected', async () => {
  const token = await sign(claims({ iss: 'https://someone-else.cloudflareaccess.com' }));
  assert.equal(await verifyAccessJwt(token, opts()), null);
});

test('garbage, absence, and missing configuration all fail closed', async () => {
  assert.equal(await verifyAccessJwt('not-a-jwt', opts()), null);
  assert.equal(await verifyAccessJwt(null, opts()), null);
  assert.equal(await verifyAccessJwt(await sign(claims()), opts({ aud: '' })), null);
  assert.equal(await verifyAccessJwt(await sign(claims()), opts({ teamDomain: '' })), null);
});

test('an unknown kid is rejected, not guessed at', async () => {
  const token = await sign(claims(), { kid: 'rotated-away' });
  assert.equal(await verifyAccessJwt(token, opts()), null);
});

test('an alg the team never uses is rejected before any crypto runs', async () => {
  const head = `${b64url({ alg: 'none', kid: KID, typ: 'JWT' })}.${b64url(claims())}`;
  assert.equal(await verifyAccessJwt(`${head}.`, opts()), null);
});
