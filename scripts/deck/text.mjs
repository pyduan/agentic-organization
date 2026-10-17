// Text on a slide: escaped first, then three marks, then the typography of the deck's language.
//
// *word* is the accent (the word a title turns on), **words** are bold, `name` is code. Nothing
// else: a deck that needs a fourth mark needs a component. Typography runs on every text the
// components print, props and children alike. An earlier engine applied it to some props and not
// to others, so a colon could fall alone at the start of a line on one slide and not on the next.

const NB = '\u00a0';
const NNB = '\u202f';

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The deck's language, from its frontmatter: "fr-CA" reads as "fr". English when it says none. */
export const baseLang = (lang) => String(lang || 'en').toLowerCase().split(/[-_]/)[0];

// Units kept on the line of their number: symbols, the same in every language, then the words of
// the languages whose typography wants it. A unit missing here only loses its non-breaking space.
const UNIT_SYMBOLS = ['%', '‰', '°C', '°', '€', 'k€', 'M€', 'Md€', '\\$', '£', 'km', 'm', 'kg', 'h', 'min'];
const UNIT_WORDS = { fr: ['j', 'jours?', 'semaines?', 'mois', 'ans?'] };

/**
 * Curly apostrophes in every language. French also takes a non-breaking space before : ; ? ! »,
 * inside « », between the groups of a large number, and between a number and its unit.
 */
export function typo(s, lang = 'en') {
  const out = String(s).replace(/'/g, '’');
  if (baseLang(lang) !== 'fr') return out;
  const units = new RegExp(`(\\d) (${[...UNIT_SYMBOLS, ...UNIT_WORDS.fr].join('|')})(?![\\p{L}\\d])`, 'gu');
  return out
    .replace(/ ([:;?!»])/g, `${NB}$1`)
    .replace(/« /g, `«${NB}`)
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NNB}`)
    .replace(units, `$1${NB}$2`);
}

/** Inline marks. Code spans are cut out first, so nothing inside them is typeset or marked. */
export function md(s, lang = 'en') {
  const parts = String(s ?? '').split(/(`[^`]+`)/g);
  return parts.map((p, i) => {
    if (i % 2) return `<code>${esc(p.slice(1, -1))}</code>`;
    return typo(esc(p), lang)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }).join('');
}

/** The words of a text without its marks: for titles in the outline, and for counting. */
export const plain = (s) => String(s ?? '').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();

export const words = (s) => plain(s).split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
