// The words on the slides, read against the writing rules at build.
//
// Each rule is a pattern or a count over the deck's own text, so it warns and never stops the
// build: a name, a quoted phrase or a deliberate contrast can trip one, and a person decides. The
// rules are the playbook's (source/formats/deck.md ▸ Content rules) and the brand's voice
// (voice.md ▸ AI tics). The words to avoid are read from that voice.md, so the list the owner
// edits is the list the build applies. Someone else's words (a Quote) are evidence of what they said,
// so they are left out, with notes, sources and image paths.

import { plain, words, baseLang } from './text.mjs';

export const LIMITS = { titleWords: 12, paragraphWords: 40 };

/** Props that hold no copy: paths, settings, the speaker's notes, the footer's source. */
export const NOT_COPY = ['notes', 'source', 'src', 'mark', 'image', 'photo', 'icon', 'id', 'url', 'email', 'phone', 'chapter', 'ground', 'tone', 'size', 'look', 'fit', 'ratio', 'align', 'focus', 'caption'];
const EVIDENCE = new Set(['Quote']);

/** Every string a slide shows, with the component it sits in. */
function copyOf(node, out = [], inside = node.name) {
  if (node.type === 'text') { out.push({ text: node.text, in: inside }); return out; }
  if (EVIDENCE.has(node.name)) return out;
  const walk = (v, key) => {
    if (NOT_COPY.includes(key)) return;
    if (typeof v === 'string') out.push({ text: v, in: node.name, key });
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  for (const [k, v] of Object.entries(node.props || {})) walk(v, k);
  for (const c of node.children || []) copyOf(c, out, c.name || node.name);
  return out;
}

/** Paragraphs: a text splits on blank lines, and each "- " line of a list is one. */
const paragraphs = (s) => String(s).split(/\n\s*\n/).flatMap((p) => {
  const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length && lines.every((l) => /^[-•] /.test(l)) ? lines.map((l) => l.slice(2)) : [lines.join(' ')];
}).map(plain).filter(Boolean);

/**
 * The words a voice.md says to avoid: its bold "Words to avoid." paragraph, split on commas. An
 * entry that carries a qualifier ("landscape (as an abstract noun)") needs a reader, so it is left
 * to one.
 */
export function wordsToAvoid(md) {
  const m = String(md).match(/\*\*(?:Words to avoid|Mots à éviter)\.?\*\*([\s\S]*?)(?:\*\*|\n\s*\n)/i);
  if (!m) return [];
  return m[1].replace(/\.\s*$/, '').split(',').flatMap((item) => {
    const it = item.trim().replace(/^(?:and|et)\s+/i, '');
    if (/\(/.test(it)) return [];
    return it.split('/').map((w) => w.trim()).filter((w) => /^[\p{L}-]+$/u.test(w));
  }).map((w) => w.toLowerCase());
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const avoidRe = (list) => (list.length ? new RegExp(`(?<!\\p{L})(${list.map((w) => [w, w.replace(/e$/, '')].map(escRe).join('|')).join('|')})(?:s|es|d|ed|ing|ly|ment|ments)?(?!\\p{L})`, 'giu') : null);

// The tells of voice.md that a pattern finds without a reader. Triads, even weighting and the rest
// need one: they are in the playbook's last look.
const TELLS = [
  { lang: 'en', re: /(?<!\p{L})(?:not (?:just|only|merely)|isn['’]?t (?:just |only )?about|it['’]s not about)(?!\p{L})/iu, hint: 'the antithesis ("not just X, it\'s Y"): say the thing you mean' },
  { lang: 'fr', re: /(?<!\p{L})(?:pas (?:seulement|simplement|juste)|ce n['’]est pas qu['’]une?)(?!\p{L})/iu, hint: 'the antithesis ("pas seulement X, c\'est Y"): say the thing you mean' },
  { lang: 'en', re: /(?<!\p{L})(?:let['’]?s dive in|here['’]s (?:what|why|how|the thing)|let['’]?s be clear|make no mistake|to be honest|in today['’]s)(?!\p{L})/iu, hint: 'signposting or announced candour: do the thing instead of announcing it' },
  { lang: 'en', re: /(?<!\p{L})(?:a testament to|a pivotal moment|evolving landscape|underscores? the importance|serves as|stands as)(?!\p{L})/iu, hint: 'inflated significance: state what happened, and use "is"' },
  { re: /(?:^|[.!?]\s+)[\p{L}'’-]+(?:\s[\p{L}'’-]+)?\s?\?\s+\p{Lu}/u, hint: 'a one-word question answered by a fragment ("The result? A…"): write one sentence' },
];

/** What a figure is counted in: its value without digits, signs or magnitude ("€2.1M" → "€"). */
export const unitOf = (value) => {
  const u = String(value).toLowerCase().replace(/[\d\s\u00a0\u202f.,+\-−–~≈<>]/g, '');
  const bare = u.replace(/^(?:k|m|md|bn|b)(?=\p{Sc})|(?<=\p{Sc})(?:k|m|md|bn|b)$/u, '');
  return /^(?:k|m|bn|b)$/.test(bare) ? '' : bare;
};

// Said twice: two sentences on two slides that share most of their content words.
const STOP = new Set(('a an and are as at be by for from has have in is it its of on or our that the their this to was we were will with you your '
  + 'au aux avec ce ces dans de des du elle en est et il ils la le les leur leurs mais nous ou par pas pour qui que sa se ses son sont sur un une vous').split(' '));
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const stems = (s) => (fold(s).replace(/[’']/g, ' ').match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.slice(0, 6));
const sentences = (s) => s.split(/(?<=[.!?;:])\s+/).map((x) => x.trim()).filter((x) => words(x) >= 5);

/**
 * slides: the parsed slide nodes; info: what render measured for each ({ n, kind, title, chapter }).
 * Returns warnings, each naming its slide.
 */
export function copyWarnings(slides, info, { lang = 'en', avoid = [] } = {}) {
  const base = baseLang(lang);
  const out = [];
  const at = (s) => `slide ${s.n} “${s.title}”`;
  const avoidMatch = avoidRe(avoid);
  const tells = TELLS.filter((t) => !t.lang || t.lang === base);
  const units = [];
  const kickers = new Map();

  slides.forEach((node, i) => {
    const s = info[i];
    if (!s || node.type !== 'el') return;
    const p = node.props || {};
    const title = typeof p.title === 'string' ? plain(p.title) : '';
    if (title && node.name !== 'Statement') {
      if (/[^.]\.$/.test(title)) out.push(`${at(s)}: a title is a label, drop its closing full stop`);
      if (words(title) > LIMITS.titleWords) out.push(`${at(s)}: ${words(title)} words in the title (over ${LIMITS.titleWords}): a title names what the slide shows, the slide makes the point`);
      if (/^\d+[.)]\s/.test(title)) out.push(`${at(s)}: a numbered title tells a sequence that one Steps or Agenda shows better`);
      if (/[—–]/.test(title)) out.push(`${at(s)}: a dash in a title splits it in two: keep the label, move the rest to the lead`);
      if (/,/.test(title) && !/,[^,]+\s(?:and|or|et|ou|und|y|e)\s/i.test(title)) out.push(`${at(s)}: a comma in a title outside a list (“A, B and C”) is an apposition: keep the label, move the rest to the lead`);
    }
    if (node.name === 'Slide' && p.kicker) {
      const first = kickers.get(s.chapter);
      if (first) out.push(`${at(s)}: a kicker inside a part (slide ${first} opens it): the line above a title opens a section, it does not label each slide`);
      else kickers.set(s.chapter, s.n);
    }

    const copy = copyOf(node);
    for (const c of copy) {
      for (const para of paragraphs(c.text)) {
        if (words(para) > LIMITS.paragraphWords) out.push(`${at(s)}: a ${words(para)}-word paragraph (over ${LIMITS.paragraphWords}): a table, a figure or two short lines carry it better (“${para.slice(0, 60)}…”)`);
        for (const t of tells) { const m = para.match(t.re); if (m) out.push(`${at(s)}: ${t.hint} (“${m[0].trim()}”)`); }
        if (avoidMatch) for (const m of new Set([...para.matchAll(avoidMatch)].map((x) => x[0].toLowerCase()))) out.push(`${at(s)}: “${m}” is on the voice's list of words to avoid`);
        for (const sentence of sentences(para)) units.push({ n: s.n, s, text: sentence, set: new Set(stems(sentence)) });
      }
    }

    // Figures side by side compare: one unit, or one question. Counted in three units, they don't.
    const walkStats = (n) => {
      if (n.type !== 'el') return;
      if (n.name === 'Stats' && Array.isArray(n.props?.items)) {
        const found = [...new Set(n.props.items.map((it) => (it && typeof it === 'object' ? unitOf(it.value ?? '') : null)).filter((u) => u !== null))];
        if (found.length > 1) out.push(`${at(s)}: the figures side by side are counted in ${found.map((u) => (u ? `“${u}”` : 'plain numbers')).join(', ')}: figures in a row need a common unit or a common question; keep the one that carries the slide`);
      }
      (n.children || []).forEach(walkStats);
    };
    walkStats(node);
  });

  const last = info[info.length - 1];
  if (last && /^(?:thank you|thanks|merci|danke|gracias|grazie)\b/i.test(last.title)) {
    out.push(`${at(last)}: the deck closes on a thank-you: end on the next step (or on questions, for an internal deck)`);
  }

  // The same thing said on two slides. Identical strings are left out: an Agenda repeated to open
  // each part, a footer, a label are repeated on purpose.
  const pairs = [];
  for (let a = 0; a < units.length; a++) {
    for (let b = a + 1; b < units.length; b++) {
      const A = units[a], B = units[b];
      if (A.n === B.n || A.set.size < 4 || B.set.size < 4 || fold(A.text) === fold(B.text)) continue;
      let inter = 0;
      A.set.forEach((t) => { if (B.set.has(t)) inter++; });
      if (inter >= 4 && (inter / (A.set.size + B.set.size - inter) >= 0.4 || inter / Math.min(A.set.size, B.set.size) >= 0.7)) pairs.push([A, B]);
    }
  }
  for (const [A, B] of pairs.slice(0, 5)) out.push(`${at(B.s)}: says again what slide ${A.n} says (“${A.text.slice(0, 50)}…” / “${B.text.slice(0, 50)}…”): keep the one with the evidence`);
  return out;
}
