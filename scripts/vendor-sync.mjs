#!/usr/bin/env node
// Files co-owned with other repos, kept byte for byte identical: a component library two
// organizations both render with, a paginator, a set of tokens, shared checks.
//
// A template upgrade (scripts/kit-sync.mjs) is one-way and merges; a pack only adds files. Neither
// covers a library that two hosts both use AND both improve. Copied by hand, it forks silently:
// the same brand renders differently in two places, and a fix made in one never reaches the other.
//
// Each shared kit is a git repo of its own. The host declares, in `vendor/<kit>.json`, which of the
// kit's paths it embeds and where (a path ending in `/` takes the whole folder):
//
//   { "repo": "<owner>/<kit>", "mappings": [["components/", "site/src/shared/"], ["paged.js", "scripts/doc/paged.js"]] }
//
// and the script keeps, beside the mappings, the kit commit it copied and a sha256 per file:
//
//   node scripts/vendor-sync.mjs pull [<kit>]       update the kit's clone, copy its files here, rewrite
//                                                   the manifest; refuses while the kit has uncommitted
//                                                   changes or a file here differs from what was copied
//   node scripts/vendor-sync.mjs push-back [<kit>]  copy what was edited here into the kit's clone, to
//                                                   commit and push there, then pull
//   node scripts/vendor-sync.mjs verify             every embedded file is the kit's (run it in the tests)
//
// The kit's clone: VENDOR_KIT_DIR, else `<kit>` beside this repo, as the workspace keeps every repo.
// Exit: 0 fine · 1 a divergence or a refusal · 2 nothing declared.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

export function manifests(host = ROOT) {
  const dir = join(host, 'vendor');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const m = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (!Array.isArray(m.mappings) || !m.mappings.length) throw new Error(`vendor/${f}: no "mappings"`);
    return { name: basename(f, '.json'), path: join(dir, f), files: {}, ...m };
  });
}

/** The kit's files to embed, each with its place here. */
function kitFiles(kit, mappings) {
  const out = [];
  for (const [k, h] of mappings) {
    if (k.endsWith('/')) {
      if (!existsSync(join(kit, k))) throw new Error(`the kit has no folder ${k}`);
      for (const n of readdirSync(join(kit, k)).sort()) if (!n.startsWith('.') && statSync(join(kit, k, n)).isFile()) out.push({ src: k + n, here: h + n });
    } else {
      if (!existsSync(join(kit, k))) throw new Error(`the kit has no file ${k}`);
      out.push({ src: k, here: h });
    }
  }
  return out;
}

/** Embedded files that are no longer what was copied: [{ src, here, why }]. */
export function divergences(m, host = ROOT) {
  return Object.entries(m.files).flatMap(([src, { here, sha256 }]) => {
    const f = join(host, here);
    if (!existsSync(f)) return [{ src, here, why: 'missing here' }];
    return sha(f) === sha256 ? [] : [{ src, here, why: 'edited here' }];
  });
}

const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const kitDir = (m, host) => resolve(process.env.VENDOR_KIT_DIR || join(host, '..', m.name));

function ready(kit, m) {
  if (!existsSync(join(kit, '.git'))) throw new Error(`no clone of ${m.name} at ${kit}${m.repo ? ` (gh repo clone ${m.repo} ${kit})` : ''}`);
  try { git(kit, 'pull', '--ff-only', '--quiet'); } catch { /* offline or no upstream: work with the clone as it is, and say which commit */ }
}

export function pull(m, host = ROOT, log = console.log) {
  const kit = kitDir(m, host);
  ready(kit, m);
  if (git(kit, 'status', '--porcelain')) throw new Error(`${m.name} has uncommitted changes at ${kit}: commit and push them there first`);
  // An edit here that was pushed back and committed in the kit is no longer a divergence: the
  // kit's file is now the same bytes, and the pull records it.
  const before = divergences(m, host).filter((d) => !(d.why === 'edited here' && existsSync(join(kit, d.src)) && sha(join(kit, d.src)) === sha(join(host, d.here))));
  if (before.length) throw new Error(`files edited here and never pushed back:\n${before.map((d) => `  ${d.here} (${d.why})`).join('\n')}\nrun push-back, commit and push in the kit, then pull`);
  const files = {};
  let copied = 0;
  for (const { src, here } of kitFiles(kit, m.mappings)) {
    const from = join(kit, src);
    const to = join(host, here);
    const sum = sha(from);
    if (!existsSync(to) || sha(to) !== sum) { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); copied++; log(`  ↓ ${here}`); }
    files[src] = { here, sha256: sum };
  }
  // A file the kit dropped leaves this repo too.
  for (const [src, { here }] of Object.entries(m.files)) if (!files[src] && existsSync(join(host, here))) { rmSync(join(host, here)); log(`  ✕ ${here}`); }
  const out = { repo: m.repo, commit: git(kit, 'rev-parse', 'HEAD'), date: git(kit, 'log', '-1', '--format=%cs'), mappings: m.mappings, files };
  writeFileSync(m.path, `${JSON.stringify(out, null, 2)}\n`);
  log(`✓ ${m.name} ${out.commit.slice(0, 7)}: ${Object.keys(files).length} file(s), ${copied} copied here`);
  return { copied, files: Object.keys(files).length };
}

export function pushBack(m, host = ROOT, log = console.log) {
  const kit = kitDir(m, host);
  ready(kit, m);
  const d = divergences(m, host);
  if (!d.length) { log(`${m.name}: nothing to push back, every embedded file is the kit's.`); return 0; }
  for (const { src, here, why } of d) {
    if (why === 'missing here') { log(`  ? ${here} is missing here: remove it from the kit by hand if it should go`); continue; }
    copyFileSync(join(host, here), join(kit, src));
    log(`  ↑ ${src}`);
  }
  log(`Then in ${kit}: check it against every repo that embeds it, commit, push; here: pull.`);
  return d.length;
}

export function verify(host = ROOT, log = console.log) {
  let bad = 0;
  for (const m of manifests(host)) {
    const d = divergences(m, host);
    if (!d.length) { log(`✓ ${m.name}: ${Object.keys(m.files).length} file(s), all the kit's${m.commit ? ` (${m.commit.slice(0, 7)})` : ''}`); continue; }
    bad += d.length;
    log(`✘ ${m.name}: ${d.length} file(s) no longer the kit's:\n${d.map((x) => `  ${x.here} (${x.why})`).join('\n')}\n  push-back, commit and push in the kit, then pull`);
  }
  return bad;
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const [cmd, name] = process.argv.slice(2);
  try {
    const all = manifests();
    if (!all.length) { console.log('vendor-sync: no vendor/*.json here, nothing is shared'); process.exit(cmd === 'verify' ? 0 : 2); }
    const pick = name ? all.filter((m) => m.name === name) : all;
    if (!pick.length) throw new Error(`no vendor/${name}.json`);
    if (cmd === 'verify') process.exit(verify() ? 1 : 0);
    else if (cmd === 'pull') pick.forEach((m) => pull(m));
    else if (cmd === 'push-back') pick.forEach((m) => pushBack(m));
    else { console.error('usage: node scripts/vendor-sync.mjs pull [<kit>] | push-back [<kit>] | verify'); process.exit(2); }
  } catch (e) {
    console.error(`✘ ${e.message}`);
    process.exit(1);
  }
}
