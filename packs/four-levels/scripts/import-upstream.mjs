#!/usr/bin/env node
// Bring the published evaluation skills this pack calls into packs/four-levels/upstream/,
// pinned to the commit sources.json names, and say what is there.
//
// Why an import rather than a copy in the pack: the method belongs to its authors. A copy
// shipped inside the pack would drift from theirs with nobody noticing, and two of the
// sources state no licence, so copying them into someone else's repository is not ours to
// decide. The import fetches the pinned version on the installing machine; whether the
// result may be committed is the source's "commit" flag. Sources with commit: false land
// in upstream/<id>/ and are kept out of Git by the pack's .gitignore.
//
// Usage:
//   node packs/four-levels/scripts/import-upstream.mjs            import every source
//   node packs/four-levels/scripts/import-upstream.mjs --only besci-skills
//   node packs/four-levels/scripts/import-upstream.mjs --status   what is imported, exit 1 if a source is missing
//
// Uses one GitHub API call per repository source (to list the files under a path) and
// raw.githubusercontent.com for the files themselves. No token needed.

import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UP = join(PACK, 'upstream');
const { sources } = JSON.parse(await readFile(join(PACK, 'sources.json'), 'utf8'));
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

async function count(dir) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'PROVENANCE.json') continue;
    n += e.isDirectory() ? await count(join(dir, e.name)) : 1;
  }
  return n;
}

if (args.includes('--status')) {
  let missing = 0;
  for (const s of sources) {
    const dir = join(UP, s.id);
    const n = await count(dir);
    let when = '';
    if (existsSync(join(dir, 'PROVENANCE.json'))) {
      const p = JSON.parse(await readFile(join(dir, 'PROVENANCE.json'), 'utf8'));
      when = ` imported ${p.importedAt.slice(0, 10)}${p.ref ? ` at ${p.ref.slice(0, 8)}` : ''}`;
    }
    console.log(`${n ? '✓' : '✗'} ${s.id}: ${n} file(s)${when}${s.commit ? '' : ' (local only, not committed)'}`);
    if (!n) missing++;
  }
  if (missing) console.log('\nRun: node packs/four-levels/scripts/import-upstream.mjs');
  process.exit(missing ? 1 : 0);
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'four-levels-pack' } });
  if (!res.ok) throw new Error(`${res.status} on ${url}`);
  return res;
}

for (const s of sources) {
  if (only && s.id !== only) continue;
  const dir = join(UP, s.id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const files = [];

  if (s.url) {
    const body = await (await get(s.url)).text();
    const name = s.url.split('/').pop();
    await writeFile(join(dir, name), body);
    files.push(name);
  } else {
    const tree = await (await get(`https://api.github.com/repos/${s.repo}/git/trees/${s.ref}?recursive=1`)).json();
    if (tree.truncated) throw new Error(`${s.repo}: tree truncated, import by path instead`);
    const wanted = tree.tree.filter((t) => t.type === 'blob' && s.paths.some((p) => (p.endsWith('/') ? t.path.startsWith(p) : t.path === p)));
    for (const p of s.paths) {
      if (!wanted.some((t) => (p.endsWith('/') ? t.path.startsWith(p) : t.path === p))) {
        throw new Error(`${s.repo}@${s.ref.slice(0, 8)} has nothing at ${p}: the source moved, update sources.json after reading it`);
      }
    }
    for (const t of wanted) {
      const res = await get(`https://raw.githubusercontent.com/${s.repo}/${s.ref}/${t.path}`);
      const out = join(dir, t.path);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, Buffer.from(await res.arrayBuffer()));
      files.push(t.path);
    }
  }

  await writeFile(join(dir, 'PROVENANCE.json'), JSON.stringify({
    id: s.id, title: s.title, publisher: s.publisher,
    from: s.url || `https://github.com/${s.repo}/tree/${s.ref}`,
    ref: s.ref || null, licence: s.licence, attribution: s.attribution || null,
    importedAt: new Date().toISOString(), files,
  }, null, 2) + '\n');
  console.log(`✓ ${s.id}: ${files.length} file(s) from ${s.url || `${s.repo}@${s.ref.slice(0, 8)}`}${s.commit ? '' : ', kept local (licence: ' + s.licence + ')'}`);
}
