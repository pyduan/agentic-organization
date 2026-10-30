#!/usr/bin/env node
// Set a company up across five repos: this one as the central repo, and four beside it.
//
//   node packs/company/scripts/bootstrap-company.mjs --org <github-org> --name "<Company>" \
//     [--profile b2b-services|b2b-product|b2c-product] [--dest <folder>] [--local-only]
//
// It creates customers, strategy, administrative and intranet as private repos in the organization,
// fills them from packs/company/templates/, copies the kit's deck and document engine and its checks
// into the intranet (with a vendor manifest, so `npm run vendor:pull` there refreshes them after a
// kit update), and adds ONBOARDING.md and GLOSSARY.md to this repo when they are absent.
//
// --dest is the folder the four repos go in, by default the one holding this repo: they sit side by
// side, because the intranet reads `..` at build time. --local-only writes the four folders and
// touches nothing on GitHub, to look first.
//
// What it does not do, on purpose (packs/company/DECISIONS.md ▸ The kit stops before deploying):
// deploy, configure Access, or invite anyone. Each is irreversible in its own way and is a decision.
//
// The placeholders are plain strings (__COMPANY__), never a template engine, so every file in
// templates/ stays a real file that opens, reads and runs as it is. A forgotten one ships as the
// literal __COMPANY__, which is loud, and that is the right side of the trade.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = resolve(PACK, '..', '..');
const TEMPLATES = join(PACK, 'templates');
export const REPOS = ['customers', 'strategy', 'administrative', 'intranet'];
export const PROFILES = ['b2b-services', 'b2b-product', 'b2c-product'];

const B2B_STATUSES = `{ key: "active", label: "Active", note: "Signed and under way." },
    { key: "scoping", label: "Scoping", note: "In conversation, scope to define." },
    { key: "prospect", label: "Prospect", note: "Conversation open, nothing signed." },
    { key: "lead", label: "Lead", note: "Identified, not contacted yet." },
    { key: "past", label: "Past", note: "Finished or dormant." },`;

/**
 * What the profile decides. A B2B pipeline is named accounts moving through stages, each bar as tall
 * as the company's headcount; a B2C pipeline is segments of a population, each bar as tall as how
 * many people are in it. Same chart, different entity, so the profile sets the entity, the size
 * field, the colour families and the stage words, and every one stays editable in config.mjs.
 */
export function profileValues(profile) {
  if (!PROFILES.includes(profile)) throw new Error(`unknown profile "${profile}" (${PROFILES.join(', ')})`);
  const b2c = profile === 'b2c-product';
  const common = b2c ? {
    ENTITY: 'segment', ENTITY_PLURAL: 'segments', ACCOUNTS: 'partners',
    SIZE_FIELD: 'population', SIZE_LABEL: 'Population', SIZE_UNIT: 'people',
    FAMILY_FIELD: 'family', FAMILY_LABEL: 'Family', VALUE_LABEL: 'Value/year',
    TAB_ACCOUNTS: 'Partners', TAB_PIPELINE: 'Market',
    CHART_FOOT: "Height: the segment's population. Colour: family of use. Yearly value and source in the tooltip. Unverified figures are marked as such on the file.",
    PIPELINE_LEAD: 'The segments we keep a file on. Each carries its population estimate, what we learned, and where to find them.',
    ACCOUNTS_LEAD: 'The organizations we are in a real conversation with, and the work under way.',
    FAMILIES: `{ key: "core", label: "Core target" },
    { key: "adjacent", label: "Adjacent" },
    { key: "pro", label: "Professional use" },
    { key: "institutional", label: "Institutional" },
    { key: "watch", label: "To watch" },`,
    STATUSES: `{ key: "served", label: "Served", note: "The product is in their hands." },
    { key: "beachhead", label: "Beachhead", note: "The segment we enter through." },
    { key: "next", label: "Next", note: "Reachable without changing the product." },
    { key: "later", label: "Later", note: "Needs a product we do not have yet." },
    { key: "out", label: "Out of scope", note: "Set aside, and the file says why." },`,
    ACCOUNT_STATUSES: B2B_STATUSES,
  } : {
    ENTITY: 'company', ENTITY_PLURAL: 'companies', ACCOUNTS: 'companies',
    SIZE_FIELD: 'employees', SIZE_LABEL: 'Headcount', SIZE_UNIT: 'people',
    FAMILY_FIELD: 'sector', FAMILY_LABEL: 'Sector', VALUE_LABEL: 'Revenue',
    TAB_ACCOUNTS: 'Customers', TAB_PIPELINE: 'Prospects',
    CHART_FOOT: 'Height: headcount. Colour: sector. Revenue and group in the tooltip. Some figures are not verified, and the file says so.',
    PIPELINE_LEAD: 'Every company we keep a file on. Lead, prospect and customer are the same file with a different status.',
    ACCOUNTS_LEAD: 'The customers signed or being signed, and the work that comes with them.',
    FAMILIES: `{ key: "industry", label: "Industry" },
    { key: "services", label: "Services" },
    { key: "distribution", label: "Distribution" },
    { key: "public", label: "Public sector" },
    { key: "software", label: "Software" },`,
    STATUSES: B2B_STATUSES,
    ACCOUNT_STATUSES: B2B_STATUSES,
  };
  const STAGES = profile === 'b2b-services'
    ? `{ key: "discovery", label: "Discovery" },
    { key: "scoping", label: "Scoping" },
    { key: "pilot", label: "Pilot" },
    { key: "delivery", label: "Delivery" },
    { key: "run", label: "Production" },
    { key: "closed", label: "Closed" },`
    : `{ key: "discovery", label: "Discovery" },
    { key: "prototype", label: "Prototype" },
    { key: "pilot", label: "Pilot" },
    { key: "launch", label: "Launch" },
    { key: "run", label: "Production" },
    { key: "closed", label: "Closed" },`;
  // Nobody yet. The first person added takes palette slot 1, and the order colours the owner tags,
  // so people are added in the order they joined rather than alphabetically.
  const OWNERS = '// { key: "firstname", label: "Firstname" },';
  return { ...common, STAGES, OWNERS };
}

/** Lowercase and hyphenated: safe for a folder, a Worker name and a Cloudflare team name. */
export const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function substitutions({ org, name, profile, central }) {
  const slug = slugify(name);
  const v = profileValues(profile);
  return {
    __COMPANY__: name, __ORG__: org, __SLUG__: slug, __CENTRAL__: central, __WORKER__: `${slug}-intranet`,
    __TEAMNAME__: slug, __PROFILE__: profile, __KV_ID__: 'create-it-see-company-setup',
    ...Object.fromEntries(Object.entries(v).map(([k, x]) => [`__${k}__`, x])),
  };
}

const TEXT = new Set(['.md', '.mjs', '.js', '.json', '.jsonc', '.astro', '.sh', '.css', '.ts', '.yml', '.yaml', '.html', '.txt', '']);

export function fill(text, subs) {
  let out = text;
  for (const [k, v] of Object.entries(subs)) out = out.split(k).join(v);
  return out;
}

function copyTree(from, to, subs, { skip = () => false } = {}) {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, e.name);
    const dst = join(to, e.name);
    if (skip(e.name)) continue;
    if (e.isDirectory()) { copyTree(src, dst, subs, { skip }); continue; }
    if (TEXT.has(extname(e.name))) writeFileSync(dst, fill(readFileSync(src, 'utf8'), subs));
    else copyFileSync(src, dst);
  }
}

/**
 * The kit's files the intranet embeds, as [path in the kit, path in the intranet]. Everything of the
 * deck and document engine except the three files that know where a company keeps its decks
 * (scripts/deck/paths.mjs, scripts/deck/intranet.mjs, scripts/doc/build.mjs), which are the pack's.
 */
export function sharedFiles(kit = KIT) {
  const list = [];
  const deck = join(kit, 'scripts', 'deck');
  for (const n of readdirSync(deck).sort()) {
    if (!statSync(join(deck, n)).isFile() || n.startsWith('.') || ['paths.mjs', 'intranet.mjs'].includes(n)) continue;
    list.push([`scripts/deck/${n}`, `scripts/deck/${n}`]);
  }
  list.push(['scripts/deck/examples/deck.mdx', 'scripts/deck/examples/deck.mdx']);
  list.push(['scripts/deck/examples/agentic-organization/deck.mdx', 'scripts/deck/examples/agentic-organization/deck.mdx']);
  list.push(['scripts/deck/examples/assets/', 'scripts/deck/examples/assets/']);
  for (const n of ['doc.css', 'markdown.mjs', 'paged.js', 'test.mjs']) list.push([`scripts/doc/${n}`, `scripts/doc/${n}`]);
  for (const n of ['check-ai-tics.mjs', 'check-contrast.mjs', 'protect-access.mjs', 'vendor-sync.mjs', 'test-vendor-sync.mjs']) list.push([`scripts/${n}`, `scripts/${n}`]);
  list.push(['lib/access.mjs', 'lib/access.mjs']);
  return list;
}

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (dir, ...a) => { try { return git(dir, ...a); } catch { return ''; } };

/** Copy the kit's shared files into the intranet and write the manifest vendor-sync reads. */
export function embedKit(intranet, { kit = KIT, central, org }) {
  const mappings = sharedFiles(kit);
  const files = {};
  for (const [k, h] of mappings) {
    const pairs = k.endsWith('/')
      ? readdirSync(join(kit, k)).filter((n) => !n.startsWith('.') && statSync(join(kit, k, n)).isFile()).sort().map((n) => [k + n, h + n])
      : [[k, h]];
    for (const [src, here] of pairs) {
      mkdirSync(dirname(join(intranet, here)), { recursive: true });
      copyFileSync(join(kit, src), join(intranet, here));
      files[src] = { here, sha256: sha(join(kit, src)) };
    }
  }
  // Not tracked: a dotfile vendor-sync skips, and the Node version the build and the CI read.
  if (existsSync(join(kit, 'scripts/deck/examples/.gitignore'))) copyFileSync(join(kit, 'scripts/deck/examples/.gitignore'), join(intranet, 'scripts/deck/examples/.gitignore'));
  if (existsSync(join(kit, '.node-version'))) copyFileSync(join(kit, '.node-version'), join(intranet, '.node-version'));
  const manifest = { repo: `${org}/${central}`, commit: tryGit(kit, 'rev-parse', 'HEAD'), date: tryGit(kit, 'log', '-1', '--format=%cs'), mappings, files };
  mkdirSync(join(intranet, 'vendor'), { recursive: true });
  writeFileSync(join(intranet, 'vendor', `${central}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  return Object.keys(files).length;
}

/** Write the four repos. Returns what it did, one line per repo, for the caller to print. */
export function bootstrap({ org, name, profile = 'b2b-services', dest, kit = KIT, localOnly = false, run = execFileSync, log = console.log }) {
  if (!org || !name) throw new Error('usage: --org <github-org> --name "<Company>" [--profile …] [--dest <folder>] [--local-only]');
  const central = basename(kit);
  const subs = substitutions({ org, name, profile, central });
  const where = resolve(dest || dirname(kit));
  const gh = (...a) => run('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const done = [];

  for (const repo of REPOS) {
    const dir = join(where, repo);
    if (existsSync(join(dir, '.git'))) { done.push(`${repo}: already there, left alone`); continue; }
    if (existsSync(dir) && readdirSync(dir).length) throw new Error(`${dir} exists and is not empty: move it aside first, nothing was written`);
    const src = join(TEMPLATES, repo);
    // The customers tree ships both shapes, so every folder in templates/ is a real folder with a
    // real example file in it, and the profile keeps one of them.
    const b2c = profile === 'b2c-product';
    const drop = repo === 'customers' ? new Set([...(b2c ? ['companies'] : ['segments', 'partners']), 'README-b2b.md', 'README-b2c.md']) : new Set();
    copyTree(src, dir, subs, { skip: (n) => drop.has(n) });
    if (repo === 'customers') writeFileSync(join(dir, 'README.md'), fill(readFileSync(join(src, b2c ? 'README-b2c.md' : 'README-b2b.md'), 'utf8'), subs));
    if (repo === 'intranet') embedKit(dir, { kit, central, org });

    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'add', '-A');
    git(dir, '-c', 'user.name=bootstrap', '-c', 'user.email=bootstrap@localhost', 'commit', '-q', '-m', `Set ${repo} up from the company pack`);
    tryGit(dir, 'remote', 'add', 'origin', `https://github.com/${org}/${repo}.git`);
    if (localOnly) { done.push(`${repo}: created locally`); continue; }
    try { gh('repo', 'view', `${org}/${repo}`); } catch { gh('repo', 'create', `${org}/${repo}`, '--private'); }
    try { git(dir, 'push', '-q', '-u', 'origin', 'main'); done.push(`${repo}: created and pushed`); }
    catch { done.push(`${repo}: created locally, push to do (the remote repo may not be empty)`); }
  }

  // The central repo's own additions, only where it has none: a file someone already wrote is theirs.
  for (const n of readdirSync(join(TEMPLATES, 'central'))) {
    const to = join(kit, n);
    if (existsSync(to)) { done.push(`${n}: already in ${central}, left alone`); continue; }
    writeFileSync(to, fill(readFileSync(join(TEMPLATES, 'central', n), 'utf8'), subs));
    done.push(`${n}: added to ${central}`);
  }
  for (const line of done) log(`  ${line}`);
  return { where, central, subs, done };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--local-only') { out.localOnly = true; continue; }
    const m = a.match(/^--(org|name|profile|dest)(?:=(.*))?$/);
    if (!m) throw new Error(`unknown argument ${a}`);
    out[m[1]] = m[2] ?? argv[++i];
  }
  return out;
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.localOnly) {
      try { execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' }); }
      catch { throw new Error('gh is missing or not signed in (gh auth login), or pass --local-only to write the folders only'); }
    }
    console.log(`→ ${args.name} (${args.profile || 'b2b-services'}) in ${args.org}`);
    const r = bootstrap(args);
    const leftover = [];
    for (const repo of REPOS) {
      const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => {
        if (['.git', 'node_modules'].includes(e.name)) return;
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (TEXT.has(extname(e.name)) && /__[A-Z][A-Z_]*__/.test(readFileSync(p, 'utf8'))) leftover.push(p);
      });
      if (existsSync(join(r.where, repo))) walk(join(r.where, repo));
    }
    if (leftover.length) console.log(`\n▲ placeholders left in: ${leftover.join(', ')}`);
    console.log(`
Done. Next, in order (packs/company/skills/company-setup/SKILL.md):

  1. cd ${join(r.where, 'intranet')} && npm install && npm run dev
     The site runs on http://localhost:4321 with the invented example content.
  2. Add the four repos to ORGANIGRAM.md, Kind \`satellite\`.
  3. Fill the files, starting with administrative/people/ and strategy/product/positioning.md.
  4. Deploy and close the door: the skill's "Deploy" and "Close the door".

The example content is invented, and each file says so at the top.`);
  } catch (e) {
    console.error(`✘ ${e.message}`);
    process.exit(1);
  }
}
