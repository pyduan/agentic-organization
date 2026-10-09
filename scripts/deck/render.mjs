// A parsed deck becomes one HTML page: validated against the registry, rendered slide by slide,
// with the engine, the kit theme and the brand theme inlined, so the page works as a single file.
//
// Errors stop the build: an unknown component, an unknown prop, a wrong type, a missing image.
// Warnings do not: they are the content rules a person should read (a figure without a source,
// two dark slides in a row, a list too long to read), printed with the slide they belong to.

import { S, validate, prose, frame } from './components.mjs';
import { esc, md, plain, words } from './text.mjs';

const STRINGS = {
  fr: { source: 'Source\u00a0: ', part: 'Partie', agenda: 'Ordre du jour', colon: '\u00a0: ', noNotes: 'Pas de note sur cette slide.', overview: 'Vue d’ensemble', notes: 'Notes', full: 'Plein écran', print: 'PDF', prev: 'Précédente', next: 'Suivante' },
  en: { source: 'Source: ', part: 'Part', agenda: 'Agenda', colon: ': ', noNotes: 'No notes on this slide.', overview: 'Overview', notes: 'Notes', full: 'Fullscreen', print: 'PDF', prev: 'Previous', next: 'Next' },
};
const MONTHS = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const formatDate = (d, lang) => {
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(d);
  const day = Number(m[3]);
  return lang === 'fr' ? `${day === 1 ? '1er' : day} ${MONTHS.fr[m[2] - 1]} ${m[1]}` : `${day} ${MONTHS.en[m[2] - 1]} ${m[1]}`;
};

// A figure worth a source: a percentage, an amount, a large count. Years and slide numbers are not.
const FIGURE = /(\d[\d\s\u202f.,]*\s?(%|€|k€|M€|Md€|\$|millions?|milliards?|M\b|k\b))|(\b\d{1,3}(?:[\s\u202f.]\d{3})+\b)|(\b(?!(?:19|20)\d{2}\b)\d{3,}\b)/i;

/** Every string a slide shows, for counting words and finding figures. Notes and sources excluded. */
function texts(node, out = []) {
  if (node.type === 'text') { out.push(node.text); return out; }
  const walk = (v, key) => {
    if (['notes', 'source', 'src', 'mark', 'image', 'photo', 'icon', 'id', 'url', 'email', 'phone', 'chapter', 'ground', 'tone', 'size', 'look', 'fit', 'ratio', 'align', 'focus', 'caption'].includes(key)) return;
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  for (const [k, v] of Object.entries(node.props || {})) walk(v, k);
  for (const c of node.children || []) texts(c, out);
  return out;
}
const hasSource = (node) => Boolean(node.props?.source) || (node.children || []).some(hasSource)
  || JSON.stringify(node.props || {}).includes('"source"');

export function renderDeck(deck, opts) {
  const { registry, asset, css, js, lang: langOpt, shareMode = false } = opts;
  const meta = deck.meta;
  const lang = langOpt || meta.lang || 'fr';
  const strings = STRINGS[lang] || STRINGS.en;
  const errors = [];
  const warnings = [];
  const info = [];
  let chapter = '';
  let group = '';

  const renderNode = (node, ctx, where, top = false) => {
    if (node.type === 'text') return prose(ctx, node.text);
    const def = registry[node.name];
    const at = `${where} <${node.name}> (line ${node.line})`;
    if (!def) { errors.push(`${at}: no such component. Known: ${Object.keys(registry).join(', ')}`); return ''; }
    if (def.slide && !top) { errors.push(`${at}: a whole slide cannot sit inside another component`); return ''; }
    const report = { error: (m) => errors.push(`${at}: ${m}`), warn: (m) => warnings.push(`${at}: ${m}`) };
    const props = {};
    for (const k of Object.keys(node.props)) if (!(k in def.props)) report.error(`unknown prop "${k}" (known: ${Object.keys(def.props).join(', ')})`);
    for (const [k, t] of Object.entries(def.props)) {
      const v = validate(node.props[k], t, k, report);
      if (v !== undefined) props[k] = v;
    }
    let kids = [];
    if (def.children === 'none' && node.children.length) report.error('takes no children; put the content in its props');
    if (def.children === 'text') {
      if (node.children.some((c) => c.type !== 'text')) report.error('takes text only');
      kids = node.children.filter((c) => c.type === 'text').map((c) => prose(ctx, c.text));
      if (!kids.length && !props.text) report.error('is empty');
    }
    if (def.children === 'blocks') kids = node.children.map((c) => renderNode(c, ctx, where));
    const problem = def.check?.(props, kids);
    if (problem) report.error(problem);
    try {
      return def.render(props, ctx, kids);
    } catch (e) {
      report.error(`could not render: ${e.message}`);
      return '';
    }
  };

  const slidesHtml = deck.slides.map((node, i) => {
    const n = i + 1;
    const where = `slide ${n}`;
    const def = registry[node.name];
    if (def && !def.slide) {
      errors.push(`${where} <${node.name}> (line ${node.line}): a block goes inside a <Slide>, it is not a slide on its own`);
      return '';
    }
    const p = node.props || {};
    if (typeof p.chapter === 'string') { chapter = p.chapter; group = p.chapter; }
    // A Divider or an Agenda never shows a chapter label itself; it says which part follows.
    const own = def?.chapter ? (def.chapter(p) ?? '') : undefined;
    const ctx = {
      n, lang, meta, t: (k) => strings[k] ?? k, date: (d) => formatDate(d, lang),
      md: (s) => md(s, lang), asset: (src) => asset(src, `${where} <${node.name}>`),
      title: plain(p.title || p.text || node.name),
      chapter: own !== undefined ? '' : chapter,
      group: own !== undefined ? own : group,
    };
    const html = renderNode(node, ctx, where, true);
    if (own !== undefined) {
      group = own || '';
      chapter = node.name === 'Divider' ? (own || '') : '';
    }
    const all = texts(node);
    const figure = all.map((s) => plain(s)).find((s) => FIGURE.test(s));
    const ground = p.ground || { Divider: 'dark', Closing: 'accent' }[node.name] || 'paper';
    info.push({ n, kind: node.name, title: ctx.title, chapter: ctx.group, ground, words: all.reduce((a, s) => a + words(s), 0), notes: Boolean(p.notes), figure: figure && !hasSource(node) ? figure : null, line: node.line });
    return html;
  });

  // Content rules a person should read: they never stop the build.
  info.forEach((s, i) => {
    const prev = info[i - 1];
    if (prev && ['dark', 'accent'].includes(prev.ground) && ['dark', 'accent'].includes(s.ground)) warnings.push(`slide ${s.n}: second dark slide in a row (slide ${prev.n} is dark too). A dark slide opens a part; merge them or lighten one.`);
    if (s.figure) warnings.push(`slide ${s.n} «${s.title}»: a figure without a source («${s.figure.slice(0, 50)}»). Add source="…" to the slide, or say on the slide that it is an estimate.`);
  });
  for (const k of ['title', 'date']) if (!meta[k]) warnings.push(`frontmatter: no "${k}"`);
  for (const k of ['audience', 'takeaway']) if (!meta[k]) warnings.push(`frontmatter: no "${k}". Who is in the room, and the one thing they should remember, decide what goes on every slide.`);

  const bar = `<nav class="dk-chrome" aria-label="deck">
    <button data-act="prev" title="${esc(strings.prev)} (←)">←</button><span class="dk-count">1 / ${info.length}</span><button data-act="next" title="${esc(strings.next)} (→)">→</button>
    <span class="dk-chrome-chapter"></span>
    <button data-act="overview" data-toggles="data-overview" title="${esc(strings.overview)} (O)">▦</button>
    ${shareMode ? '' : `<button data-act="notes" data-toggles="data-notes" title="${esc(strings.notes)} (N)">${esc(strings.notes)}</button>`}
    <button data-act="full" title="${esc(strings.full)} (F)">⛶</button>
    <button data-act="print" title="${esc(strings.print)} (P)">${esc(strings.print)}</button>
    <span class="dk-progress"><i></i></span></nav>`;

  let body = slidesHtml.join('\n');
  if (shareMode) body = body.replace(/<aside class="dk-notes" hidden>[\s\S]*?<\/aside>/g, '');

  const html = `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="generator" content="agentic-organization deck engine">
<title>${esc(plain(meta.title || 'Deck'))}</title>
<style>
${css}
</style>
</head>
<body class="dk-page">
<div class="dk-app" id="dk" data-strings="${esc(JSON.stringify({ noNotes: strings.noNotes }))}">
<main class="dk-stage-wrap"><div class="dk-stage" id="dk-stage">
${body}
</div></main>
${bar}
<aside class="dk-notes-panel" aria-live="polite"></aside>
<div class="dk-overview"></div>
</div>
<script>
${js}
</script>
</body>
</html>
`;
  return { html, errors, warnings, slides: info, lang };
}

export { S };
