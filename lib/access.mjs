// Verify a Cloudflare Access application token (the `Cf-Access-Jwt-Assertion`
// request header) inside a Worker.
//
// Why this exists: the friendlier `Cf-Access-Authenticated-User-Email` header is
// a plain string, and nothing in a Worker distinguishes the copy Access set from
// one a client typed. Cloudflare's documentation is explicit that validating a
// header alone is not sufficient — the JWT and its signature must be confirmed
// (developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).
// `ctx.access` would verify itself, but a Worker with Static Assets never
// receives it, so an app that serves assets and checks identity in code checks
// this token or checks nothing.
//
// The check is the one Cloudflare publishes: signature against the team's
// public keys (RS256), issuer, audience, and validity window. Web Crypto only —
// no dependency, same as everything else in lib/.

const JWKS_TTL_MS = 60 * 60 * 1000;
let cache = { url: null, keys: null, fetched: 0 };

const b64urlToBytes = (s) => {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
  return Uint8Array.from(atob(norm + pad), (c) => c.charCodeAt(0));
};

const decodeSegment = (seg) => JSON.parse(new TextDecoder().decode(b64urlToBytes(seg)));

// The team's signing keys, cached for an hour. An unknown `kid` refetches once,
// because a key rotation must not lock everyone out until the cache expires.
async function keysFor(teamDomain, kid, fetcher, now) {
  const url = `${teamDomain}/cdn-cgi/access/certs`;
  const fresh = cache.url === url && now - cache.fetched < JWKS_TTL_MS;
  let keys = fresh ? cache.keys : null;
  if (!keys || !keys.some((k) => k.kid === kid)) {
    const res = await fetcher(url);
    if (!res.ok) throw new Error(`certs: ${res.status}`);
    keys = (await res.json()).keys || [];
    cache = { url, keys, fetched: now };
  }
  return keys;
}

/**
 * Returns the verified payload (its `email` is the identity), or null.
 * Null on anything short of a fully valid token: fail closed, no reasons given
 * to the caller of the app.
 *
 * @param token       the raw `Cf-Access-Jwt-Assertion` header value
 * @param teamDomain  https://<team>.cloudflareaccess.com  (also the issuer)
 * @param aud         the Access application's AUD tag
 * @param fetcher/now injectable for tests only
 */
export async function verifyAccessJwt(token, { teamDomain, aud, fetcher = fetch, now = Date.now() } = {}) {
  try {
    if (!token || !teamDomain || !aud) return null;
    const [h, p, sig] = token.split('.');
    if (!h || !p || !sig) return null;

    const header = decodeSegment(h);
    if (header.alg !== 'RS256') return null;

    const payload = decodeSegment(p);
    const nowSec = Math.floor(now / 1000);
    const skew = 60;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec - skew) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > nowSec + skew) return null;
    if (payload.iss !== teamDomain) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;

    const jwk = (await keysFor(teamDomain, header.kid, fetcher, now)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`),
    );
    return ok ? payload : null;
  } catch {
    return null;
  }
}
