#!/usr/bin/env node
// What keeps a local-only intranet off the internet.
//
// `npm run intranet -- --local` lets the extension read local/, a git-ignored folder of material
// kept on one machine (applications, drafts, analytics exports), to look at on that machine. Such a
// build is marked with LOCAL_MARK in its folder. `npm run deploy:intranet` runs this script between
// the build and `wrangler deploy`, and it refuses a marked build, and an empty one.
//
// Every build also wipes its folder first, so a page written by a --local build can never survive
// into the next build, which may be the one deployed. The wipe only touches a folder that is empty
// or holds an earlier intranet build: a mistyped --out pointing at anything else stops the build.
//
// Two instances built this by hand before the kit had it; it is the kit's now.
//
// Usage:  node scripts/intranet-guard.mjs [--out=apps/dashboard/dist]     exit 1 when refused
//
// Zero dependencies, Node built-ins only.

import { existsSync, readdirSync, rmSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The file a --local build leaves in its folder. */
export const LOCAL_MARK = '.local-build';

// What an earlier intranet build leaves at the top of its folder; one of them is enough to know it.
const BUILT = ['index.html', 'data.json', LOCAL_MARK];

/** Empty the build folder before a build, or stop when it holds something that is not a build. */
export function prepareOut(out) {
  if (existsSync(out)) {
    const entries = readdirSync(out);
    if (entries.length && !BUILT.some((f) => entries.includes(f))) {
      throw new Error(`${out} is not empty and holds no earlier intranet build, so the build will not wipe it. Point --out at the intranet's own folder.`);
    }
    rmSync(out, { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });
}

/** Mark a build as holding local/ material. */
export function markLocal(out) {
  writeFileSync(join(out, LOCAL_MARK), 'Built with --local: it may hold material from local/ on this machine.\n' +
    'Never deploy it. Rebuild with `npm run intranet` (no --local) before `npm run deploy:intranet`.\n');
}

/** null when the folder may be deployed, or the reason it may not. */
export function refusal(out) {
  if (!existsSync(join(out, 'index.html'))) return `no intranet is built in ${out}. Run \`npm run intranet\` first.`;
  if (existsSync(join(out, LOCAL_MARK))) {
    return `${out} was built with --local, so it may hold material from local/ on this machine.\n` +
      'Rebuild without it (`npm run intranet`), then deploy. What the shared intranet shows comes from the repository; ' +
      'material only some people may read goes in a restricted repository, never in one person\'s local/.';
  }
  return null;
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  const out = resolve((process.argv.slice(2).find((a) => a.startsWith('--out=')) || '').slice(6) || 'apps/dashboard/dist');
  const why = refusal(out);
  if (why) { console.error(`deploy refused: ${why}`); process.exit(1); }
  console.log('intranet guard: built without local/, cleared to deploy.');
}
