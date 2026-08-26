#!/usr/bin/env node
// Rend un brouillon de courrier en HTML fait pour être copié-collé dans un client mail.
//
//   node scripts/courrier-html.mjs admin/courriers/<date>-<sujet>.md
//
// Deux contraintes gouvernent ce fichier.
//
// **1. Aucun style dans le corps du courrier.**
// Un navigateur copie les styles calculés, donc une police posée sur `body` se retrouve en
// attribut inline dans le mail — et ça se voit, ça fait « collé depuis ailleurs ». En
// n'utilisant que des balises sémantiques nues (p, strong, em, ul, li), le collage prend la
// police par défaut de Gmail et rien ne trahit son origine.
//
// Le seul bloc stylé est le mode d'emploi, qui est **hors de la zone à copier**.
//
// **2. Aucune vraie liste à puces : des tirets, et des paragraphes.** Constaté par Paul le
// 25 août 2026 : une liste collée dans un client mail y arrive en tableau imbriqué, avec des
// cellules et des marges qui ne ressemblent à rien. Ça vaut des deux côtés de la paire, parce
// qu'on ne sait pas ce qui sera copié : la page HTML ou l'aperçu rendu du markdown.
//
// Donc, des deux côtés, un tiret et un paragraphe. Ici on n'émet ni `<ul>` ni `<li>`. Et dans
// le `.md`, les puces s'écrivent avec un tiret demi-cadratin « – » : c'est un tiret, mais
// aucun moteur markdown n'en fait une liste, donc l'aperçu rendu se colle comme le texte brut.
// Le tiret ASCII « - » reste accepté en entrée, pour les courriers déjà écrits.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const source = process.argv[2];
if (!source || !existsSync(source) || !source.endsWith('.md')) {
  console.error('\n✘ Usage : node scripts/courrier-html.mjs <courrier.md>\n');
  process.exit(1);
}

const brut = readFileSync(source, 'utf8');

// L'objet du mail, s'il est déclaré dans l'en-tête du brouillon.
const objet = (brut.match(/^\*\*Objet\s*:\*\*\s*(.+)$/m) ?? [])[1]?.trim() ?? '';

// Le corps commence après la ligne de séparation `---`. Ce qui précède est de la consigne
// interne (le style à tenir, comment envoyer) et n'a rien à faire dans le mail.
const i = brut.indexOf('\n---\n');
if (i < 0) {
  console.error("\n✘ Pas de ligne `---` : impossible de savoir où commence le courrier.\n");
  process.exit(1);
}
const corps = brut.slice(i + 5).trim();

const echapper = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const enligne = (t) => echapper(t)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(?<![\w*])\*([^*\n]+)\*/g, '<em>$1</em>')
  .replace(/`([^`]+)`/g, '$1')                       // le code n'a pas de sens dans un mail
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  // Une URL nue devient cliquable. Gmail le ferait au collage, mais pas tous les clients,
  // et un lien explicite ne coûte rien puisqu'il ne porte aucun style.
  .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>')
  // Le jeton \u0001 marque un saut de ligne voulu dans une puce (voir plus bas) : il est posé
  // avant l'échappement pour ne pas être avalé, et rendu en <br> tout à la fin.
  .replace(/\u0001/g, '<br>');

const blocs = [];
let puces = [];
let para = [];
const viderPuces = () => {
  if (!puces.length) return;
  // Un tiret et une espace, dans un paragraphe ordinaire. Pas de <ul> : voir l'entête.
  for (const x of puces) blocs.push(`<p>\u2013 ${enligne(x)}</p>`);
  puces = [];
};
const viderPara = () => {
  if (!para.length) return;
  blocs.push('<p>' + enligne(para.join(' ')) + '</p>');
  para = [];
};

for (const ligne of corps.split('\n')) {
  if (/^\s*[-\u2013]\s+/.test(ligne)) {
    viderPara();
    puces.push(ligne.replace(/^\s*[-\u2013]\s+/, '').trim());
  } else if (/^\s{2,}\S/.test(ligne) && puces.length) {
    // Un long lien sur sa propre ligne y reste : collé au libellé, il devient illisible.
    const separateur = /^\s*https?:\/\//.test(ligne) ? ' \u0001 ' : ' ';
    puces[puces.length - 1] += separateur + ligne.trim();
  } else if (/^\s{2,}\S/.test(ligne) && para.length) {
    para.push(ligne.trim());
  } else if (!ligne.trim()) {
    viderPuces(); viderPara();
  } else {
    viderPuces();
    para.push(ligne.trim());
  }
}
viderPuces(); viderPara();

const sortie = source.replace(/\.md$/, '.html');
writeFileSync(sortie, `<!doctype html>
<meta charset="utf-8">
<title>${echapper(objet || 'Courrier')}</title>

<!-- AUCUN STYLE, nulle part. Ni police, ni taille, ni couleur, ni fond. Trois raisons :
     · un navigateur copie les styles calculés, donc tout ce qui est posé ici finit en
       attribut inline dans le mail, et ça se voit ;
     · une couleur de texte ou de fond casse l'affichage de qui lit en thème sombre ;
     · une taille de titre imposée jure avec la mise en page du client mail.
     Le mail doit ressembler à un mail écrit dans le client, pas à un collage. -->

<p><em>À copier : tout ce qui suit le trait.</em>${objet ? `<br><em>Objet : ${echapper(objet)}</em>` : ''}</p>

<hr>

${blocs.join('\n\n')}
`);

console.log(`✓ ${sortie}
  ${blocs.length} blocs, dont ${blocs.filter((b) => b.startsWith('<p>\u2013 ')).length} ligne(s) à tiret.
  Aucun style, aucune liste : le collage prendra la police du client mail, et les tirets
  arriveront tels quels au lieu de se transformer en tableau.`);
