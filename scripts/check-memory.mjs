#!/usr/bin/env node
// Les mémoires affirment des choses sur le monde. Le monde change ; elles non.
//
// Une mémoire ne signale jamais qu'elle a vieilli : elle continue d'affirmer avec
// la même assurance une URL morte, un dépôt devenu privé, un chemin qui n'existe
// plus. Le cas qui a motivé ce script s'est trompé sur trois faits d'un coup —
// visibilité du dépôt, architecture, et URL de déploiement — et rien ne le disait.
//
// Ce script ne relit pas la prose. Il extrait ce qui est VÉRIFIABLE et le confronte
// au réel : dépôts, URLs, chemins locaux. Le reste reste au jugement d'un humain,
// et le script le dit plutôt que de faire semblant.
//
//   node scripts/check-memory.mjs                     toutes les mémoires
//   node scripts/check-memory.mjs --side=personnel     un seul côté
//   node scripts/check-memory.mjs --json
//
// Zéro dépendance. `gh` est utilisé s'il est là, sinon les dépôts sont ignorés
// avec une mention explicite plutôt que déclarés bons.

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const BASE = join(homedir(), '.claude', 'projects');
const args = process.argv.slice(2);
const SIDE = (args.find((a) => a.startsWith('--side=')) || '').slice(7);
const AS_JSON = args.includes('--json');

const findings = [];
const add = (severity, where, what, detail) => findings.push({ severity, where, what, detail });

const hasGh = await run('gh', ['--version']).then(() => true).catch(() => false);

// --- les affirmations qu'on sait confronter ---------------------------------

const repoState = new Map();
async function checkRepo(slug) {
  if (repoState.has(slug)) return repoState.get(slug);
  let state = { unknown: true };
  if (hasGh) {
    try {
      const { stdout } = await run('gh', ['repo', 'view', slug, '--json', 'isArchived,visibility']);
      const j = JSON.parse(stdout);
      state = { archived: j.isArchived, visibility: j.visibility.toLowerCase() };
    } catch { state = { missing: true }; }
  }
  repoState.set(slug, state);
  return state;
}

const urlState = new Map();
async function checkUrl(url) {
  if (urlState.has(url)) return urlState.get(url);
  let s;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 8000);
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: c.signal });
    clearTimeout(t);
    s = { status: r.status };
  } catch (e) { s = { error: e.name === 'AbortError' ? 'timeout' : String(e.message) }; }
  urlState.set(url, s);
  return s;
}

// --- le balayage -------------------------------------------------------------

let keys = [];
try {
  keys = (await readdir(BASE, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && e.name.startsWith('-Users-'))
    .map((e) => e.name);
} catch { console.error(`Pas de ${BASE}`); process.exit(1); }

if (SIDE) keys = keys.filter((k) => k.includes(`-projects-${SIDE}-`));

let scanned = 0;
for (const key of keys.sort()) {
  const dir = join(BASE, key, 'memory');
  let files = [];
  try { files = (await readdir(dir)).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md'); } catch { continue; }

  for (const file of files) {
    scanned++;
    const where = `${key.replace('-Users-pyduan-projects-', '')} ▸ ${file}`;
    const text = await readFile(join(dir, file), 'utf8');

    // Dépôts : on ne devine pas ce que la mémoire voulait dire, on affiche l'état
    // réel et on ne crie que sur une contradiction textuelle explicite.
    for (const slug of new Set([...text.matchAll(/\b([A-Za-z0-9-]+\/[A-Za-z0-9._-]+)\b/g)]
        .map((m) => m[1]).filter((s) => !s.includes('.md') && !s.startsWith('/') && s.split('/').length === 2))) {
      const st = await checkRepo(slug);
      if (st.unknown || st.missing) continue;
      // La proximité compte, mais **une ligne n'est pas une unité de sens** : le
      // markdown replie, donc « contributes to the public kit » et le nom du dépôt
      // finissent sur deux lignes différentes et le contexte est perdu. On prend
      // donc le BLOC — la puce ou le paragraphe — qui contient le dépôt.
      const blocks = text.split(/\n(?=\s*[-*]\s|\n)/);
      const own = blocks.filter((b) => b.includes(slug));
      const near = own.join(' ').toLowerCase();
      const whole = text.toLowerCase();

      // Si le bloc nomme PLUSIEURS dépôts, un mot comme « public » ne peut plus être
      // attribué à l'un d'eux par la seule lexique. Le contrôle refuse alors de
      // deviner : une alerte fausse coûte plus cher qu'un manque, parce qu'elle
      // apprend au lecteur à ignorer le rapport.
      const others = new Set(own.join(' ').match(/\b[A-Za-z0-9-]+\/[A-Za-z0-9._-]+\b/g) || []);
      others.delete(slug);
      const ambiguous = [...others].some((o) => !o.includes('.md') && o.split('/').length === 2);

      if (st.archived && !/archiv/i.test(whole)) {
        add('warn', where, slug, `est ARCHIVÉ sur GitHub et la mémoire ne le dit nulle part — une session peut le croire vivant`);
      }
      if (!ambiguous && st.visibility === 'private' && /\bpublic\b/.test(near) && !/priv/i.test(near)) {
        add('warn', where, slug, `est PRIVÉ, et la ligne qui le nomme parle de « public »`);
      }
      if (!ambiguous && st.visibility === 'public' && /\bprivate\b|\bprivé\b/i.test(near) && !/public/i.test(near)) {
        add('warn', where, slug, `est PUBLIC, et la ligne qui le nomme parle de « privé » — vérifier qu'aucune donnée sensible n'y est décrite`);
      }
    }

    for (const url of new Set([...text.matchAll(/https?:\/\/[^\s)`>"'\]]+/g)].map((m) => m[1] ?? m[0]))) {
      // Le markdown colle sa ponctuation aux URLs : **gras**, (parenthèses), fins de phrase.
      const clean = url.replace(/[*_`)\]}>.,;:!?]+$/, '');
      const st = await checkUrl(clean);

      // Un dépôt privé renvoie 404 à un robot anonyme sur toutes ses PRs et issues,
      // qu'elles existent ou non. Le déclarer mort est faux deux fois : le lien
      // marche pour qui a l'accès, et un rapport en permanence rouge cesse d'être
      // lu — ce qui coûte plus cher que la chose qu'il signalait mal.
      const ghRepo = clean.match(/^https:\/\/github\.com\/([A-Za-z0-9-]+\/[A-Za-z0-9._-]+)\//);
      if (ghRepo && (st.status === 404 || st.status === 410)) {
        const r = await checkRepo(ghRepo[1]);
        if (r.visibility === 'private') {
          add('info', where, clean, `dépôt privé : invérifiable anonymement, le lien peut être parfaitement valide`);
          continue;
        }
      }

      if (st.status === 404 || st.status === 410) add('fail', where, clean, `répond ${st.status} — la mémoire pointe vers une page morte`);
      else if (st.error) add('info', where, clean, `injoignable (${st.error}) — peut être normal derrière un accès restreint`);
    }

    for (const p of new Set([...text.matchAll(/(?:~|\/Users\/[a-z]+)\/projects\/[A-Za-z0-9._\/-]+/g)].map((m) => m[0]))) {
      const abs = p.replace(/^~/, homedir()).replace(/[.,;:`)]+$/, '');
      if (existsSync(abs)) continue;

      // Une mémoire qui DOCUMENTE un chemin mort ne doit pas être signalée pour
      // le contenir : c'est le contraire d'une dérive, c'est la dérive déjà notée.
      // Même principe que pour les liens privés — reconnaître que l'auteur sait.
      const ctx = text.split(/\n(?=\s*[-*]\s|\n)/).filter((b) => b.includes(p)).join(' ');
      if (/quarantaine|quarantine|retir[ée]|removed|doublon|archiv|n'existe plus|pas de clone/i.test(ctx)) {
        add('info', where, p, `absent du disque, et la mémoire le dit — rien à corriger`);
        continue;
      }
      add('warn', where, p, `n'existe pas sur ce disque — chemin périmé, ou une autre machine`);
    }

    // Une mémoire sans date est une mémoire qu'on ne peut pas suspecter.
    if (!/\b20\d{2}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/20\d{2}\b/.test(text)) {
      add('info', where, '(aucune date)', `rien ne dit quand ceci a été vérifié, donc rien ne dira qu'elle a vieilli`);
    }
  }
}

// --- rapport ---------------------------------------------------------------

const fails = findings.filter((f) => f.severity === 'fail');
const warns = findings.filter((f) => f.severity === 'warn');

if (AS_JSON) {
  console.log(JSON.stringify({ scanned, findings }, null, 2));
} else {
  let last = '';
  for (const f of [...fails, ...warns, ...findings.filter((x) => x.severity === 'info')]) {
    if (f.where !== last) { console.log(`\n${f.where}`); last = f.where; }
    console.log(`  ${f.severity === 'fail' ? '✗' : f.severity === 'warn' ? '▲' : '·'} ${f.what}\n      ${f.detail}`);
  }
  console.log(`\n${fails.length ? '✗' : '✓'} ${scanned} mémoire(s) balayée(s) — ${fails.length} morte(s), ${warns.length} à corriger`);
  if (!hasGh) console.log('  (gh absent : les dépôts n\'ont pas été vérifiés, pas « trouvés bons »)');
}
process.exitCode = fails.length ? 1 : 0;
