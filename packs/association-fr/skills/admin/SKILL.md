---
name: admin
description: "Administration de l'association : cotisations (qui est à jour, qui relancer), assemblée générale (convocation, pouvoir, rapport moral, rapport financier, diapositives), stocks terrain et réapprovisionnement. À utiliser quand le propriétaire dit « qui n'a pas payé sa cotisation », « prépare l'AG », « il faut convoquer l'assemblée », « rapport du trésorier », « où on en est des stocks », « quand faut-il recommander », « combien de membres ». Pas pour un chiffre d'impact (impact/) ni pour la comptabilité (finance/)."
---

# Administration

La vie statutaire et la gestion courante. **Commencer par [`admin/todo.md`](../../../admin/todo.md)** :
c'est le point d'entrée, et le tableau de bord l'affiche tel quel. Les règles, les modèles et les
agrégats vivent dans [`admin/`](../../../admin/README.md) et
[`terrain/`](../../../terrain/README.md) ; l'outil d'administration de l'association (source dans
`apps/admin/`) fait les calculs qui touchent à des personnes, **dans le navigateur**, et les
documents de séance s'y impriment.

## La règle qui passe avant tout le reste

**Les adhérents oui, les bénéficiaires jamais.** Position changée le 24 août 2026 (décision de Paul,
`source/decisions.md`) :

- **Le registre des adhérents est versionné** dans `members/adherents.csv` : nom, email, adhésions et
  leurs dates. Le dépôt est privé, les adhérents sont pour l'essentiel des proches, et tenir un
  registre est une obligation ordinaire d'une association loi 1901.
- **Les bénéficiaires n'entrent jamais dans ce dépôt**, sous aucune forme. Ce sont des mineurs et des
  données de santé, et ils appartiennent aux structures partenaires. On compte des **effectifs**.
- Ce qu'on n'écrit pas non plus : coordonnées bancaires, notes personnelles sur quelqu'un, rien qu'on
  n'écrirait pas devant la personne. L'historique git est définitif.

Voir [`members/README.md`](../../../members/README.md), qui porte le détail et ce qu'on répond à un
adhérent qui demande l'effacement de ses données.

## Cotisations

**Le montant n'est pas fixé et ce n'est pas un oubli : c'est l'AG qui le fixe** (point 3 de l'ordre
du jour du 12 septembre 2026). Tant que l'assemblée n'a pas voté, ne citer aucun montant dans un
courrier ni dans une convocation. Voir [`admin/cotisations.md`](../../../admin/cotisations.md).

**Où trouver qui est à jour** : plus besoin d'export. L'outil interroge l'API HelloAsso en direct
(bouton « Charger depuis HelloAsso »), et `node scripts/sync-helloasso.mjs` rafraîchit le registre
versionné. Le secret vit sur le Worker, personne ne le détient — voir
[`docs/donnees.md`](../../../docs/donnees.md). L'export CSV reste accepté comme voie de secours.

La relance suit `source/brand/voice.md`. Une relance de cotisation dit ce que la cotisation a
permis (chiffres depuis [`impact/`](../../../impact/README.md)) ; ce n'est pas un rappel de facture.

## Assemblée générale

Tout le cycle est dans
[`admin/assemblee-generale/README.md`](../../../admin/assemblee-generale/README.md). Deux réflexes :

- **Les délais de convocation, le quorum et les majorités viennent des statuts, pas de la loi de
  1901**, qui ne les fixe pas pour une association déclarée. Ne jamais en écrire un de mémoire.
  Les statuts sont chez la présidence ; le tableau des règles est à remplir une fois dans ce
  README, et c'est lui qu'on relit ensuite.
- **Une résolution votée hors ordre du jour est attaquable.** Donc l'ordre du jour de la
  convocation se rédige en pensant à ce qui sera voté.

**L'AG du 12 septembre 2026 est instruite** dans
[`admin/assemblee-generale/2026/`](../../../admin/assemblee-generale/2026/README.md) : convocation et
pouvoir transcrits, ordre du jour, état de chaque document, brouillons des deux rapports.

Les quatre modèles restent dans `admin/assemblee-generale/modeles/`. Le rapport financier **ne
recalcule rien** : il reprend `finance/`, où `comptes-2025.md` et `achats.md` existent désormais,
reconstitués depuis les relevés CIC. ⚠️ Il n'existe **aucun relevé de 2026** : le dire plutôt que de
reconstituer.

**La feuille de présence, le registre des pouvoirs et le pouvoir vierge** s'impriment depuis l'onglet
*Assemblée générale* de l'outil, remplis avec la liste des membres à jour. Les diapositives sont dans
`apps/admin/public/decks/ag-2026/` — **derrière Cloudflare Access, pas sur le site public**, parce
qu'elles portent les comptes. Chaque chiffre affiché doit exister dans `source/facts/facts.md` ou
dans `finance/`.

## Stocks et terrain

[`terrain/stocks.json`](../../../terrain/stocks.json) fait foi ; l'onglet *Stocks* de l'outil le lit
et calcule l'épuisement et la date de commande (épuisement − délai − marge). Pour corriger un
chiffre, éditer le JSON, pas l'app.

Un site marqué `"placeholder": true` n'est pas calculé, exprès : mieux vaut « incomplet » qu'une
date fausse qui a l'air sûre. Même logique pour `consumption_source: "estimé"`, signalé dans le
tableau. **Ne jamais reporter dans une présentation ou une candidature une date d'épuisement
calculée sur une consommation estimée sans le dire.**

## Ce qui manque aujourd'hui

**Ne pas maintenir cette liste ici.** Elle vit dans [`admin/todo.md`](../../../admin/todo.md), qui
est aussi ce qu'affiche le tableau de bord : une ligne par chose à faire, avec qui s'en occupe et ce
que ça débloque. La relire avant de répondre à « où on en est ».

Les pièces qui manquent (statuts, factures, conventions, relevés) sont listées à part dans
[`docs/documents-a-rassembler.md`](../../../docs/documents-a-rassembler.md).
