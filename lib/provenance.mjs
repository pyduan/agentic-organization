// Where a figure came from, and whether that is still true.
//
// A tool built over documents the owner maintains by hand is only trustworthy for
// as long as it is reading the documents it thinks it is reading. Two failures on
// one evening, on a model carrying decisions nobody wants to get wrong:
//
//   · It read a stale duplicate of the owner's spreadsheet — two files with
//     neighbouring names on one disk — and reported six anomalies "in your
//     workbook" that existed in neither of her files. Nothing recorded which of
//     the two was authoritative, and nothing checked that the file being read was
//     still the one she works in.
//   · When she opened the right file mid-conversation and the checks went green,
//     it told her she had just fixed six errors. She had fixed nothing. The source
//     had changed between the two measurements, and "it failed, now it passes,
//     therefore someone repaired it" is false the moment that can happen.
//
// So this module holds the three things that turn `source/formats/webapp.md`
// ▸ *The tool is the source of truth* into code a tool can run:
//
//   1. RECORD the identity of every document a computation reads: path, hash,
//      size, modification date. Not "an Excel file was loaded" — that file, that
//      version.
//   2. VERIFY before computing, and refuse rather than warn. A changed source, a
//      missing source, or an export older than the original it derives from stops
//      the tool and shows the two dates.
//   3. CAP a check's severity at the weakest status of its inputs, so a check fed
//      by a figure marked untraceable cannot come back BLOCKING. It can be a
//      question.
//
// Zero dependencies, Node built-ins only, so it runs in a script, in a test, or in
// a build step. It deliberately does NOT run inside a Worker: hashing a file needs
// a filesystem, so the manifest is produced at build time and shipped with the app.
//
// Docs: source/formats/webapp.md. Checked by scripts/check-freshness.mjs ▸ sources.

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export const MANIFEST_VERSION = 1;

// The five statuses that keep coming up on a real dossier, weakest last. They are
// the owner's vocabulary, not a technical one: they describe what the paperwork
// supports, which is the only thing that can bound what a check may assert.
export const STATUSES = ['established', 'conditional', 'envisaged', 'to-establish', 'untraceable'];

// What a check may claim, given what feeds it. `blocking` requires every input to
// be established, because the whole failure this prevents was a BLOCKING verdict
// resting on a term the tool's own notes called untraceable.
const SEVERITY_BY_STATUS = {
  established: 'blocking',
  conditional: 'warning',
  envisaged: 'question',
  'to-establish': 'question',
  untraceable: 'question',
};
export const SEVERITIES = ['blocking', 'warning', 'question'];

/**
 * The strongest severity a check may carry, given the statuses of its inputs.
 * An unknown status is treated as the weakest, never the strongest: a typo must
 * not be able to promote a verdict.
 */
export function capSeverity(statuses) {
  const list = [statuses].flat().filter(Boolean);
  if (!list.length) return 'question';
  let worst = 0;
  for (const s of list) {
    const rank = STATUSES.indexOf(s);
    worst = Math.max(worst, rank === -1 ? STATUSES.length - 1 : rank);
  }
  return SEVERITY_BY_STATUS[STATUSES[worst]] || 'question';
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const abs = (root, p) => (isAbsolute(p) ? p : resolve(root, p));

/** Identity of one file on disk, or null when it is not there. */
export async function identify(root, path) {
  const full = abs(root, path);
  if (!existsSync(full)) return null;
  const [buf, st] = await Promise.all([readFile(full), stat(full)]);
  return {
    path: isAbsolute(path) ? relative(root, full) : path,
    sha256: sha256(buf),
    size: st.size,
    modified: new Date(st.mtimeMs).toISOString(),
  };
}

/**
 * Build a manifest from a declaration. Each source needs an `id` and a `path`;
 * `role: 'export'` also needs `of`, the id of the original it was generated from,
 * because an export whose original is not named is a source pretending to be one.
 *
 * `figures` is the other half and the one that gets skipped: one entry per figure
 * that will inform a decision, carrying its status and the sources it comes from.
 * That is what lets a reader tell a value fixed by a document from a working
 * hypothesis from something that will move — which, six months later, is the
 * difference between reading the model and believing it.
 */
export async function record(root, declaration) {
  const sources = [];
  for (const s of declaration.sources || []) {
    if (!s.id || !s.path) throw new Error(`provenance: every source needs an id and a path (got ${JSON.stringify(s)})`);
    const seen = await identify(root, s.path);
    if (!seen) throw new Error(`provenance: source "${s.id}" is not on disk at ${s.path} — record what exists, never what should`);
    sources.push({ id: s.id, role: s.role || 'original', of: s.of || null, label: s.label || null, ...seen });
  }
  const ids = new Set(sources.map((s) => s.id));
  for (const s of sources) {
    if (s.role === 'export' && !s.of) throw new Error(`provenance: export "${s.id}" does not say which original it came from`);
    if (s.of && !ids.has(s.of)) throw new Error(`provenance: export "${s.id}" points at unknown original "${s.of}"`);
  }
  const figures = (declaration.figures || []).map((f) => {
    if (!f.id) throw new Error('provenance: every figure needs an id');
    const status = STATUSES.includes(f.status) ? f.status : null;
    if (!status) throw new Error(`provenance: figure "${f.id}" has status "${f.status}", not one of ${STATUSES.join(', ')}`);
    for (const from of f.from || []) {
      if (!ids.has(from)) throw new Error(`provenance: figure "${f.id}" reads unknown source "${from}"`);
    }
    return { id: f.id, status, from: f.from || [], note: f.note || null, label: f.label || null };
  });
  return { version: MANIFEST_VERSION, recorded: declaration.recorded || null, sources, figures };
}

/**
 * Compare a manifest against what is on disk now. `ok: false` means the tool must
 * refuse to compute, not warn and carry on: every finding below is a case where
 * the numbers would be about a document nobody chose.
 */
export async function verify(root, manifest) {
  const findings = [];
  const say = (severity, id, what) => findings.push({ severity, id, what });
  if (!manifest || manifest.version !== MANIFEST_VERSION) {
    say('stop', 'manifest', `unreadable manifest, or version ${manifest?.version} where ${MANIFEST_VERSION} was expected`);
    return { ok: false, findings, sources: [] };
  }

  const now = new Map();
  for (const s of manifest.sources) now.set(s.id, await identify(root, s.path));

  for (const s of manifest.sources) {
    const seen = now.get(s.id);
    if (!seen) {
      say('stop', s.id, `not on disk at ${s.path}. Two files of neighbouring names is ordinary; guessing which one you meant is not.`);
      continue;
    }
    if (seen.sha256 !== s.sha256) {
      say('stop', s.id, `${s.path} has changed since it was recorded (recorded ${s.modified.slice(0, 10)}, now ${seen.modified.slice(0, 10)}). ` +
        'Re-record it deliberately, so the change is an event with a date rather than something that happened.');
    }
  }

  // An export is a photograph of a document, and the failure is that nobody looks
  // at when it was taken. Comparing the two dates is one line and it is the whole
  // guard: the export in the real case was more than a day behind.
  for (const s of manifest.sources.filter((x) => x.role === 'export' && x.of)) {
    const exp = now.get(s.id);
    const orig = now.get(s.of);
    if (!exp || !orig) continue;
    if (Date.parse(exp.modified) < Date.parse(orig.modified)) {
      say('stop', s.id, `this export (${exp.modified.slice(0, 16).replace('T', ' ')}) is older than the document it comes from ` +
        `(${orig.modified.slice(0, 16).replace('T', ' ')}). Regenerate it before computing anything: an export is never a source.`);
    }
  }

  return { ok: findings.every((f) => f.severity !== 'stop'), findings, sources: [...now.values()].filter(Boolean) };
}

/**
 * One line saying where a figure comes from, for display next to the figure rather
 * than in a footnote nobody opens. This is the tooltip: which document, which
 * version, what the paperwork actually supports.
 */
export function provenanceOf(manifest, figureId) {
  const f = (manifest.figures || []).find((x) => x.id === figureId);
  if (!f) return null;
  const from = (f.from || []).map((id) => {
    const s = (manifest.sources || []).find((x) => x.id === id);
    if (!s) return id;
    return `${s.label || s.path} (version of ${s.modified.slice(0, 10)}, ${s.sha256.slice(0, 8)})`;
  });
  const words = {
    established: 'established by a document',
    conditional: 'conditional',
    envisaged: 'envisaged, not decided',
    'to-establish': 'to be established, no document yet',
    untraceable: 'untraceable — nothing found supporting it',
  };
  return {
    status: f.status,
    // Deliberately spelled out rather than colour-coded: a reader six months from
    // now has to be able to tell a value fixed by paperwork from a working
    // hypothesis, and a shade of orange does not say which.
    statusText: words[f.status],
    maxSeverity: capSeverity([f.status]),
    from,
    note: f.note,
    text: `${f.label || f.id}: ${words[f.status]}${f.note ? ` (${f.note})` : ''}. ` +
      (from.length ? `Read from ${from.join('; ')}.` : 'No source recorded.'),
  };
}

/**
 * Did a set of checks pass for the same reason twice? A disappeared failure proves
 * nothing when the input could have changed between the two runs, and it is the
 * comfortable direction of wrong, because it turns a tool's error into the user's
 * success. Give it the manifest each run was measured against.
 */
export function comparable(beforeManifest, afterManifest) {
  const key = (m) => (m?.sources || []).map((s) => `${s.id}:${s.sha256}`).sort().join('|');
  const same = key(beforeManifest) === key(afterManifest);
  return {
    same,
    why: same
      ? 'same sources, same versions: a change in the checks is a change in the data.'
      : 'the sources are not the same versions in both runs, so nothing can be concluded from a check ' +
        'that used to fail and now passes — least of all that somebody fixed it.',
  };
}

/** Convenience for a build step: record, then write. */
export async function writeManifest(root, declaration, out) {
  const manifest = await record(root, declaration);
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(dirname(abs(root, out)), { recursive: true });
  await writeFile(abs(root, out), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export const MANIFEST_NAME = 'provenance.json';

/** Every sources.json under a root, so a sweep can check them all. */
export async function findManifests(root, skip = new Set(['node_modules', '.git', 'dist', '.astro', '.wrangler'])) {
  const { readdir } = await import('node:fs/promises');
  const out = [];
  const walk = async (dir) => {
    let entries = [];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (skip.has(e.name) || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name === MANIFEST_NAME) out.push(p);
    }
  };
  await walk(root);
  return out;
}
