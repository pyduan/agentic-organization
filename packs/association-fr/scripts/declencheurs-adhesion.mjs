#!/usr/bin/env node
// Ce qui fait adhérer : corréler les grappes d'adhésions avec ce qui s'est passé ce jour-là.
//
//   node scripts/declencheurs-adhesion.mjs [--seuil 3]
//
// Le registre porte la date de chaque adhésion. Les adhésions n'arrivent pas au fil de l'eau :
// elles tombent par grappes, le même jour, à la suite de quelque chose. Ce script trouve les
// grappes ; nommer la cause reste un geste humain, et les causes connues vivent dans le tableau
// balisé de comms/adhesions-declencheurs.md.
//
// Pourquoi ça compte : c'est la seule façon de savoir ce qui marche avant d'écrire la relance
// suivante. Voir comms/adhesions-declencheurs.md pour ce qu'on en a tiré.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--seuil');
const SEUIL = i > 0 ? Number(process.argv[i + 1]) : 3;

const src = resolve(repo, 'members/adhesions.csv');
if (!existsSync(src)) {
  console.error('\n✘ members/adhesions.csv est absent. Lancer scripts/sync-helloasso.mjs.\n');
  process.exit(1);
}

const lignes = readFileSync(src, 'utf8').replace(/^﻿/, '').split('\n').filter((l) => l.trim());
const entetes = lignes[0].split(',');
const iDate = entetes.indexOf('date');
const iType = entetes.indexOf('type');
const iMontant = entetes.indexOf('montant_eur');
const EST_ADHESION = /cotis|adh[ée]s|member/i;

const parJour = new Map();
const parMois = new Map();
for (const l of lignes.slice(1)) {
  const c = l.split(',');
  const d = c[iDate];
  if (!d) continue;
  const adhesion = EST_ADHESION.test(c[iType] ?? '');
  const montant = parseFloat(c[iMontant]) || 0;
  const j = parJour.get(d) ?? { adhesions: 0, dons: 0, euros: 0 };
  adhesion ? j.adhesions++ : j.dons++;
  j.euros += montant;
  parJour.set(d, j);
  const m = d.slice(0, 7);
  parMois.set(m, (parMois.get(m) ?? 0) + (adhesion ? 1 : 0));
}

const grappes = [...parJour.entries()]
  .filter(([, v]) => v.adhesions >= SEUIL)
  .sort((a, b) => b[0].localeCompare(a[0]));

// Les causes déjà identifiées, lues dans le markdown pour qu'on puisse en ajouter sans toucher au code.
const causes = new Map();
const notes = resolve(repo, 'comms/adhesions-declencheurs.md');
if (existsSync(notes)) {
  for (const l of readFileSync(notes, 'utf8').split('\n')) {
    const m = l.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|[^|]*\|[^|]*\|\s*([^|]+?)\s*\|/);
    if (m) causes.set(m[1], m[2].trim());
  }
}

const mois = [...parMois.keys()].sort();
const max = Math.max(...parMois.values());
console.log(`
ADHÉSIONS PAR MOIS
${mois.map((m) => `  ${m}  ${String(parMois.get(m)).padStart(3)} ${'█'.repeat(Math.round(parMois.get(m) / max * 34))}`).join('\n')}

GRAPPES (${SEUIL} adhésions ou plus le même jour)
${grappes.map(([d, v]) => `  ${d}  ${String(v.adhesions).padStart(3)} adhésions, ${v.euros.toFixed(2)} €` +
  (causes.has(d) ? `\n             → ${causes.get(d)}` : `\n             → cause non identifiée`)).join('\n')}

  ${grappes.filter(([d]) => !causes.has(d)).length} grappe(s) sans cause identifiée.
  Les nommer dans comms/adhesions-declencheurs.md : c'est ce qui rend l'analyse utile.
`);

writeFileSync(resolve(repo, 'comms/grappes-adhesion.json'), JSON.stringify(
  grappes.map(([d, v]) => ({ date: d, adhesions: v.adhesions, euros: Number(v.euros.toFixed(2)), cause: causes.get(d) ?? null })), null, 2));
console.log('✓ comms/grappes-adhesion.json — des comptes et des dates, aucun nom\n');
