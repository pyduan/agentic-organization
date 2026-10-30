// Copies images out of the repos that own them into public/, before the build reads content.
//
// The images live next to the facts they illustrate: a company cover in `customers/images/`, a
// headshot in `administrative/images/`. This repo is a view, so it holds neither. Anyone editing a
// customer file adds the cover in the same commit, in the same repo, without touching the site.
//
// Runs before `astro build` and before `astro dev`, because src/lib/content.mjs drops an image path
// that is not on disk in favour of a monogram. A copy that ran after would silently lose every one.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "..");
const OUT = path.join(process.cwd(), "public", "images");

const SOURCES = [
  ["customers", path.join(ROOT, "customers", "images")],
  ["administrative", path.join(ROOT, "administrative", "images")],
  ["central", path.join(ROOT, "__CENTRAL__", "images")],
];

function copyTree(from, to) {
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      n += copyTree(src, dst);
    } else if (/\.(jpe?g|png|webp|avif|svg)$/i.test(entry.name)) {
      fs.copyFileSync(src, dst);
      n++;
    }
  }
  return n;
}

// public/images is entirely derived. Clearing it keeps a renamed or deleted source from leaving a
// stale file behind that the site would happily go on serving.
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let total = 0;
for (const [label, dir] of SOURCES) {
  if (!fs.existsSync(dir)) {
    console.log(`  ${label}: no images/ directory, skipped`);
    continue;
  }
  const n = copyTree(dir, OUT);
  total += n;
  console.log(`  ${label}: ${n} image(s)`);
}
console.log(`Copied ${total} image(s) into public/images.`);
