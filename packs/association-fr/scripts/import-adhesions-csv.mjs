#!/usr/bin/env node
// Verse un export d'adhésions HelloAsso (CSV) dans le registre versionné.
//
//   node scripts/import-adhesions-csv.mjs <fichier.csv>
//
// Sert pour les exports historiques, ceux qu'on retrouve dans le Drive et que l'API ne rendra
// pas forcément (anciens formulaires, adhésions offertes par code promo). Pour le courant,
// c'est scripts/sync-helloasso.mjs qui interroge l'API directement.
//
// Le script **fusionne**, il n'écrase pas : une adhésion déjà présente (même date, même
// personne, même montant) n'est pas dupliquée. On peut donc relancer sans risque, et empiler
// plusieurs exports d'années différentes.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecrireRegistre, lireAdhesions } from './lib/registre.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error('\n✘ Usage : node scripts/import-adhesions-csv.mjs <fichier.csv>\n');
  process.exit(1);
}

// Parseur CSV : guillemets, séparateur ; ou , et retours à la ligne dans un champ.
function parseCSV(texte) {
  texte = texte.replace(/^﻿/, '');
  const tete = texte.slice(0, 4000);
  const sep = tete.split(';').length > tete.split(',').length ? ';' : ',';
  const lignes = []; let ligne = []; let cur = ''; let guillemet = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemet) {
      if (c === '"') { if (texte[i + 1] === '"') { cur += '"'; i++; } else guillemet = false; }
      else cur += c;
    } else if (c === '"') guillemet = true;
    else if (c === sep) { ligne.push(cur); cur = ''; }
    else if (c === '\n') { ligne.push(cur); lignes.push(ligne); ligne = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || ligne.length) { ligne.push(cur); lignes.push(ligne); }
  return lignes.filter(l => l.some(c => c.trim() !== ''));
}

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const estEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? '').trim());
const jourISO = (s) => {
  const m = String(s ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const iso = String(s ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
};
const euros = (s) => {
  const n = parseFloat(String(s ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const lignes = parseCSV(readFileSync(source, 'utf8'));
const entetes = lignes[0].map(norm);
const col = (...noms) => {
  for (const n of noms) {
    const i = entetes.findIndex(h => h.includes(norm(n)));
    if (i >= 0) return i;
  }
  return -1;
};
const iDate = col('date');
const iAcheteur = col('email acheteur', 'email');
const iNom = col('nom');
const iPrenom = col('prenom');
const iStatut = col('status', 'statut');
const iTarif = col('tarif', 'formule');
const iMontant = col('montant');
const iPromo = col('code promo');
// La dernière colonne du formulaire porte l'email de l'adhérent quand quelqu'un adhère pour lui.
const iEmailAdherent = entetes.length - 1;

if (iDate < 0 || iNom < 0 || iMontant < 0) {
  console.error("\n✘ Colonnes non reconnues. Attendu au minimum une date, un nom et un montant.");
  console.error('  Trouvé : ' + lignes[0].join(' | ') + '\n');
  process.exit(1);
}

const nouvelles = [];
let ignorees = 0;
for (const l of lignes.slice(1)) {
  const date = jourISO(l[iDate]);
  const montant = euros(l[iMontant]);
  if (!date || montant === null) { ignorees++; continue; }
  if (iStatut >= 0 && l[iStatut] && !/valid/i.test(l[iStatut])) { ignorees++; continue; }

  const propre = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
  const candidat = propre(l[iEmailAdherent]);
  const email = (estEmail(candidat) ? candidat : propre(l[iAcheteur])).toLowerCase();
  if (!email) { ignorees++; continue; }

  nouvelles.push({
    date,
    email,
    nom: propre(l[iNom]),
    prenom: propre(l[iPrenom]),
    type: propre(l[iTarif]) || 'Adhésion',
    montant: montant.toFixed(2),
    // Une adhésion offerte par code promo reste une adhésion : on garde la trace du pourquoi.
    formulaire: iPromo >= 0 && propre(l[iPromo]) ? `offerte (${propre(l[iPromo])})` : 'formulaire-d-adhesion',
  });
}

const existantes = lireAdhesions(repo);
const cle = (a) => `${a.date}|${a.email}|${a.montant}|${a.type}`;
const vues = new Set(existantes.map(cle));
const ajoutees = nouvelles.filter(a => !vues.has(cle(a)));

mkdirSync(resolve(repo, 'members'), { recursive: true });
const resultat = ecrireRegistre(repo, existantes.concat(ajoutees));

console.log(`
✓ ${source}
  ${nouvelles.length} adhésion(s) lues, ${ajoutees.length} nouvelle(s), ${nouvelles.length - ajoutees.length} déjà connue(s)${ignorees ? `, ${ignorees} ignorée(s)` : ''}.

  members/adhesions.csv  ${resultat.adhesions} paiements
  members/adherents.csv  ${resultat.personnes} personnes
`);
