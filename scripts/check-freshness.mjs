#!/usr/bin/env node
// Reconciliation sweep: does the world still match what this repo says about it?
//
// Every other check in a repo asks "is the code right". This one asks "is what we
// published still there, and is what we wrote about it still true". Those rot silently:
// no file is wrong, no build fails, and nobody notices for weeks.
//
// Four passes, each independently skippable:
//   links   every URL in the repo's markdown and in the built site still resolves
//   hosts   every hostname the docs claim is live actually serves
//   mail    MX / SPF / DMARC match what freshness.json says they should be
//   stale   unresolved placeholders, and dated notes that have aged past their promise
//
// Zero dependencies, Node built-ins only, so it runs on any machine with no install.
// Config is optional: without freshness.json it still does links and stale.
//
// Usage:  node scripts/check-freshness.mjs [--only=links,hosts,mail,stale] [--offline] [--json]

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, extname, relative } from 'node:path';
import { resolveMx, resolveTxt } from 'node:dns/promises';

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const OFFLINE = args.includes('--offline');
const AS_JSON = args.includes('--json');
const wants = (pass) => (only.length === 0 || only.includes(pass)) && !(OFFLINE && pass !== 'stale');

const findings = [];      // { severity: 'fail'|'warn'|'info', pass, what, detail }
const add = (severity, pass, what, detail) => findings.push({ severity, pass, what, detail });

// ---------------------------------------------------------------- config

const CONFIG_PATH = join(ROOT, 'freshness.json');
let config = { hosts: [], mail: [], ignoreUrls: [], staleAfterDays: 365, skipDirs: [] };
if (existsSync(CONFIG_PATH)) {
  try {
    config = { ...config, ...JSON.parse(await readFile(CONFIG_PATH, 'utf8')) };
  } catch (e) {
    add('fail', 'config', 'freshness.json', `not valid JSON: ${e.message}`);
  }
}

const SKIP = new Set([
  'node_modules', '.git', 'dist', '.astro', '.wrangler', 'build', 'coverage',
  ...(config.skipDirs || []),
]);

async function walk(dir, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.claude') continue;
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = await walk(ROOT);
const mdFiles = files.filter((f) => ['.md', '.mdx'].includes(extname(f)));

// ---------------------------------------------------------------- pass: links

// One fetch per unique URL, HEAD first then GET, because plenty of hosts 405 a HEAD.
const urlCache = new Map();
// follow=false matters for anything behind an access proxy: the gate answers 302 to a
// login page, and following that redirect turns the answer into 200, which reads as
// "wide open" when it is in fact "correctly locked". Found by this check reporting a
// false failure against a host that was working perfectly.
async function probe(url, { follow = true } = {}) {
  const key = `${follow ? 'F' : 'N'} ${url}`;
  if (urlCache.has(key)) return urlCache.get(key);
  const attempt = async (method) => {
    const ctl = AbortSignal.timeout(15000);
    const r = await fetch(url, { method, redirect: follow ? 'follow' : 'manual', signal: ctl, headers: { 'user-agent': 'freshness-check' } });
    return r.status;
  };
  let result;
  try {
    let status = await attempt('HEAD');
    // Retry with GET on ANY 4xx, not just the method-related ones. Plenty of real sites
    // answer a HEAD with 404 while serving the same URL perfectly on GET — kaggle.com
    // does exactly that, and it made this check report two live links in a bio as dead.
    // A HEAD is an optimisation, so never let it be the last word on a failure.
    if (status >= 400 && status < 500) status = await attempt('GET');
    // 401/403/429 mean the server knows the path and is refusing *us*, a bot. A login
    // page or a rate limiter is not a dead link, and reporting it as one is how a check
    // earns a reputation for crying wolf and stops being read. Only a genuine
    // not-found, a server error, or no answer at all counts as broken.
    const gated = status === 401 || status === 403 || status === 429;
    result = { ok: status < 400 || gated, status, gated };
  } catch (e) {
    result = { ok: false, status: 0, error: e.name === 'TimeoutError' ? 'timeout' : String(e.message || e) };
  }
  urlCache.set(key, result);
  return result;
}

const IGNORE = (config.ignoreUrls || []).map((s) => new RegExp(s));
const shouldIgnore = (u) => IGNORE.some((re) => re.test(u));

if (wants('links')) {
  // Collect http(s) URLs from markdown, skipping fenced code blocks so examples
  // and placeholder URLs are not reported as dead.
  const found = new Map(); // url -> Set(file)
  for (const f of mdFiles) {
    const raw = await readFile(f, 'utf8');
    const text = raw.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const m of text.matchAll(/https?:\/\/[^\s<>)\]"'`]+/g)) {
      const url = m[0].replace(/[.,;:]+$/, '');
      if (shouldIgnore(url)) continue;
      if (/\{\{|\}\}|example\.(com|org)|localhost|127\.0\.0\.1|yourdomain/.test(url)) continue;
      if (!found.has(url)) found.set(url, new Set());
      found.get(url).add(relative(ROOT, f));
    }
  }

  const urls = [...found.keys()];
  // Bounded concurrency: be a polite crawler, not a load test.
  const POOL = 8;
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(POOL, urls.length) }, async () => {
    while (i < urls.length) {
      const url = urls[i++];
      const r = await probe(url);
      const where = [...found.get(url)].slice(0, 3).join(', ');
      if (!r.ok) add('fail', 'links', url, `${r.error || 'HTTP ' + r.status} — referenced in ${where}`);
      else if (r.gated) add('info', 'links', url, `HTTP ${r.status} to a bot (login or rate limit); fine for a human — in ${where}`);
    }
  }));
  add('info', 'links', `${urls.length} unique external URL(s) checked`, `${mdFiles.length} markdown file(s) scanned`);
}

// ---------------------------------------------------------------- pass: hosts

if (wants('hosts') && (config.hosts || []).length) {
  for (const h of config.hosts) {
    const url = h.url || `https://${h.hostname}/`;
    const expect = h.expectStatus ?? 200;
    // Only follow redirects when a 2xx is what we expect; a 3xx expectation is
    // precisely a statement about the redirect itself.
    const r = await probe(url, { follow: expect < 300 });
    if (r.status !== expect) {
      add('fail', 'hosts', url, `expected ${expect}, got ${r.error || r.status}${h.note ? ` (${h.note})` : ''}`);
      continue;
    }
    // A hostname documented as private must not serve its content to an anonymous request.
    //
    // This DOES follow redirects, deliberately. The question is "what can a stranger
    // actually end up looking at", and the answer requires walking the gate's redirect to
    // wherever it lands. A 302's own body is empty, so checking it unfollowed silently
    // matches nothing and the guard passes for the wrong reason — which is exactly what
    // happened the first time this was written.
    //
    // So `mustNotContain` needles must be strings from INSIDE the app (a heading, a
    // control label), never the application's name: an access gate legitimately prints
    // the app name on its own login page.
    if (h.mustNotContain) {
      try {
        const body = await (await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) })).text();
        for (const needle of [].concat(h.mustNotContain)) {
          if (body.includes(needle)) add('fail', 'hosts', url, `anonymous request saw "${needle}" — the access gate is not covering this host`);
        }
      } catch { /* the status check above already passed; a body read failure is not a finding */ }
    }
    // What the live page MUST carry. The mirror of mustNotContain, and it catches a drift
    // nothing else sees: a fact corrected in the repo but never deployed. That happened on a
    // real project — six days of a stale figure served while every summary said it was live,
    // because pushing does not publish unless the repo is connected to Workers Builds.
    if (h.mustContain) {
      try {
        const body = await (await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) })).text();
        for (const needle of [].concat(h.mustContain)) {
          if (!body.includes(needle)) {
            add('fail', 'hosts', url, `"${needle}" is missing from the live page — has the repo been deployed? (npm run deploy)`);
          }
        }
      } catch (e) {
        add('warn', 'hosts', url, `body unreadable, mustContain not checked (${e.message})`);
      }
    }
    // Paths that must be served. A page announced in a letter, a deck, or an application
    // has to answer: on a real project an app linked from a members' mailing 404'd for six
    // days and nobody knew, because nothing here asserted that it existed.
    for (const p of h.mustServe || []) {
      const r2 = await probe(new URL(p, url).toString() + `?fresh=${Date.now()}`, { follow: true });
      if (r2.status !== 200) add('fail', 'hosts', url.replace(/\/$/, '') + p, `expected 200, got ${r2.error || r2.status} — a page we announce is not answering`);
    }
    // Paths that must be absent (a private file the host should never serve).
    for (const p of h.mustNotServe || []) {
      const r2 = await probe(new URL(p, url).toString() + `?fresh=${Date.now()}`);
      // Here a 401/403 is the *desired* outcome, so only a real 2xx/3xx is a finding.
      if (r2.ok && !r2.gated) add('fail', 'hosts', url + p, `served with HTTP ${r2.status} but is documented as private`);
    }
  }
  add('info', 'hosts', `${config.hosts.length} host claim(s) checked`, '');
}

// ---------------------------------------------------------------- pass: mail

if (wants('mail') && (config.mail || []).length) {
  for (const m of config.mail) {
    const d = m.domain;
    try {
      const mx = (await resolveMx(d)).map((r) => r.exchange.toLowerCase()).sort();
      for (const want of m.mxContains || []) {
        if (!mx.some((x) => x.includes(want))) add('fail', 'mail', `MX ${d}`, `expected an MX containing "${want}", got: ${mx.join(', ') || '(none)'}`);
      }
      if (m.mxMustNotContain) {
        for (const bad of [].concat(m.mxMustNotContain)) {
          if (mx.some((x) => x.includes(bad))) add('fail', 'mail', `MX ${d}`, `still points at "${bad}" — a previous provider was not removed: ${mx.join(', ')}`);
        }
      }
    } catch (e) {
      add('fail', 'mail', `MX ${d}`, `lookup failed: ${e.code || e.message}`);
    }

    try {
      const txt = (await resolveTxt(d)).map((c) => c.join(''));
      const spf = txt.filter((t) => t.startsWith('v=spf1'));
      // Two SPF records break SPF entirely, which is worse than none.
      if (spf.length > 1) add('fail', 'mail', `SPF ${d}`, `${spf.length} v=spf1 records — SPF is broken; there must be exactly one`);
      if (spf.length === 0 && (m.spfContains || []).length) add('fail', 'mail', `SPF ${d}`, 'no SPF record at all');
      for (const want of m.spfContains || []) {
        if (!spf.some((t) => t.includes(want))) add('fail', 'mail', `SPF ${d}`, `missing "${want}" — got: ${spf.join(' | ') || '(none)'}`);
      }
    } catch (e) {
      add('fail', 'mail', `SPF ${d}`, `lookup failed: ${e.code || e.message}`);
    }

    if (m.requireDmarc) {
      try {
        const dm = (await resolveTxt(`_dmarc.${d}`)).map((c) => c.join('')).filter((t) => t.startsWith('v=DMARC1'));
        if (!dm.length) add('fail', 'mail', `DMARC ${d}`, 'no DMARC record; the domain is spoofable');
      } catch {
        add('fail', 'mail', `DMARC ${d}`, 'no DMARC record; the domain is spoofable');
      }
    }
  }
  add('info', 'mail', `${config.mail.length} domain(s) checked`, '');
}

// ---------------------------------------------------------------- pass: stale

if (wants('stale')) {
  // Unresolved placeholders that escaped a template, and promises that have aged.
  const PLACEHOLDER = /\{\{[A-Z_0-9]+\}\}/g;
  const TOFILL = /(à confirmer|à remplir|to be confirmed|TKTK|FIXME)/gi;
  const DATED = /\(([A-Z][a-zé]+), (\d{4})-(\d{2})-(\d{2})\)/g; // "(Paul, 2026-07-29)"
  const today = new Date();
  const maxAge = config.staleAfterDays ?? 365;

  let placeholders = 0, tofill = 0;
  for (const f of mdFiles) {
    const rel = relative(ROOT, f);
    // Templates are *supposed* to be full of placeholders.
    const isTemplate = /(modeles?|templates?|_template)\//i.test(rel) || /template/i.test(rel);
    // Strip fenced blocks and code spans: a `{{PLACEHOLDER}}` being *explained* is not
    // a field someone forgot to fill in, and flagging it trains people to ignore this pass.
    const text = (await readFile(f, 'utf8'))
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]*`/g, '');

    if (!isTemplate) {
      const ph = [...text.matchAll(PLACEHOLDER)];
      if (ph.length) { placeholders += ph.length; add('warn', 'stale', rel, `${ph.length} unresolved placeholder(s): ${[...new Set(ph.map((m) => m[0]))].slice(0, 4).join(' ')}`); }
    }
    const tf = [...text.matchAll(TOFILL)];
    if (tf.length) { tofill += tf.length; add('info', 'stale', rel, `${tf.length} "to fill in" marker(s)`); }

    for (const m of [...text.matchAll(DATED)]) {
      const when = new Date(`${m[2]}-${m[3]}-${m[4]}T00:00:00Z`);
      const days = Math.floor((today - when) / 864e5);
      if (days > maxAge) add('info', 'stale', rel, `dated rule "${m[0]}" is ${days} days old — still true?`);
    }
  }
  add('info', 'stale', `${placeholders} placeholder(s), ${tofill} to-fill marker(s)`, `across ${mdFiles.length} markdown file(s)`);
}

// ---------------------------------------------------------------- report

const fails = findings.filter((f) => f.severity === 'fail');
const warns = findings.filter((f) => f.severity === 'warn');

if (AS_JSON) {
  console.log(JSON.stringify({ ok: fails.length === 0, fails: fails.length, warns: warns.length, findings }, null, 2));
} else {
  const icon = { fail: '✘', warn: '▲', info: '·' };
  for (const pass of ['config', 'links', 'hosts', 'mail', 'stale']) {
    const rows = findings.filter((f) => f.pass === pass);
    if (!rows.length) continue;
    console.log(`\n${pass}`);
    for (const r of rows) console.log(`  ${icon[r.severity]} ${r.what}${r.detail ? `\n      ${r.detail}` : ''}`);
  }
  console.log(
    `\n${fails.length === 0 ? '✓' : '✘'} ${fails.length} failure(s), ${warns.length} warning(s)` +
    (existsSync(CONFIG_PATH) ? '' : '\n  (no freshness.json, so the hosts and mail passes were skipped — see docs)')
  );
}

process.exit(fails.length ? 1 : 0);
