# association-fr

Ce qu'une petite association passe son temps à faire à la main : encaisser des adhésions et des
dons, en tirer des reçus fiscaux, relancer ceux dont l'adhésion expire, et produire des courriers
et des visuels qui se ressemblent d'une fois sur l'autre.

Extrait d'une association qui le faisait tourner depuis plusieurs mois. **Ce qui a rendu
l'extraction possible tient en peu de choses** : quatre valeurs codées en dur dans deux fichiers.
Tout le reste était déjà générique, ce qui est le signe qu'un outil a été écrit pour le problème et
pas pour l'organisation.

## Installer

1. Copier `packs/association-fr/` dans votre projet.
2. `cp settings.example.json settings.json`, puis remplir. Le pack refuse de tourner sur des
   valeurs par défaut : il ne peut pas deviner votre association, et se tromper d'organisation sur
   un reçu fiscal n'est pas une erreur rattrapable.
3. Pour HelloAsso, `scripts/setup-helloasso.sh` guide la création des identifiants. Ils ne vont
   jamais dans `settings.json` — ce sont des secrets, ils vivent dans votre environnement.

## Ce que ça ne fait pas

Ça ne tient pas votre comptabilité et ça ne remplace pas un expert-comptable. Ça enlève la saisie
répétitive autour d'elle, ce qui est différent et suffisant.
