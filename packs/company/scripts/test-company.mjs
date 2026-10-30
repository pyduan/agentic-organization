// The company pack, on a throwaway copy of the kit: every profile bootstraps with no placeholder
// left, keeps the customers shape its profile asks for, embeds the kit's engine byte for byte with
// a manifest vendor-sync accepts, leaves a central file someone already wrote alone, and produces an
// intranet whose own tests pass. Nothing touches GitHub (--local-only) or this repo.
//
//   node --test packs/company/scripts/test-company.mjs

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrap, profileValues, PROFILES, REPOS, slugify, substitutions } from './bootstrap-company.mjs';
import { pending, revisits } from './open-decisions.mjs';
import { verify } from '../../../scripts/vendor-sync.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const top = mkdtempSync(join(tmpdir(), 'company-pack-'));
after(() => rmSync(top, { recursive: true, force: true }));

/** A kit instance with only what the bootstrap reads, so nothing is written into this repo. */
function fakeKit(name) {
  const kit = join(top, name, 'acme-organization');
  for (const p of ['scripts/deck', 'scripts/doc', 'scripts/check-ai-tics.mjs', 'scripts/check-contrast.mjs', 'scripts/protect-access.mjs',
    'scripts/vendor-sync.mjs', 'scripts/test-vendor-sync.mjs', 'lib/access.mjs', '.node-version']) {
    if (existsSync(join(KIT, p))) cpSync(join(KIT, p), join(kit, p), { recursive: true });
  }
  writeFileSync(join(kit, 'GLOSSARY.md'), '# Ours already\n');
  return kit;
}

function textFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) textFiles(p, out);
    else if (['.md', '.mjs', '.js', '.json', '.jsonc', '.astro', '.yml', '.css', '.txt', '.html'].includes(extname(e.name))) out.push(p);
  }
  return out;
}

test('every profile has its words, and an unknown one is refused', () => {
  for (const p of PROFILES) assert.ok(profileValues(p).STATUSES.includes('key:'), p);
  assert.equal(profileValues('b2c-product').ENTITY_PLURAL, 'segments');
  assert.throws(() => profileValues('b2b'), /unknown profile/);
  assert.equal(slugify('Éclair & Sons, Ltd'), 'eclair-sons-ltd');
  assert.equal(substitutions({ org: 'o', name: 'Acme Widgets', profile: 'b2b-product', central: 'c' }).__WORKER__, 'acme-widgets-intranet');
});

for (const profile of PROFILES) {
  test(`${profile}: four repos, no placeholder left, the right customers shape`, () => {
    const kit = fakeKit(profile);
    const r = bootstrap({ org: 'acme-org', name: 'Acme Widgets', profile, kit, localOnly: true, log: () => {} });
    for (const repo of REPOS) assert.ok(existsSync(join(r.where, repo, '.git')), repo);
    const left = REPOS.flatMap((repo) => textFiles(join(r.where, repo)))
      .filter((f) => /__[A-Z][A-Z_]*__/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(left, []);
    const customers = readdirSync(join(r.where, 'customers'));
    if (profile === 'b2c-product') assert.ok(customers.includes('segments') && customers.includes('partners') && !customers.includes('companies'));
    else assert.ok(customers.includes('companies') && !customers.includes('segments'));
    assert.ok(!customers.some((n) => n.startsWith('README-')));
    // The central additions: one written, one someone already had, left alone.
    assert.match(readFileSync(join(kit, 'ONBOARDING.md'), 'utf8'), /Acme Widgets/);
    assert.equal(readFileSync(join(kit, 'GLOSSARY.md'), 'utf8'), '# Ours already\n');
    // The embedded engine is the kit's, and vendor-sync says so.
    const manifest = JSON.parse(readFileSync(join(r.where, 'intranet', 'vendor', 'acme-organization.json'), 'utf8'));
    assert.equal(manifest.repo, 'acme-org/acme-organization');
    assert.ok(Object.keys(manifest.files).includes('scripts/deck/build.mjs'));
    assert.ok(!Object.keys(manifest.files).includes('scripts/deck/paths.mjs'), "paths.mjs is the pack's own");
    assert.equal(verify(join(r.where, 'intranet'), () => {}), 0);
  });
}

test("a second run leaves the repos alone, and a folder in the way stops it before it writes", () => {
  const kit = fakeKit('rerun');
  const first = bootstrap({ org: 'acme-org', name: 'Acme', kit, localOnly: true, log: () => {} });
  const again = bootstrap({ org: 'acme-org', name: 'Acme', kit, localOnly: true, log: () => {} });
  assert.ok(again.done.filter((l) => /already there/.test(l)).length === REPOS.length);
  const kit2 = fakeKit('blocked');
  mkdirSync(join(dirname(kit2), 'customers'));
  writeFileSync(join(dirname(kit2), 'customers', 'mine.txt'), 'x');
  assert.throws(() => bootstrap({ org: 'o', name: 'Acme', kit: kit2, localOnly: true, log: () => {} }), /not empty/);
  assert.ok(first.where);
});

test("the intranet's own tests pass on what the bootstrap wrote", () => {
  const kit = fakeKit('intranet-tests');
  const r = bootstrap({ org: 'acme-org', name: 'Acme Widgets', profile: 'b2b-services', kit, localOnly: true, log: () => {} });
  const dir = join(r.where, 'intranet');
  const run = spawnSync(process.execPath, ['--test', 'scripts/test-worker.mjs', 'scripts/test-checks.mjs', 'scripts/test-vendor-sync.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('open-decisions reads the pending bullets and the revisit dates, and skips the example', () => {
  const md = '# Decisions\n\n## To decide\n\n- **Example to replace.** What it blocks. (raised YYYY-MM-DD)\n- **Which bank.** Blocks the first invoice,\n  Sam decides. (raised 2026-01-05)\n\n## Price list v2 (2026-01-02) · business\n\nRevisit on 2026-03-01, when the costs are known.\n';
  assert.deepEqual(pending(md), ['**Which bank.** Blocks the first invoice, Sam decides. (raised 2026-01-05)']);
  assert.deepEqual(revisits(md), [{ heading: 'Price list v2 (2026-01-02) · business', due: '2026-03-01' }]);
});
