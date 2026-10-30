/**
 * The gate in front of one page shared with someone outside the company.
 *
 * Access sits in front with this page's own list (access.txt). This code verifies the Access token
 * against the team's keys and this application's AUD, and serves nothing without it, so a deleted or
 * detached Access application locks the page rather than publishing it. Same reasoning as the
 * intranet's worker.js; the check itself is lib/access.mjs, copied from the kit.
 *
 * Read-only by design: an outsider who must answer something writes to a store this Worker reads
 * (a KV namespace), never into git, since nothing exposed to an outsider may hold a token that commits.
 */
import { verifyAccessJwt } from "../../lib/access.mjs";

const closed = (body, status) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export default {
  async fetch(request, env) {
    if (!env.TEAM_DOMAIN || !env.POLICY_AUD) {
      return closed("This page is closed: Access is not configured for it.\n", 503);
    }
    const token = request.headers.get("Cf-Access-Jwt-Assertion");
    const payload = await verifyAccessJwt(token, { teamDomain: env.TEAM_DOMAIN, aud: env.POLICY_AUD }).catch(() => null);
    if (!payload?.email) return closed("Access denied.\n", 403);

    const response = await env.ASSETS.fetch(request);
    const out = new Response(response.body, response);
    out.headers.set("Cache-Control", "private, no-store");
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
    return out;
  },
};
