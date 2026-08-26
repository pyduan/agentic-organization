#!/usr/bin/env node
// Rafraîchit le registre des adhérents depuis HelloAsso.
//
//   node scripts/sync-helloasso.mjs
//
// Écrit deux fichiers, tous deux versionnés (décision du 24 août 2026, cf. members/README.md) :
//   members/adhesions.csv   une ligne par paiement : c'est la donnée brute, elle ne s'interprète pas
//   members/adherents.csv   une ligne par personne : le registre, dérivé du fichier ci-dessus
//
// ⚠️ Ce script tourne sur VOTRE machine, pas sur le Worker. Le Worker ne peut pas écrire dans le
// dépôt : il n'a ni accès git, ni stockage, et c'est délibéré. Ce qui met le dépôt à jour, c'est
// une personne (ou son agent) qui lance cette commande et publie.
//
// Trois façons de s'authentifier, essayées dans cet ordre :
//   1. Les variables d'environnement HELLOASSO_CLIENT_ID et HELLOASSO_CLIENT_SECRET.
//   2. Le relais du Worker via `cloudflared` : vous vous connectez avec votre propre email et ne
//      détenez aucun secret. C'est la voie prévue pour Brigitte, Hervé et Louise.
//   3. À défaut, le script demande les identifiants et les garde **en mémoire pour ce seul
//      passage** : rien n'est écrit sur le disque, rien n'est exporté.
import { readSettings } from './settings.mjs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecrireRegistre, lireAdhesions, majAgregats } from './lib/registre.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Declared, not baked in: this is the whole reason the pack is installable.
// Set it in packs/association-fr/settings.json, or pass HELLOASSO_ORG.
const settings = readSettings();

const ORG = process.env.HELLOASSO_ORG || settings.helloassoSlug;
// La cotisation annuelle pratiquée depuis 2022. Au-delà, c'est un don.
// ⚠️ Le montant est soumis au vote de l'AG du 12 septembre 2026 (admin/cotisations.md).
const ADMIN = process.env.ADMIN_URL || settings.adminUrl;

const mourir = (msg) => { console.error('\n✘ ' + msg + '\n'); process.exit(1); };

// ─────────────────────────────────────────────────────────── accès à l'API
// Saisie masquée : le secret ne s'affiche pas et n'entre pas dans l'historique du terminal.
function demander(question, masquer = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (!masquer) { rl.question(question, (r) => { rl.close(); resolve(r.trim()); }); return; }
    const ecrire = rl.output.write.bind(rl.output);
    rl.output.write = (c) => (/\n|\r/.test(c) ? ecrire(c) : true);
    rl.question(question, (r) => {
      rl.output.write = ecrire; ecrire('\n'); rl.close(); resolve(r.trim());
    });
  });
}

async function jetonDepuis(id, secret) {
  const r = await fetch('https://api.helloasso.com/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!r.ok) mourir(`HelloAsso a refusé les identifiants (HTTP ${r.status}).`);
  return (await r.json()).access_token;
}

const appeleur = (jeton) => async (chemin, params) => {
  const u = new URL(`https://api.helloasso.com/v5/organizations/${ORG}/${chemin}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return fetch(u, { headers: { authorization: `Bearer ${jeton}` } });
};

async function viaIdentifiants() {
  const id = process.env.HELLOASSO_CLIENT_ID;
  const secret = process.env.HELLOASSO_CLIENT_SECRET;
  if (!id || !secret) return null;
  const r = await fetch('https://api.helloasso.com/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!r.ok) mourir(`HelloAsso a refusé les identifiants de l'environnement (HTTP ${r.status}).`);
  console.log('· identifiants HelloAsso lus dans l\'environnement');
  return appeleur((await r.json()).access_token);
}

// Dernier recours : on demande, on s'en sert, on oublie.
async function viaSaisie() {
  if (!process.stdin.isTTY) return null;
  console.log(`
Aucun identifiant dans l'environnement, et cloudflared n'est pas installé.
Vous pouvez saisir les identifiants de l'API HelloAsso maintenant : ils servent à ce seul
passage, ne sont écrits nulle part et ne sont pas exportés.

(Pour ne plus avoir à les saisir : brew install cloudflared, puis relancez.)
`);
  const id = await demander('Client ID     : ');
  const secret = await demander('Client secret : ', true);
  if (!id || !secret) return null;
  return appeleur(await jetonDepuis(id, secret));
}

function jetonCloudflared() {
  try {
    const t = execFileSync('cloudflared', ['access', 'token', `-app=${ADMIN}`], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return t && !t.startsWith('failed') ? t : null;
  } catch { return null; }
}

async function viaRelais() {
  const jeton = jetonCloudflared();
  if (!jeton) return null;
  console.log('· connecté au relais du Worker via cloudflared');
  return async (chemin, params) => {
    const u = new URL(`${ADMIN}/api/helloasso/${chemin}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return fetch(u, { headers: { 'cf-access-token': jeton } });
  };
}

const appel = (await viaIdentifiants()) ?? (await viaRelais()) ?? (await viaSaisie());
if (!appel) {
  mourir(
    "Aucun moyen de joindre HelloAsso.\n\n" +
    "  · installer cloudflared (brew install cloudflared) puis relancer : vous vous connecterez\n" +
    "    avec votre propre email, sans détenir aucun secret. C'est la voie recommandée ;\n" +
    "  · ou exporter HELLOASSO_CLIENT_ID et HELLOASSO_CLIENT_SECRET.\n\n" +
    "  Voir docs/donnees.md."
  );
}

// ────────────────────────────────────────────────────── récupération des items
// On lit /items et non /orders, pour trois raisons vérifiées sur l'API le 25 août 2026 :
//   · une commande peut contenir à la fois un don et une adhésion ; /items les sépare ;
//   · un item d'adhésion porte `user` — l'adhérent réel, qui n'est pas toujours le payeur ;
//   · il porte aussi `customFields`, où le formulaire de l'association demande l'email de
//     l'adhérent. C'est lui qui fait foi quand quelqu'un adhère pour un tiers.
//
// ⚠️ La pagination de /items ne renvoie ni totalCount ni totalPages (les deux valent -1) :
// il faut suivre `pagination.continuationToken` jusqu'à ce qu'une page revienne vide.
const items = [];
let suite = null;
for (let page = 1; page <= 200; page++) {
  const params = { pageSize: 100, withDetails: 'true' };
  if (suite) params.continuationToken = suite;
  const r = await appel('items', params);
  if (!r.ok) {
    const corps = await r.text();
    mourir(`HelloAsso a répondu ${r.status}.\n  ${corps.slice(0, 400)}`);
  }
  const j = await r.json();
  const lot = j.data ?? [];
  items.push(...lot);
  process.stdout.write(`\r· ${items.length} items lus…`);
  suite = j.pagination?.continuationToken ?? null;
  if (!lot.length || !suite) break;
}
console.log('');

// ────────────────────────────────────────────────────────────── mise en forme
const jour = (d) => String(d ?? '').slice(0, 10);
// HelloAsso compte en centimes.
const euros = (c) => (Number(c ?? 0) / 100).toFixed(2);

const estEmail = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(t ?? '').trim());

// L'email de l'adhérent, dans l'ordre de confiance : le champ personnalisé du formulaire, puis
// celui du payeur. C'est ce qui évite d'attribuer à une seule personne les adhésions qu'elle a
// offertes à d'autres.
function emailAdherent(it) {
  const perso = (it.customFields ?? []).find((c) => /e-?mail/i.test(c.name ?? '') && estEmail(c.answer));
  if (perso) return perso.answer.trim().toLowerCase();
  return (it.payer?.email ?? '').trim().toLowerCase();
}

const venuesDeHelloAsso = [];
for (const it of items) {
  const email = emailAdherent(it);
  if (!email) continue;
  // `user` est l'adhérent ; à défaut (un don), c'est le payeur.
  const qui = it.user ?? it.payer ?? {};
  venuesDeHelloAsso.push({
    date: jour(it.order?.date),
    email,
    nom: (qui.lastName ?? '').trim(),
    prenom: (qui.firstName ?? '').trim(),
    // `name` porte le libellé du tarif (« Cotisation annuelle ») ; `type` la nature HelloAsso.
    type: it.name?.trim() || it.type || 'Adhésion',
    montant: euros(it.amount),
    formulaire: it.order?.formSlug ?? '',
  });
}

// On fusionne plutôt que d'écraser : le registre porte aussi des adhésions versées à la main
// (chèque, espèces) et des exports historiques que l'API ne rend pas.
const existantes = lireAdhesions(repo);
const cle = (a) => `${a.date}|${a.email}|${a.montant}|${a.type}`;
const vues = new Set(existantes.map(cle));
const ajoutees = venuesDeHelloAsso.filter(a => !vues.has(cle(a)));

mkdirSync(resolve(repo, 'members'), { recursive: true });
const resultat = ecrireRegistre(repo, existantes.concat(ajoutees));

// La routine demandée : les comptes datés repartent dans le dépôt, sans un seul nom.
const aujourdhui = new Date().toISOString().slice(0, 10);
const rows = majAgregats(repo, existantes.concat(ajoutees), { arreteLe: aujourdhui });
const courant = rows[0];

console.log(`
✓ members/adhesions.csv   ${resultat.adhesions} paiements (${ajoutees.length} nouveaux)
✓ members/adherents.csv   ${resultat.personnes} personnes
✓ admin/cotisations.md    agrégats réécrits, ${rows.length} exercice(s)

  Exercice ${courant.exercice} : ${courant.a_jour} à jour, ${courant.nouveaux} nouveaux,
  ${courant.non_renouveles} non renouvelés, ${courant.collecte.toFixed(2)} € collectés.
  Et ${courant.dons_sans_adhesion} personne(s) ont donné cette année sans prendre l'adhésion.

  ⚠️ « À jour » ne compte que les adhésions, code promo à 0 € compris. Un don, même de 200 €,
     n'est pas une adhésion et ne donne pas le droit de vote — c'est la colonne d'à côté. Si le
     conseil décide qu'un don vaut cotisation, il faudra le décider explicitement :
     voir admin/cotisations.md.

  Relire le diff, puis publier avec la compétence « publish ».
`);
