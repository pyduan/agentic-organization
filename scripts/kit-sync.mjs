#!/usr/bin/env node
// Upgrade this project from the template without overwriting the owner's own work.
//
// The problem this solves: a project and the template have no shared git history,
// so an upgrade used to be `git checkout template/main -- <paths>`, a copy. That
// cannot tell "the kit changed this file" from "the owner changed this file", so
// a customised skill or script was silently reverted on every upgrade. Observed
// for real on a live project whose publish skill carried its own deploy notes.
//
// The fix is one line of state: .kit-sync records the template commit this project
// last took. With it, every framework file has three versions -- base (what the
// template gave us last time), theirs (what the template has now), ours (what is
// on disk) -- and an upgrade becomes a three-way merge instead of a copy.
//
//   node scripts/kit-sync.mjs status   what would change, and what collides
//   node scripts/kit-sync.mjs apply    apply the safe half, never the collisions
//   node scripts/kit-sync.mjs adopt    once, for a project older than .kit-sync
//   node scripts/kit-sync.mjs reconciled <file…>   you merged the kit's changes by hand
//
// Zero dependencies. Nothing here writes to a colliding file, ever.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SYNC_FILE = join(ROOT, '.kit-sync');
const REMOTE = process.env.KIT_REMOTE || 'template';
const BRANCH = process.env.KIT_BRANCH || 'main';
const REF = `${REMOTE}/${BRANCH}`;

// Framework paths: what the template owns and may replace. Everything else in the
// project belongs to the owner and is never touched. CLAUDE.md is deliberately NOT
// here -- it always carries local rules, so it is reported and never auto-applied.
const FRAMEWORK = [
  '.claude', 'docs', 'scripts', 'lib', 'source/formats',
  'apps/dashboard', 'apps/todos', 'SETUP.md', 'README.md', 'CHANGELOG.md',
];
const REPORT_ONLY = ['CLAUDE.md', 'package.json', 'wrangler.jsonc'];

const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });

const tryGit = (args) => { try { return git(args); } catch { return null; } };

const show = (ref, file) => {
  try {
    return execFileSync('git', ['show', `${ref}:${file}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
};

/** The blob sha a file would have, without writing anything. */
const hashLocal = (file) => {
  try {
    return execFileSync('git', ['hash-object', join(ROOT, file)], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
};

/**
 * Did this file ever leave the template looking exactly like this?
 *
 * The bootstrap problem: an existing project has no .kit-sync, so nothing knows
 * who last touched a file. But if the local copy matches *any* version the
 * template ever published, the owner never edited it — it is just an old copy,
 * and taking the new one loses nothing. Only files matching no template version
 * carry local work, and those are the short list a human has to look at.
 */
function everPublished(file, localSha) {
  if (!localSha) return false;
  const commits = (tryGit(['log', '--format=%H', REF, '--', file]) || '').split('\n').filter(Boolean);
  for (const c of commits) {
    const blob = tryGit(['rev-parse', `${c}:${file}`]);
    if (blob && blob.trim() === localSha) return true;
  }
  return false;
}

const readLocal = (file) => {
  const full = join(ROOT, file);
  return existsSync(full) ? readFileSync(full) : null;
};

const same = (a, b) => (a === null && b === null) || (a !== null && b !== null && a.equals(b));

/**
 * The recorded baseline: the template commit last taken, and the files `adopt`
 * set aside because they carried local work.
 *
 * The set-aside list exists because of a failure this script had: after `adopt`,
 * the baseline becomes the current template, so a file the owner had customised
 * stops looking like a collision and starts looking like "only you changed it".
 * Every later improvement the kit makes to that file is then never offered. The
 * case that proved it: a project whose publish skill was customised, on the very
 * release where the kit added the guard that project most needed.
 *
 * Each set-aside entry is `{ file, at }`: `at` is the template commit the owner's
 * copy was last reconciled against, or null when nobody knows (a file adopt found
 * customised). The first version stored bare file names and reported every one
 * of them under "the kit has changed them since" whenever it differed from the
 * kit, which a customised file always does. An owner read that title on a day the
 * kit had not moved and concluded updates were waiting for him (2026-09-21).
 *
 * Accepts a bare sha, and a list of bare names, which is what earlier versions wrote.
 */
function readSync() {
  if (!existsSync(SYNC_FILE)) return { sha: null, setAside: [] };
  const raw = readFileSync(SYNC_FILE, 'utf8').trim();
  let sha = null, setAside = [];
  if (raw.startsWith('{')) {
    try { const j = JSON.parse(raw); sha = j.sha || null; setAside = j.setAside || []; } catch {}
  } else {
    sha = (raw.match(/\b[0-9a-f]{7,40}\b/) || [])[0] || null;
  }
  setAside = setAside.map((e) => (typeof e === 'string' ? { file: e, at: null } : { file: e.file, at: e.at || null }));
  // A sha we cannot resolve is worse than none: it would silently behave as a
  // first run rather than as an error the operator can see.
  if (sha && tryGit(['cat-file', '-e', `${sha}^{commit}`]) === null) return { missing: sha, setAside };
  return { sha, setAside };
}

/** One entry per file; a later entry for the same file replaces the earlier one. */
const mergeSetAside = (...lists) => {
  const byFile = new Map();
  for (const e of lists.flat()) byFile.set(e.file, e);
  return [...byFile.values()];
};

const writeSync = (sha, setAside) =>
  writeFileSync(SYNC_FILE, `${JSON.stringify({
    sha,
    setAside: [...setAside].sort((a, b) => (a.file < b.file ? -1 : 1)),
  }, null, 2)}\n`);

/** Classify every framework file the template knows about. */
function plan(base) {
  const listed = git(['ls-tree', '-r', '--name-only', REF, '--', ...FRAMEWORK, ...REPORT_ONLY])
    .split('\n').map((s) => s.trim()).filter(Boolean);

  const out = { apply: [], collide: [], localOnly: [], unchanged: [], reportOnly: [], unknown: [] };

  for (const file of listed) {
    const theirs = show(REF, file);
    const ours = readLocal(file);
    const isReportOnly = REPORT_ONLY.some((p) => file === p);

    if (same(ours, theirs)) { out.unchanged.push(file); continue; }

    if (!base) { out.unknown.push(file); continue; }

    const baseContent = show(base, file);

    if (same(baseContent, theirs)) { out.localOnly.push(file); continue; }  // only we changed it
    if (same(baseContent, ours)) {
      (isReportOnly ? out.reportOnly : out.apply).push(file);               // only they changed it
      continue;
    }
    out.collide.push(file);                                                 // both changed it
  }
  return out;
}

/** The owner-facing changelog entries added since the last sync. */
function changelogSince(base) {
  const theirs = show(REF, 'CHANGELOG.md');
  if (!theirs) return null;
  if (!base) return theirs.toString('utf8').split('\n').slice(0, 40).join('\n');
  const ours = show(base, 'CHANGELOG.md');
  if (!ours) return theirs.toString('utf8');
  const added = git(['diff', '--no-color', `${base}:CHANGELOG.md`, `${REF}:CHANGELOG.md`])
    .split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  return added.join('\n').trim() || null;
}

function head(title) { console.log(`\n${title}\n${'-'.repeat(title.length)}`); }
const list = (files) => files.forEach((f) => console.log(`  ${f}`));

function main() {
  const cmd = process.argv[2] || 'status';

  if (tryGit(['remote', 'get-url', REMOTE]) === null) {
    console.error(`No "${REMOTE}" remote. Add it once:\n  git remote add ${REMOTE} https://github.com/pyduan/agentic-organization.git`);
    process.exit(1);
  }
  tryGit(['fetch', '--quiet', REMOTE]);

  const state = readSync();
  const base = state.sha;
  if (state.missing) {
    console.error(`.kit-sync names ${state.missing}, which this clone does not have.\nFetch the template, or delete .kit-sync to treat this as a first upgrade.`);
    process.exit(1);
  }

  const target = git(['rev-parse', REF]).trim();

  if (cmd === 'reconciled') {
    // The owner (or their agent) has read the kit's version of these files and
    // merged what they wanted: record that, so the next status measures from here.
    const files = process.argv.slice(3);
    if (!files.length) { console.error('Name the file(s) you have reconciled.'); process.exit(1); }
    const known = new Set(state.setAside.map((e) => e.file));
    const stray = files.filter((f) => !known.has(f));
    if (stray.length) {
      console.error(`Not kept as yours, so nothing to mark: ${stray.join(', ')}`);
      process.exit(1);
    }
    writeSync(base || target, mergeSetAside(state.setAside, files.map((file) => ({ file, at: target }))));
    console.log(`Marked ${files.length} file(s) reconciled against ${target.slice(0, 8)}.`);
    return;
  }

  const p = plan(base);

  console.log(`Template: ${REF} at ${target.slice(0, 8)}`);
  console.log(base ? `Last synced from: ${base.slice(0, 8)}` : 'Never synced before (no .kit-sync).');

  const news = changelogSince(base);
  if (news) { head("What's new for you"); console.log(news); }

  if (p.apply.length) { head(`Safe to apply (${p.apply.length})`); list(p.apply); }
  if (p.collide.length) {
    head(`⚠ Changed on BOTH sides — never applied automatically (${p.collide.length})`);
    list(p.collide);
    console.log('\n  These carry your own edits. Read each one and merge by hand:');
    console.log(`    git diff ${base ? base.slice(0, 8) : 'BASE'} ${REF} -- <file>   what the kit changed`);
    console.log(`    git diff ${base ? base.slice(0, 8) : 'BASE'} -- <file>          what you changed`);
  }
  if (p.reportOnly.length) {
    head(`Yours to reconcile by hand (${p.reportOnly.length})`);
    list(p.reportOnly);
    console.log('\n  Always carries local values or rules. Never replaced, even when only the kit changed it.');
  }
  // Set-aside files carry the owner's edits and are never overwritten. Each is
  // reported under one of three headings, and only the first claims the kit moved:
  // it is the one that must never go quiet, so a past customisation cannot freeze
  // a future fix. The claim is checked against the version the owner last
  // reconciled with, or failing that the last sync, never against "differs from
  // the kit", which a customised file always does.
  const aside = { moved: [], dropped: [], unknown: [], quiet: [], resolved: [] };
  for (const e of state.setAside) {
    const theirs = show(REF, e.file);
    const ours = readLocal(e.file);
    if (!theirs) { aside.dropped.push(e); continue; }
    if (same(theirs, ours)) { aside.resolved.push(e); continue; }
    const ref = e.at || base;
    const kitMoved = ref ? !same(show(ref, e.file), theirs) : true;
    if (kitMoved && e.at) aside.moved.push(e);
    else if (kitMoved && !e.at && base) aside.moved.push(e);    // moved since the last sync, at least
    else if (!e.at) aside.unknown.push(e);
    else aside.quiet.push(e);
  }
  if (aside.moved.length) {
    head(`⚠ Kept as yours, and the kit has changed them since you last reconciled (${aside.moved.length})`);
    for (const e of aside.moved) console.log(`  ${e.file}    git diff ${(e.at || base).slice(0, 8)} ${REF} -- ${e.file}`);
    console.log('\n  These carry your edits, so they are never overwritten. Take what you want from');
    console.log('  the diff by hand, then mark the file reconciled so this stops repeating:');
    console.log('    node scripts/kit-sync.mjs reconciled <file> [<file> …]');
  }
  if (aside.dropped.length) {
    head(`Kept as yours, and the kit no longer ships them (${aside.dropped.length})`);
    list(aside.dropped.map((e) => e.file));
    console.log('\n  Yours to keep or delete. Nothing in the kit refers to them any more.');
  }
  if (aside.unknown.length) {
    head(`Kept as yours, never reconciled against a known version of the kit (${aside.unknown.length})`);
    list(aside.unknown.map((e) => e.file));
    console.log('\n  Not a change from the kit: these were set aside before kit-sync recorded which');
    console.log('  version each one matched. Review each once against the kit, then mark it:');
    console.log(`    git diff ${REF} -- <file>`);
    console.log('    node scripts/kit-sync.mjs reconciled <file> [<file> …]');
  }
  if (aside.quiet.length) {
    console.log(`\n${aside.quiet.length} file(s) kept as yours; the kit has not touched them since you last reconciled.`);
  }

  if (p.localOnly.length) { head(`Your own edits, left alone (${p.localOnly.length})`); list(p.localOnly); }
  if (p.unknown.length) {
    head(`Cannot tell (${p.unknown.length})`);
    list(p.unknown);
    console.log('\n  No .kit-sync, so there is no way to know who changed these. Review before applying.');
  }

  if (cmd === 'status') {
    const human = p.collide.length + p.unknown.length + aside.moved.length;
    console.log(`\n${p.apply.length} file(s) would be applied, ${human} need a human.`);
    if (p.apply.length) console.log('Run `node scripts/kit-sync.mjs apply` when you have read the above.');
    return;
  }


  if (cmd === 'adopt') {
    // One-time, for a project that predates .kit-sync. Sorts the unknowns by
    // asking the template's own history whether it ever published that exact file.
    const pristine = [], customised = [];
    for (const file of p.unknown) {
      (everPublished(file, hashLocal(file)) || readLocal(file) === null ? pristine : customised).push(file);
    }
    head(`Never edited here — safe to take (${pristine.length})`);
    list(pristine);
    if (customised.length) {
      head(`⚠ Carries your own edits — left untouched (${customised.length})`);
      list(customised);
      console.log('\n  Read each one against the template before deciding:');
      console.log(`    git diff ${REF} -- <file>`);
    }
    for (const file of pristine) {
      const content = show(REF, file);
      if (!content) continue;
      mkdirSync(dirname(join(ROOT, file)), { recursive: true });
      writeFileSync(join(ROOT, file), content);
    }
    // A customised file found by adopt was never reconciled with any known version.
    writeSync(target, mergeSetAside(state.setAside, customised.map((file) => ({ file, at: null }))));
    console.log(`\nAdopted. Baseline is now ${target.slice(0, 8)}; from here upgrades are a three-way merge.`);
    if (customised.length) {
      console.log(`${customised.length} file(s) kept as yours, and recorded in .kit-sync.`);
      console.log('Every later status will tell you when the kit changes one of them, so a');
      console.log("customisation made today cannot freeze tomorrow's fix.");
    }
    return;
  }

  if (cmd !== 'apply') { console.error(`Unknown command: ${cmd}`); process.exit(1); }

  if (p.unknown.length) {
    console.error('\nRefusing to apply: there is no .kit-sync, so an overwrite could silently revert your work.');
    console.error('Run `node scripts/kit-sync.mjs adopt` once — it asks the template history which files you never edited,');
    console.error('takes those, keeps the rest as yours, and records the baseline.');
    process.exit(1);
  }

  for (const file of p.apply) {
    const content = show(REF, file);
    mkdirSync(dirname(join(ROOT, file)), { recursive: true });
    writeFileSync(join(ROOT, file), content);
  }

  // The new baseline is recorded even when collisions remain: those files are
  // untouched, and the owner resolving them later is a separate act. Collisions
  // join the set-aside list, reconciled as of the OLD baseline, because the kit's
  // change between base and target is exactly what the owner has not taken yet.
  // Recording the new one would hide that change at the next status. A set-aside
  // file the owner has since brought level with the kit leaves the list.
  const stillAside = state.setAside.filter((e) => {
    const theirs = show(REF, e.file);
    return !(theirs && same(theirs, readLocal(e.file)));
  });
  writeSync(target, mergeSetAside(stillAside, p.collide.map((file) => ({ file, at: base }))));
  console.log(`\nApplied ${p.apply.length} file(s). Baseline is now ${target.slice(0, 8)}.`);
  if (p.collide.length) console.log(`${p.collide.length} file(s) left for you: they changed on both sides.`);
}

main();
