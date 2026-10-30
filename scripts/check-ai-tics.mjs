#!/usr/bin/env node
/**
 * check-ai-tics.mjs: does this read as machine-written?
 *
 * Ported from the checker the kit's author runs on his own organizations' decks and pages. It
 * reads this kit's decks as the slides they render (deckToMarkup, through scripts/deck/parse.mjs).
 * The guide is `source/brand/voice.md` ▸ AI tics, and the words that guide lists are read from it,
 * so a word the owner adds there is checked here the next run.
 *
 * Why this exists (2026-09-10). The tells were written down in a voice guide and
 * kept shipping anyway, because a paragraph telling the next author to read a guide
 * fails the same way the guide did. This reads any text we are about to hand over.
 *
 * Two tiers, on purpose:
 *   tell: mechanical and high-confidence. Nearly always an edit. `--strict` exits 1
 *         on this tier.
 *   look: a measurement that needs judgement (title length, a repeated sentence, a
 *         comma-heavy one), and punctuation (em dash, middot), which this kit's
 *         guide leaves to each company. Reported, never a failure on its own.
 *
 * Usage:
 *   node scripts/check-ai-tics.mjs <file|dir> [...]     .md, .html, .astro, .txt, and a deck.mdx
 *                                                       read as the slides it renders
 *   node scripts/check-ai-tics.mjs --stdin              a draft that is not on disk yet
 *   node scripts/check-ai-tics.mjs --mode slide <path>  adds the slide measurements
 *   node scripts/check-ai-tics.mjs --strict <path>      exit 1 on the `tell` tier
 *   node scripts/check-ai-tics.mjs --json <path>
 *   node scripts/check-ai-tics.mjs --self-test          prove the rules still fire
 *
 * Slide mode reads <h2> titles and <p>/<li> paragraphs and applies the numbers
 * measured on decks the kit's author signed off.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { parseDeck } from './deck/parse.mjs'
import { wordsToAvoid } from './deck/copy.mjs'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const has = (n) => argv.includes(`--${n}`)
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const JSON_OUT = has('json')
const STRICT = has('strict')
const SELF_TEST = has('self-test')
const MODE = flag('mode', 'auto')
const paths = argv.filter((a) => !a.startsWith('--') && a !== MODE)

const TELL = 'tell'
const LOOK = 'look'

// ── what counts as copy ──────────────────────────────────────────────────────
// A quotation is evidence, not copy. The
// peek bodies, file cards, code blocks and blockquotes show someone else's text
// verbatim, so re-punctuating them to get a green run would be falsifying a
// source. Frontmatter and HTML comments are not read by anyone the rules protect.
const stripNonCopy = (s) =>
  s
    .replace(/^---\n[\s\S]*?\n---\n/, ' ')
    .replace(/<div class="peek-body"[^>]*>[\s\S]*?<\/div>/gi, ' ')
    .replace(/<div class="md-card"[^>]*>[\s\S]*?<\/div>/gi, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^>.*$/gm, ' ')

const stripTags = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&[a-z]+;/gi, ' ')

const stripMd = (s) =>
  s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*|__|\*|_/g, '')

// A markdown list item, table cell, heading or paragraph is a unit of its own, as a block tag is
// on a page. Flattened, a twelve-row table reads as one sentence with twenty commas: that is
// what the first run over a consulting folder reported on nearly every document (2026-10-07).
// ¶ marks a boundary for measure() without touching the text the rules read.
const mdBlocks = (s) =>
  squash(
    stripMd(
      s
        .replace(/\|/g, ' ¶ ')
        .replace(/\n\s*\n/g, ' ¶\n')
        .replace(/\n(?=\s{0,3}(?:#{1,6}\s|[-*+]\s|\d+\.\s|:::))/g, ' ¶\n')
    )
  )

const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0)
// Our pages are typeset with ’ and every French pattern below is written with '.
// Without this line the French half of the rule set silently never fires on a built
// deck, which is how a two-sentence antithesis sat unreported on a deck we had just
// swept (2026-09-10). Same family as the scripted edit that missed on a curly
// apostrophe, in CLAUDE.md.
const squash = (s) => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()

// ── the rules ────────────────────────────────────────────────────────────────
// Each entry: [id, tier, RegExp, hint]. Deliberately narrow. A list that cries
// wolf is a list nobody reads, and the one thing that would kill this check is an
// author learning to scroll past it.

const RULES = [
  // 2026-09-04, a correction in as many words: "évite les constructions de phrase
  // en mode 'en une phrase, en un paragraphe, en X points' qui font trop IA". The
  // count promises brevity instead of delivering it.
  // The tell is a heading or a lead FRAMING what follows by its length. Describing
  // something that happened in one sentence is not it: "un back-office demandé en
  // une phrase" is a fact about a request, and flagging it made the check wrong on
  // its first real run over a deck about this method.
  [
    'counted-framing',
    TELL,
    /(?:^|[.!?:;]\s+|\b(?:l'argument|le point|la réponse|le résumé|résumé|the argument|the case|the answer|the point)[,:]?\s+|,\s*)(en (?:une|deux|trois|quatre|cinq|\d+) (?:phrases?|mots?|lignes?|points?|paragraphes?|bullets?|images?|schémas?)|in (?:one|two|three|four|five|\d+) (?:sentences?|words?|lines?|points?|bullets?|paragraphs?|pictures?))\s*[:,.]|in a nutshell/gi,
    'a count promising brevity instead of delivering it: say the thing',
  ],
  [
    'counted-summary',
    TELL,
    /\b(voici les \d+|voici \d+ |here are the \d+|here are \d+ |les \d+ (?:raisons|points|choses|étapes) (?:pour|qui|à)|the \d+ (?:reasons|things|steps) (?:why|to))\b/gi,
    'the list is right there, the count adds nothing and goes false when the list moves',
  ],
  [
    'announced-candour',
    TELL,
    /\b(soyons clairs?|il faut le dire|en toute transparence|disons-le|avouons-le|pour être (?:honnête|franc)|let'?s be clear|here'?s the thing|to be honest|truth be told)\b/gi,
    'honesty that announces itself is a performance of it',
  ],
  [
    'escalated-antithesis',
    TELL,
    /(ce n'est pas (?:un|une|juste|seulement|simplement)[^,.;]{2,45}[,.] ?c'est|(?:(?:is|'s|are|'re) not|isn't|aren't) (?:just |only |simply )?(?:a|an|about)\b[^,.;—]{2,45}(?:[,.]|\s?—) ?(?:it|they|this)(?:'s|'re| is| are)|non pas parce que[^,.;]{2,45}, mais parce que|not because[^,.;]{2,45}, but because)/gi,
    'the unearned contrast: it raises the volume without showing why one is the opposite of the other',
  ],
  [
    'trailing-coda',
    TELL,
    /,\s*(tout simplement|sans effort|à chaque fois|et ça marche|point final|ailleurs|partout|ensemble|désormais|every time|effortlessly|and it works|plain and simple|elsewhere|everywhere|together)\s*[.!]/gi,
    'a finished sentence, then a word or two for punch: delete the coda',
  ],
  [
    'participle-coda',
    TELL,
    /,\s*(soulignant|illustrant ainsi|garantissant ainsi|reflétant|permettant ainsi|témoignant|highlighting|underscoring|ensuring|reflecting|fostering|showcasing)\b/gi,
    'a participle glued on for depth: give the thought its own sentence, or cut it',
  ],
  [
    'signposting',
    TELL,
    /\b(plongeons|entrons dans le vif|voici ce qu'il faut (?:savoir|retenir)|dans cette (?:section|partie), nous|let'?s dive in|here'?s what you need to know|now let'?s look at|in this section, we)\b/gi,
    'do the thing instead of announcing it',
  ],
  [
    'carrying-coda',
    TELL,
    /\b(et c'est (?:ce qu'il faut retenir|là l'essentiel|le point à retenir)|c'est la ligne à retenir|and (?:this|that) is the (?:one to remember|part worth carrying)|the line to plant)\b/gi,
    'telling the reader which sentence matters admits the rest did not',
  ],
  [
    'chatbot-residue',
    TELL,
    /\b(j'espère que (?:cela|ça) (?:vous )?(?:aide|aidera)|n'hésitez pas à me (?:dire|demander)|voulez-vous que je|souhaitez-vous que je|would you like me to|i hope this helps|let me know if you|as of my last update|voici un(?:e)? (?:proposition|version) (?:de|du|pour)) /gi,
    'nothing from a conversation with an assistant survives into copy',
  ],
  [
    'snowclone',
    TELL,
    /\b((?:\w+), meet (?:\w+)|est le nouveau \w+|is the new \w+|ce n'est pas un bug, c'est une fonctionnalité)\b/gi,
    'a template with the nouns swapped reads as a template',
  ],
  // A partner deck, 2026-09-01. The cover read "Rencontre de présentation.
  // Aucune demande dans ces pages, une proposition de premier cas d'usage à la
  // fin." The review: "ça try too hard de se justifier, ça ressemble à du monologue
  // interne". Copy that narrates the document's own construction is the editorial
  // note that escaped into the deliverable.
  [
    'meta-commentary',
    TELL,
    /\b(dans ces pages|dans ce document, nous ne|ce (?:document|deck|support) ne (?:prétend|vise|cherche) pas|nous ne (?:détaillons|traitons|abordons) pas ici|cette (?:slide|page) (?:montre|présente|vise à)|aucune demande (?:dans|ici)|this (?:deck|document) does not (?:claim|aim)|this slide shows|no ask in these pages)\b/gi,
    'the deliverable is narrating its own construction: that note belongs in the source comment, not on the page',
  ],
  [
    'self-justification',
    TELL,
    /\b(autant qu'(?:elle|il|cela) profite|faute de mieux|à défaut d'autre chose|nous avons choisi de ne pas|par souci de (?:concision|clarté)|for the sake of brevity|we chose not to include)\b/gi,
    'matter of fact: state what is, do not justify what is not there',
  ],
  [
    'banned-word',
    TELL,
    /\b(delve|crucial|pivotal|showcase|testament|vibrant|tapestry|foster(?:s|ing)?|elevate|empower|unlock|supercharge|seamless|streamline|robust|dynamiser|révolutionner|sublimer|propulser|véritablement|réellement)\b/gi,
    'a word from the list of AI tics (source/brand/voice.md ▸ AI tics)',
  ],
  // 2026-10-08, on « Prix : rien n'est chiffré » in a recap: « suffit de dire "en cours de
  // chiffrage", plus neutre ». A status said as what is missing reads as a lack.
  [
    'absence-status',
    TELL,
    /(?<!\p{L})(rien n['’]est (?:encore |pour l['’]instant |pour le moment )?(?:chiffré|signé|décidé|fixé|acté|validé|arrêté|engagé|calé|prévu)|sans chiffrage|nothing (?:is|has been) (?:signed|priced|decided|agreed)(?: yet)?)(?!\p{L})/giu,
    'say where it stands: « en cours de chiffrage », « signature en cours », « date à fixer »',
  ],
  // Punctuation is a look here, not a tell: each organization decides its own. One that bans the
  // em dash moves these two back to TELL in its copy of this file.
  ['em-dash', LOOK, /—/g, 'an em dash: a comma, a colon or parentheses read as written by a person'],
  ['middot', LOOK, / · /g, 'a middot as a separator: comma or colon'],
  // `\b` in JS is ASCII-only, so a trailing one after an accented letter never
  // matches: "monitoré" needs a Unicode letter lookaround instead. The self-test
  // caught this on its first run, which is what the self-test is for.
  [
    'calque',
    LOOK,
    /(?<!\p{L})(pied par pied|monitor(?:é|ée|és|ées|er|ing)|IA-first|leapfrogg?(?:er|é|ing)|adresser (?:un|le|les|ce|cette|la) (?:problème|besoin|enjeu|sujet|question|défi)|impact(?:er|é|ée|és|ées|ant|ante))(?!\p{L})/giu,
    'French written from English: suivi, IA-natif, sauter des étapes, traiter, peser sur',
  ],
  // The one-word question: "Le résultat ? Une plateforme qui…". A question mark
  // standing in for a colon, answered by a fragment.
  [
    'one-word-question',
    LOOK,
    /(^|[.!?]\s)((?:[A-ZÉÀÇ][\p{L}'’-]*\s+){0,3}[\p{L}'’-]+)\s?\?\s+[A-ZÉÀÇ]/gu,
    'a question mark standing in for a colon, answered by a fragment',
  ],
  // The slogan triad: three items of equal weight because three sounded right.
  [
    'triad',
    LOOK,
    /(^|[.!?:]\s)([\p{L}'’-]+),\s([\p{L}'’-]+)\set\s([\p{L}'’-]+)\s*[.!]/gu,
    'three items because three sounded right: two, four, or one',
  ],
]

// The owner's own list: the words source/brand/voice.md says to avoid, read on every run, so the
// guide and the check never disagree. A word with a qualifier in the guide is left to a reader.
// AI_TICS_VOICE points at another voice guide, for a copy of this file that lives in a repo without
// one (the company pack's intranet reads the central repo's).
const VOICE = process.env.AI_TICS_VOICE || resolve(dirname(fileURLToPath(import.meta.url)), '..', 'source', 'brand', 'voice.md')
const OWN = existsSync(VOICE) ? wordsToAvoid(readFileSync(VOICE, 'utf8')).filter((w) => /^[\p{L}' -]+$/u.test(w)) : []
if (OWN.length) {
  RULES.push(['voice-word', TELL, new RegExp(`(?<!\\p{L})(${OWN.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?!\\p{L})`, 'giu'), 'a word source/brand/voice.md says to avoid'])
}

// ── measurements that need a judgement ───────────────────────────────────────
// The numbers come from decks the kit's author signed off, measured 2026-09-10 on
// their built pages.

const MAX_TITLE_WORDS = 12 // median across the reviewed decks is 6 to 9
const MAX_PARA_WORDS = 40 // median longest paragraph per slide is 13 to 28
const MAX_COMMAS = 4 // "évite les propositions en incise" (2026-09-04)
// The same tic at deck scale, where the sentence threshold above cannot reach it: a title is five
// words, so it never approaches four commas in twenty-five. One title with a comma tail is a
// title; half a deck of them is the default shape (2026-09-14: "c'est ok d'en avoir un peu mais
// faut juste pas en avoir trop"). The threshold is set by the case that produced the rule,
// a deck at 8 of 15, and measured against the portfolio the same day: across the 24 built decks
// carrying six titles or more, the share runs 0% to 70% with a median near 43%, so this names the
// decks that have gone past the house habit rather than the house habit itself.
const MAX_COMMA_TITLE_SHARE = 0.5
const MIN_TITLES_FOR_SHARE = 6 // under six, one title moves the share too far to mean anything
const MIN_DUP_WORDS = 8

function measure(text, { slide }) {
  const found = []
  // Which units to measure. On a slide, the leaf paragraphs and titles ARE the
  // units: measuring the flattened slide instead reads a five-row table as one
  // sentence with nine commas, which is how the first real run reported the
  // reference deck. In prose, sentences.
  const sentences = slide
    ? [...slide.paras, ...slide.titles]
    : text.split(/(?<=[.!?])\s+(?=[A-ZÉÀÇ«"])|\s*¶\s*/)

  for (const s of sentences) {
    // Commas inside parentheses or between the members of a list are not insets:
    // "NHS productivity (Department of Health and Social Care), compute efficiency"
    // is an enumeration, and counting it made the check wrong on the veille runs.
    const commas = (s.replace(/\([^)]*\)/g, '').match(/,/g) || []).length
    if (commas >= MAX_COMMAS && words(s) >= 25)
      found.push({
        rule: 'incise-overload',
        tier: LOOK,
        hint: `${commas} commas in one sentence: split it, or cut the insets`,
        sample: squash(s).slice(0, 160),
      })
  }

  // Saying the same thing twice is the "doublon" every long deck gets flagged for.
  const seen = new Map()
  for (const s of sentences) {
    const key = squash(s)
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, '')
    if (words(key) < MIN_DUP_WORDS) continue
    if (seen.has(key))
      found.push({
        rule: 'repeated-sentence',
        tier: LOOK,
        hint: 'the same information twice: keep the one that lands, cut the other',
        sample: squash(s).slice(0, 160),
      })
    else seen.set(key, true)
  }

  if (!slide) return found

  for (const t of slide.titles) {
    // A title is a label, not a sentence (2026-09-11). An internal period is
    // fine, so this looks only at the last character: "Trois façons de faire. Un
    // seul paquet complet" keeps its turn and loses only the closing dot.
    if (/\.$/.test(t.replace(/\s+$/, '')))
      found.push({
        rule: 'title-end-dot',
        tier: TELL,
        hint: 'a slide title is a label, not a sentence: drop the closing period',
        sample: t,
      })
    if (words(t) > MAX_TITLE_WORDS)
      found.push({
        rule: 'long-title',
        tier: LOOK,
        hint: `${words(t)} words: our decks sit at 6 to 9, a title names its subject`,
        sample: t,
      })
    if (/[.!?]\s+\p{Lu}/u.test(t))
      found.push({
        rule: 'two-sentence-title',
        tier: LOOK,
        hint: 'does the second sentence turn, or does it flourish?',
        sample: t,
      })
  }
  // Deck-level, so it is raised once with its own count rather than on every title.
  if (slide.titles.length >= MIN_TITLES_FOR_SHARE) {
    const withComma = slide.titles.filter((t) => t.includes(','))
    if (withComma.length / slide.titles.length > MAX_COMMA_TITLE_SHARE)
      found.push({
        rule: 'comma-title-run',
        tier: LOOK,
        hint: `${withComma.length} of ${slide.titles.length} titles are a noun phrase, a comma and a tail: a few is fine, half a deck is the tic`,
        sample: withComma.slice(0, 3).join(' / '),
      })
  }
  for (const p of slide.paras) {
    if (words(p) > MAX_PARA_WORDS)
      found.push({
        rule: 'wall-of-text',
        tier: LOOK,
        hint: `${words(p)} words in one paragraph: our decks sit under ${MAX_PARA_WORDS}, make it a table, a visual or two lines`,
        sample: p.slice(0, 160),
      })
  }
  return found
}

// ── reading a file ───────────────────────────────────────────────────────────
// Bilingual pages carry both languages inline. The calque rule is French-only, so
// where the page marks its languages we read the French spans for it and the whole
// text for everything else.
function analyse(raw, { path, mode }) {
  // A .md file is markdown even when it carries `<someone@example.com>`: read as markup, an email
  // draft lost its list boundaries and came out as one sentence with twenty commas (2026-10-07).
  const isMarkup = !/\.(md|txt)$/.test(path) && /<[a-z][^>]*>/i.test(raw)
  const body = stripNonCopy(raw)
  const text = squash(isMarkup ? stripTags(body) : stripMd(body))
  // A bilingual page carries both languages inline. Drop the English twins and keep
  // the MARKUP: the block tags are what tell a table cell from a sentence further
  // down, and joining the bare span texts turned a five-row table into one sentence
  // with nine commas on the first real run.
  const hasSpans = /<span data-lang="fr">/.test(body)
  const frBody = hasSpans ? body.replace(/<span data-lang="en">[\s\S]*?<\/span>/g, ' ') : body
  const french = hasSpans ? squash(stripTags(frBody)) : text

  const found = []
  for (const [rule, tier, re, hint] of RULES) {
    const target = rule === 'calque' ? french : text
    for (const m of target.matchAll(re)) {
      const i = m.index ?? 0
      found.push({
        rule,
        tier,
        hint,
        sample: squash(target.slice(Math.max(0, i - 45), i + m[0].length + 45)),
      })
    }
  }

  const wantSlide = mode === 'slide' || (mode === 'auto' && /class="(?:dk-)?slide/.test(raw))
  let slide = null
  if (wantSlide) {
    const frOnly = (h) => stripTags(h.replace(/<span data-lang="en">[\s\S]*?<\/span>/g, ' '))
    // `<(p|li)[^>]*>` also matches `<link>`, which swallowed 45,000 characters of
    // <head> into "one paragraph" on the first real run. The space is the fix.
    // A block that contains another block is a container, not a paragraph: its
    // words belong to the children, and counting both double-counts them.
    const isLeaf = (h) => !/<(p|li|div|section|table|figure)[\s>]/i.test(h)
    slide = {
      titles: [...body.matchAll(/<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>/g)]
        .map((m) => squash(frOnly(m[1])))
        .filter(Boolean),
      paras: [...body.matchAll(/<(p|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)]
        .filter((m) => isLeaf(m[2]))
        .map((m) => squash(frOnly(m[2])))
        .filter(Boolean),
    }
  }
  // A table cell and a list item are not one sentence with nine commas: close every
  // block with a full stop before the prose measurements read it.
  const asSentences = (h) => squash(stripTags(h.replace(/<\/(p|li|td|th|h\d|div|figcaption|dt|dd)>/gi, '. ')))
  // Any markup needs its block boundaries turned into sentence ends before the
  // prose measurements run, slide or not: a page of cards flattens into one
  // 60-word "sentence" otherwise.
  found.push(...measure(isMarkup ? asSentences(frBody) : mdBlocks(body), { slide }))
  // A document gets the heading half of the slide rules too (2026-09-23): two partner
  // one-pagers came out at "0 tells" with most of their headings written as a comma tail
  // ("Trois chantiers, dans l'ordre"), because comma-title-run only looked at decks. Same
  // threshold and same floor as a deck, over h1 to h3.
  // A markdown document reads its `#` to `###` the same way.
  if (!slide) {
    const frOnly = (h) => stripTags(h.replace(/<span data-lang="en">[\s\S]*?<\/span>/g, ' '))
    const heads = (
      isMarkup
        ? [...body.matchAll(/<h([1-3])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/g)].map((m) => frOnly(m[2]))
        : [...body.matchAll(/^\s{0,3}#{1,3}\s+(.+)$/gm)].map((m) => stripMd(m[1]))
    )
      .map(squash)
      .filter(Boolean)
    if (heads.length >= MIN_TITLES_FOR_SHARE) {
      const withComma = heads.filter((t) => t.includes(','))
      if (withComma.length / heads.length > MAX_COMMA_TITLE_SHARE)
        found.push({
          rule: 'comma-title-run',
          tier: LOOK,
          hint: `${withComma.length} of ${heads.length} headings are a noun phrase, a comma and a tail: a few is fine, half a page is the tic`,
          sample: withComma.slice(0, 3).join(' / '),
        })
    }
  }
  return { path, found, slide: !!slide }
}

// ── a deck ───────────────────────────────────────────────────────────────────
// A deck.mdx keeps its copy in component props. Read as text it would come out as one slide or
// none (a reader that missed the props once read 0 tells where the built page carried 67), so it
// is parsed with the engine's own parser and rebuilt as the page it renders: one section per slide,
// the slide's title as its h2, card and group titles as h3, every other text a paragraph or a list
// item. Left out, as on a built page they are not copy or not ours: speaker notes, the chapter
// label, the source line, someone else's words in a Quote, names, logos, paths and figures.
const NOT_COPY = new Set(['notes', 'chapter', 'source', 'id', 'ground', 'src', 'image', 'photo', 'mark', 'icon', 'logos',
  'url', 'email', 'phone', 'date', 'name', 'tone', 'size', 'look', 'fit', 'ratio', 'align', 'focus', 'numbering',
  'highlight', 'cols', 'height', 'active', 'n', 'unit', 'max', 'value', 'display', 'accent', 'compact', 'frame', 'arrow', 'caption-position'])
const VERBATIM = new Set(['Quote', 'Logos'])
function deckToMarkup(raw) {
  const deck = parseDeck(raw)
  const clean = (v) => esc(String(v).replace(/[*`]/g, ''))
  const slides = deck.slides.map((node) => {
    const blocks = []
    let h2 = ''
    const walk = (v, key, inList) => {
      if (NOT_COPY.has(key) || v == null || typeof v === 'boolean' || typeof v === 'number') return
      if (typeof v === 'string') {
        if (!v.trim()) return
        if (key === 'title' || key === 'head') blocks.push(`<h3>${clean(v)}</h3>`)
        else blocks.push(inList ? `<li>${clean(v)}</li>` : `<p>${clean(v)}</p>`)
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, key, true))
      else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k, inList && k === 'text')
    }
    const visit = (n, top) => {
      if (n.type === 'text') { for (const para of n.text.split(/\n\s*\n/)) if (para.trim()) blocks.push(`<p>${clean(para.replace(/^\s*[-•]\s+/gm, ''))}</p>`); return }
      if (VERBATIM.has(n.name)) return
      for (const [k, v] of Object.entries(n.props || {})) {
        if (top && k === 'title' && typeof v === 'string') { h2 = `<h2>${clean(v)}</h2>`; continue }
        walk(v, k, false)
      }
      for (const c of n.children || []) visit(c, false)
    }
    visit(node, true)
    return `<section class="slide">${h2}${blocks.join('')}</section>`
  })
  return { markup: slides.join('\n'), bare: 0 }
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const isDeck = (path) => extname(path) === '.mdx'

// ── inputs ───────────────────────────────────────────────────────────────────
const READABLE = new Set(['.md', '.html', '.htm', '.astro', '.txt', '.mdx'])
function collect(p, out = []) {
  const st = statSync(p)
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) {
      if (e === 'node_modules' || e.startsWith('.')) continue
      collect(join(p, e), out)
    }
  } else if (READABLE.has(extname(p))) out.push(p)
  return out
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

// ── self-test: a check that has only ever been seen passing is a check that
// never looks. Every rule gets a string that must fire and one that must not.
function selfTest() {
  const cases = [
    ['counted-framing', "L'argument, en une phrase, tient debout.", 'Un back-office demandé en une phrase, et rien à saisir.'],
    // The three cases below were found by the first real sweep, over the
    // agentic-organization deck: a different anchor, a two-sentence antithesis, and
    // the typographic apostrophe that hid both.
    ['counted-framing', 'Git, en une image : puissant et illisible.', 'Un back-office demandé en une phrase.'],
    ['escalated-antithesis', "Ce n'est pas une copie des fichiers. C'est l'information extraite.", 'Un partenaire, pas un prestataire.'],
    ['escalated-antithesis', 'Ce n\u2019est pas une copie des fichiers. C\u2019est l\u2019information extraite.', 'Un partenaire, pas un prestataire.'],
    ['escalated-antithesis', "It's not just a tool, it's a partner.", 'A partner, not a vendor.'],
    ['escalated-antithesis', 'This is not about speed. It is about trust.', 'Speed matters less than trust here.'],
    ['escalated-antithesis', 'It is not just a tool \u2014 it is a partner.', 'It is a tool we keep.'],
    ['escalated-antithesis', "This isn't about speed. It's about trust.", 'Trust matters more than speed here.'],
    ['counted-summary', 'Voici les 4 sujets du jour.', 'Quatre chantiers tournent sur la même plateforme.'],
    ['announced-candour', 'Soyons clairs, le modèle ne décide jamais.', 'Le modèle ne décide jamais.'],
    [
      'escalated-antithesis',
      "Ce n'est pas une plateforme, c'est un partenaire.",
      'Un partenaire, pas un prestataire.',
    ],
    ['trailing-coda', 'Le service tient, tout simplement.', 'Le service tient.'],
    ['trailing-coda', 'Chacune de ces erreurs est arrivée en production, ailleurs.', 'Ces erreurs sont arrivées ailleurs, en production.'],
    ['participle-coda', 'Nous avons déployé quatre agents, soulignant notre avance.', 'Nous avons déployé quatre agents.'],
    ['signposting', 'Plongeons dans le détail.', 'Le détail suit.'],
    ['carrying-coda', "Le socle reste, et c'est ce qu'il faut retenir.", 'Le socle reste.'],
    ['chatbot-residue', "Voici une proposition de plan. J'espère que cela vous aidera.", 'Le plan suit.'],
    ['snowclone', 'Le RAG est le nouveau moteur de recherche.', 'Le RAG cite ses sources.'],
    ['meta-commentary', 'Aucune demande dans ces pages.', 'Nous proposons un premier périmètre.'],
    ['self-justification', 'Par souci de concision, nous avons choisi de ne pas détailler.', 'Le détail est en annexe.'],
    ['banned-word', 'Une expérience seamless pour les agents.', 'Une expérience fluide pour les agents.'],
    ['absence-status', "Prix : rien n'est chiffré.", 'Prix : en cours de chiffrage.'],
    ['absence-status', 'Une mission proposée, sans chiffrage.', 'Une mission proposée, deux chiffres justes.'],
    ['em-dash', 'La plateforme — la nôtre — est ouverte.', 'La plateforme, la nôtre, est ouverte.'],
    ['middot', 'Atelier Nord · 2026', 'Atelier Nord, 2026'],
    ['calque', 'Un service monitoré en continu.', 'Un service suivi en continu.'],
    ['one-word-question', 'Le résultat ? Une plateforme souveraine.', 'Le résultat est une plateforme souveraine.'],
    ['triad', 'Rapide, fiable et souveraine.', 'Souveraine, et déployée chez vous.'],
    [
      'incise-overload',
      "La plateforme, qui est ouverte, que nous déployons chez vous, et qui reste la vôtre, même si nous disparaissons, tient sur vos serveurs, sans dépendance, et sans licence à acheter.",
      'La plateforme est ouverte. Vous la déployez chez vous.',
    ],
    [
      'repeated-sentence',
      'La plateforme est open source sous licence MIT et vous la déployez. La plateforme est open source sous licence MIT et vous la déployez.',
      'La plateforme est open source sous licence MIT et vous la déployez.',
    ],
  ]
  let bad = 0
  for (const [rule, shouldFire, shouldNot] of cases) {
    const fires = analyse(shouldFire, { path: 'test', mode: 'prose' }).found.some((f) => f.rule === rule)
    const quiet = !analyse(shouldNot, { path: 'test', mode: 'prose' }).found.some((f) => f.rule === rule)
    if (!fires) {
      console.log(`  MISS  ${rule}: did not fire on "${shouldFire.slice(0, 60)}"`)
      bad++
    }
    if (!quiet) {
      console.log(`  WOLF  ${rule}: fired on clean copy "${shouldNot.slice(0, 60)}"`)
      bad++
    }
  }
  // The end-dot rule, both ways: it fires on a closing period and stays quiet on an
  // internal one, which is the whole distinction.
  const dotCase = analyse(
    '<section class="slide"><h2><span data-lang="fr">Une philosophie open-source.</span></h2></section>',
    { path: 'test', mode: 'slide' }
  ).found.map((f) => f.rule)
  const noDotCase = analyse(
    '<section class="slide"><h2><span data-lang="fr">Trois façons de faire. Un seul paquet complet</span></h2></section>',
    { path: 'test', mode: 'slide' }
  ).found.map((f) => f.rule)
  if (!dotCase.includes('title-end-dot')) {
    console.log('  MISS  title-end-dot: did not fire on a title closing with a period')
    bad++
  }
  if (noDotCase.includes('title-end-dot')) {
    console.log('  WOLF  title-end-dot: fired on a title whose period is internal')
    bad++
  }

  // The comma-title run, both ways. Six titles is the floor, so both fixtures carry eight:
  // five with a comma fires (5/8 > 0.5), three does not, which is the "a few is fine" half.
  const deck = (titles) =>
    `<section class="slide">${titles
      .map((t) => `<h2><span data-lang="fr">${t}</span></h2>`)
      .join('')}</section>`
  const tail = ['Nos projets, par groupe', 'Le pipeline, avant les dates', 'La semaine LinkedIn, poste par poste', 'Trois semaines d’usage, par instance', 'Les postes, et le build']
  const plain = ['Ce qui avance cette semaine', 'La roadmap publiée', 'Le détail des déploiements']
  const runCase = analyse(deck([...tail, ...plain]), { path: 'test', mode: 'slide' }).found.map((f) => f.rule)
  const fewCase = analyse(deck([...tail.slice(0, 3), ...plain, 'Les cinq prochains événements', 'D’où vient chaque slide']), {
    path: 'test',
    mode: 'slide',
  }).found.map((f) => f.rule)
  if (!runCase.includes('comma-title-run')) {
    console.log('  MISS  comma-title-run: did not fire on a deck whose titles are mostly comma tails')
    bad++
  }
  if (fewCase.includes('comma-title-run')) {
    console.log('  WOLF  comma-title-run: fired on a deck with three of eight, which is allowed')
    bad++
  }
  // And on a document, which is where it had never looked.
  const page = (titles) => `<main>${titles.map((t, i) => `<h${2 + (i % 2)}><span data-lang="fr">${t}</span></h${2 + (i % 2)}>`).join('')}</main>`
  if (!analyse(page([...tail, ...plain]), { path: 'test', mode: 'auto' }).found.some((f) => f.rule === 'comma-title-run')) {
    console.log('  MISS  comma-title-run: did not fire on a document whose headings are mostly comma tails')
    bad++
  }
  if (analyse(page([...tail.slice(0, 3), ...plain, 'Les cinq prochains événements', 'D’où vient chaque slide']), { path: 'test', mode: 'auto' }).found.some((f) => f.rule === 'comma-title-run')) {
    console.log('  WOLF  comma-title-run: fired on a document with three of eight headings, which is allowed')
    bad++
  }

  const slideCase = analyse(
    '<section class="slide"><h2><span data-lang="fr">Un titre beaucoup trop long qui explique son point au lieu de nommer son sujet</span></h2>' +
      `<p><span data-lang="fr">${'mot '.repeat(60)}</span></p></section>`,
    { path: 'test', mode: 'slide' }
  ).found.map((f) => f.rule)
  for (const r of ['long-title', 'wall-of-text'])
    if (!slideCase.includes(r)) {
      console.log(`  MISS  ${r}: did not fire in slide mode`)
      bad++
    }
  // A markdown list or table is a set of units, not one sentence (2026-10-07), and a long
  // sentence inside one item is still read.
  const mdList = '## Repères\n\n' + Array.from({ length: 8 }, (_, i) => `- **Point ${i}** : un fait, une date, un lieu`).join('\n') + '\n\n| A | B |\n|---|---|\n| un, deux | trois, quatre |\n'
  const mdLong = '- Une phrase, qui part, qui revient, qui repart, puis qui digresse encore sur ce que la salle a dit avant de conclure enfin sur le prototype du soir.'
  const mdRules = (t) => analyse(t, { path: 'test', mode: 'auto' }).found.map((f) => f.rule)
  if (mdRules(mdList).includes('incise-overload') || !mdRules(mdLong).includes('incise-overload')) {
    console.log('  WOLF  incise-overload: a markdown list read as one sentence, or a long item went unread')
    bad++
  }
  // A deck, both ways: its titles sit in props, which a text reader never sees. Speaker notes, a
  // source line and someone else's words in a Quote stay out even when they carry what a rule
  // looks for.
  const deckSrc = (titles, extra = '') =>
    `---\ntitle: x\n---\n\n` +
    titles.map((t) => `<Slide\n  chapter="A"\n  title="${t}"\n  notes="Note — interne. Le résultat ? Rien."\n>\n  <Callout>Une phrase.</Callout>\n</Slide>\n`).join('\n') +
    extra
  const deckRules = (raw) => analyse(deckToMarkup(raw).markup, { path: 'test', mode: 'auto' }).found.map((f) => f.rule)
  const tails = ['La source, avant tout', 'Les règles, une par une', 'Le métier, au centre', 'Les vues, à la demande', 'Un *test* sur pièces', 'La suite']
  if (!deckRules(deckSrc(tails)).includes('comma-title-run') || !deckRules(deckSrc(['Une source de vérité.'])).includes('title-end-dot')) {
    console.log('  MISS  deck: comma-tail titles or a closing period in a title prop were not read')
    bad++
  }
  if (!deckRules(deckSrc(['Les règles'], '<Slide title="X">\n  <Cards items={[{ title: "Un", text: "Soyons clairs, le modèle ne décide jamais." }]} />\n</Slide>\n')).includes('announced-candour')) {
    console.log('  MISS  deck: a tell inside a card was not read')
    bad++
  }
  const quietDeck = deckSrc(['Une *source* de vérité', 'Les règles'], '<Slide title="X" source="Le résultat ? Un rapport — interne.">\n  <Quote text="Le constat ? Un service saturé." by="Une cheffe de service" />\n</Slide>\n')
  if (deckRules(quietDeck).some((r) => ['em-dash', 'one-word-question'].includes(r))) {
    console.log('  WOLF  deck: read the notes, the source line or a quote')
    bad++
  }
  console.log(bad === 0 ? `self-test: ${cases.length + 3} rules fire and stay quiet` : `self-test: ${bad} problem(s)`)
  process.exit(bad === 0 ? 0 : 1)
}

// ── run ──────────────────────────────────────────────────────────────────────
if (SELF_TEST) selfTest()

const results = []
if (has('stdin') || paths.length === 0) {
  const raw = readStdin()
  if (!raw.trim()) {
    console.error('nothing to read. Pass a file or a directory, or pipe the draft with --stdin.')
    console.error('  node scripts/check-ai-tics.mjs ../strategy/decks/')
    console.error('  pbpaste | node scripts/check-ai-tics.mjs --stdin')
    process.exit(2)
  }
  results.push(analyse(raw, { path: '<stdin>', mode: MODE }))
} else {
  for (const p of paths)
    for (const f of collect(p)) {
      const raw = readFileSync(f, 'utf8')
      if (!isDeck(f)) {
        results.push(analyse(raw, { path: f, mode: MODE }))
        continue
      }
      try {
        results.push(analyse(deckToMarkup(raw).markup, { path: f, mode: MODE }))
      } catch (e) {
        results.push({ path: f, found: [], slide: false, note: `not read: ${e.message}` })
      }
    }
}

if (JSON_OUT) {
  console.log(JSON.stringify(results.filter((r) => r.found.length), null, 2))
  process.exit(0)
}

let tells = 0
let looks = 0
for (const r of results) {
  if (!r.found.length && !r.note) continue
  console.log(`\n${r.path}${r.slide ? '  (slide mode)' : ''}`)
  if (r.note) console.log(`  note: ${r.note}`)
  const byRule = new Map()
  for (const f of r.found) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, [])
    byRule.get(f.rule).push(f)
  }
  for (const [rule, list] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
    const tier = list[0].tier
    tier === TELL ? (tells += list.length) : (looks += list.length)
    console.log(`  ${tier === TELL ? '✗' : '·'} ${rule} ×${list.length}: ${list[0].hint}`)
    for (const f of list.slice(0, 3)) console.log(`      “${f.sample}”`)
    if (list.length > 3) console.log(`      … and ${list.length - 3} more`)
  }
}

// The count is printed rather than written down anywhere: a number a script
// prints cannot go stale in a file (CLAUDE.md, "never write in prose a number the
// machine already knows").
const files = results.length
console.log(
  `\n${files} file(s) read: ${tells} tell(s), ${looks} thing(s) to look at` +
    (tells + looks === 0 ? ', clean' : '')
)
if (looks) console.log('The `look` tier is a measurement, not a verdict. Read the samples and decide.')
process.exit(STRICT && tells > 0 ? 1 : 0)
