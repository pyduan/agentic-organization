#!/usr/bin/env bash
# Enregistre les identifiants de l'API HelloAsso comme secrets du Worker d'administration.
#
# Pourquoi ce script existe : pour que le secret aille de votre presse-papier à Cloudflare
# sans passer par le dépôt, ni par une conversation, ni par le disque. Rien n'est écrit ici.
#
# Où trouver les identifiants : HelloAsso → votre association → Intégrations → API.
# Vous y créez un client et vous obtenez un « client id » et un « client secret ».
#
# Usage :  ./scripts/setup-helloasso.sh          (depuis n'importe où)
set -euo pipefail

# Le dossier est déduit de la position du script, pas du répertoire courant : on peut donc
# le lancer par son chemin absolu depuis n'importe où, y compris hors du dépôt.
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ICI/../apps/admin"

echo
echo "Identifiants de l'API HelloAsso → secrets du Worker admin.huguescharnallet.org"
echo "Rien n'est enregistré sur cet ordinateur ni dans le dépôt."
echo

read -r -p  "Client ID     : " HA_ID
read -r -s -p "Client secret : " HA_SECRET
echo
echo

if [ -z "$HA_ID" ] || [ -z "$HA_SECRET" ]; then
  echo "✘ Un des deux champs est vide. Rien n'a été enregistré."
  exit 1
fi

printf '%s' "$HA_ID"     | npx wrangler secret put HELLOASSO_CLIENT_ID
printf '%s' "$HA_SECRET" | npx wrangler secret put HELLOASSO_CLIENT_SECRET

unset HA_ID HA_SECRET

echo
echo "✓ Enregistrés. Le tableau de bord peut maintenant interroger HelloAsso directement,"
echo "  pour toutes les personnes autorisées, sans qu'aucune d'elles n'ait le secret."
echo
echo "  Vérifier : ouvrir https://admin.huguescharnallet.org, onglet Cotisations,"
echo "             puis « Actualiser depuis HelloAsso »."
echo "  Voir aussi : docs/donnees.md"
