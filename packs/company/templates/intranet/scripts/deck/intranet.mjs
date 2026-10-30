#!/usr/bin/env node
// Builds every deck into the intranet, before `astro build`: strategy/decks and customers/decks →
// public/decks/<slug>/, served behind the same access as the rest of the site.
//
//   node scripts/deck/intranet.mjs              build, check, refuse what fails, list the rest
//   node scripts/deck/intranet.mjs --no-check   no browser (npm run dev, where speed matters)
//   node scripts/deck/intranet.mjs --strict     exit 1 on a refused deck or a check that did not run
//
// A deck is refused, never the build: a deck with a defect or a tell is not served, and the reason
// shows on the Resources page next to its name. Failing the whole intranet over one slide would hold
// back the pipeline and every customer file with it; a reason that only reaches a deploy log
// reaches nobody.
//
// What refuses a deck:
//   - an error: an unknown component or prop, a wrong type, a missing image
//   - a tell from check-ai-tics, read on the deck's text with the words the central repo's
//     source/brand/voice.md says to avoid
//   - a defect from the browser check: overflow, text under the footer, clipped text, type under the
//     floor, unequal grids, a broken image, faint text
// The `look` tier and the build's warnings are printed for a person to read, and refuse nothing.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { locate } from './paths.mjs';
import { allDecks, buildDeck } from './build.mjs';
import { checkDeck, printReport } from './check.mjs';
import { findChrome } from './chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const INTRANET = resolve(HERE, '..', '..');
const flags = new Set(process.argv.slice(2));
const paths = await locate();
const rel = (p) => relative(INTRANET, p);

const files = allDecks(paths);
const manifest = [];
const seen = new Map();
rmSync(paths.out, { recursive: true, force: true });
mkdirSync(paths.out, { recursive: true });

// The tells, for every deck at once: one process, one parse of the rules.
const tics = new Map();
if (files.length) {
  // check-ai-tics is the kit's, copied here; it reads the brand's voice guide from AI_TICS_VOICE.
  const env = { ...process.env, ...(paths.voice?.[0] ? { AI_TICS_VOICE: paths.voice[0] } : {}) };
  const run = spawnSync(process.execPath, [join(INTRANET, 'scripts', 'check-ai-tics.mjs'), '--json', '--mode', 'slide', ...files], { encoding: 'utf8', env });
  try {
    for (const r of JSON.parse(run.stdout || '[]')) tics.set(resolve(r.path), r.found);
  } catch {
    console.log(`  ✘ check-ai-tics did not run: ${(run.stderr || run.stdout || '').split('\n')[0]}`);
  }
}

const chrome = !flags.has('--no-check') && findChrome();
for (const f of files) {
  const deckDir = dirname(f);
  const slug = basename(deckDir);
  const repo = basename(dirname(dirname(deckDir)));
  const entry = { slug, repo, source: rel(f), refused: [], warnings: [] };
  manifest.push(entry);
  if (seen.has(slug)) {
    entry.refused.push(`same name as ${seen.get(slug)}: rename one of the two folders`);
    continue;
  }
  seen.set(slug, entry.source);

  const r = await buildDeck(f, paths, { log: () => {} });
  Object.assign(entry, {
    title: r.meta.title || slug, date: r.meta.date || null, status: r.meta.status || null,
    audience: r.meta.audience || null, company: r.meta.company || null, slides: r.slides.length,
  });
  entry.refused.push(...r.errors);
  entry.warnings.push(...r.warnings);

  const found = tics.get(resolve(f)) || [];
  for (const t of found.filter((x) => x.tier === 'tell')) entry.refused.push(`${t.rule}: «${t.sample}» (${t.hint})`);
  for (const t of found.filter((x) => x.tier !== 'tell')) entry.warnings.push(`${t.rule}: «${t.sample}»`);

  if (r.out && chrome) {
    const c = await checkDeck(r.out, { outDir: join(deckDir, '.check') });
    if (c.skipped) entry.unchecked = c.skipped;
    else {
      for (const d of c.defects) entry.refused.push(`slide ${d.n}, ${d.issue}: ${d.text ? `«${d.text}» ` : ''}${d.detail}`);
      for (const w of c.warnings) entry.warnings.push(`slide ${w.n}, ${w.issue}: ${w.detail}`);
    }
  } else if (r.out) entry.unchecked = flags.has('--no-check') ? 'built without the browser check' : 'no Chrome on this machine';

  if (entry.refused.length) rmSync(join(paths.out, slug), { recursive: true, force: true });
  else entry.url = `/decks/${slug}/`;

  console.log(`${entry.refused.length ? '✘' : entry.unchecked ? '?' : '✓'} ${entry.source}: ${entry.slides ?? 0} slides${entry.url ? ` → ${entry.url}` : ', refused'}`);
  for (const x of entry.refused) console.log(`    ✘ ${x}`);
  for (const x of entry.warnings.slice(0, 8)) console.log(`    ! ${x}`);
  if (entry.warnings.length > 8) console.log(`    ! … and ${entry.warnings.length - 8} more`);
}

mkdirSync(join(INTRANET, 'src', 'data'), { recursive: true });
writeFileSync(join(INTRANET, 'src', 'data', 'decks.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const refused = manifest.filter((d) => d.refused.length).length;
const unchecked = manifest.filter((d) => d.unchecked && !d.refused.length).length;
// Printed on every run, so a log without this line says the step did not run.
console.log(`Decks: ${manifest.length} found, ${manifest.length - refused} built, ${refused} refused; browser check ${chrome ? 'ran' : 'did not run'}${unchecked ? ` (${unchecked} deck(s) unverified)` : ''}.`);
process.exit(flags.has('--strict') && (refused || unchecked) ? 1 : 0);
