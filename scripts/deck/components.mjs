// The registry: every shape a deck can compose, with the props it takes.
//
// A deck names a component from here and fills its props; the build refuses an unknown name, an
// unknown prop and a wrong type, with the line. Layout lives in the component and its CSS, content
// lives in the deck, and a shape that is missing becomes a component (in the brand's own
// components.mjs, or here) instead of a one-off in a deck. That is the whole method, taken from the
// Bayes Impact intranet and a consulting practice's decks: when the agent composes rather than draws, the house
// style holds on the twentieth deck, and every rule and check sees every slide.
//
// A component is { slide, props, children, render }:
//   slide     true for a whole slide (Cover, Slide, Divider…), false for a block inside one
//   props     the schema, checked before anything renders (see the helpers below)
//   children  'none', 'text' or 'blocks'
//   render(p, ctx, kids) → HTML; p is validated, kids the rendered children

import { esc } from './text.mjs';

// ── Schema ────────────────────────────────────────────────────────────────────────────────────
// text: prose with marks · str: a plain string · src: an image path · int · num · bool
// oneOf([…]) · list(of) · obj({…}) · textOr(key, {…}): a string, or an object whose `key` it fills
// Options: required, max (characters for text, items for lists: a warning), min (items: an error).

export const S = {
  text: (o = {}) => ({ k: 'text', ...o }),
  str: (o = {}) => ({ k: 'str', ...o }),
  src: (o = {}) => ({ k: 'src', ...o }),
  int: (o = {}) => ({ k: 'int', ...o }),
  num: (o = {}) => ({ k: 'num', ...o }),
  bool: (o = {}) => ({ k: 'bool', ...o }),
  oneOf: (values, o = {}) => ({ k: 'enum', values, ...o }),
  list: (of, o = {}) => ({ k: 'list', of, ...o }),
  obj: (shape, o = {}) => ({ k: 'obj', shape, ...o }),
  textOr: (key, shape, o = {}) => ({ k: 'textOr', key, shape, ...o }),
};
const req = (t) => ({ ...t, required: true });

const plainLen = (s) => String(s).replace(/[*`]/g, '').length;

export function validate(value, t, path, report) {
  if (value === undefined || value === null) {
    if (t.required) report.error(`${path} is required`);
    return undefined;
  }
  switch (t.k) {
    case 'text': case 'str': case 'src': {
      if (typeof value === 'number') value = String(value);
      if (typeof value !== 'string') { report.error(`${path} should be text`); return undefined; }
      if (t.required && !value.trim()) report.error(`${path} is empty`);
      if (t.max && plainLen(value) > t.max) report.warn(`${path} runs ${plainLen(value)} characters (keep it under ${t.max})`);
      return value;
    }
    case 'int': case 'num': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof n !== 'number' || Number.isNaN(n) || (t.k === 'int' && !Number.isInteger(n))) { report.error(`${path} should be a ${t.k === 'int' ? 'whole number' : 'number'}`); return undefined; }
      return n;
    }
    case 'bool':
      if (value === 'true' || value === 'false') return value === 'true';
      if (typeof value !== 'boolean') { report.error(`${path} should be true or false`); return undefined; }
      return value;
    case 'enum':
      if (!t.values.includes(value)) { report.error(`${path} should be one of ${t.values.map((v) => `"${v}"`).join(', ')}, not "${value}"`); return undefined; }
      return value;
    case 'list': {
      const arr = Array.isArray(value) ? value : [value];
      if (t.min && arr.length < t.min) report.error(`${path} needs at least ${t.min} item${t.min > 1 ? 's' : ''}`);
      if (t.max && arr.length > t.max) report.warn(`${path} has ${arr.length} items (more than ${t.max} rarely reads on a slide)`);
      return arr.map((v, i) => validate(v, t.of, `${path}[${i}]`, report)).filter((v) => v !== undefined);
    }
    case 'textOr':
      if (typeof value === 'string' || typeof value === 'number') value = { [t.key]: String(value) };
      return validate(value, { k: 'obj', shape: t.shape }, path, report);
    case 'obj': {
      if (typeof value !== 'object' || Array.isArray(value)) { report.error(`${path} should be an object {…}`); return undefined; }
      const out = {};
      for (const key of Object.keys(value)) {
        if (!(key in t.shape)) report.error(`${path}: unknown field "${key}" (known: ${Object.keys(t.shape).join(', ')})`);
      }
      for (const [key, st] of Object.entries(t.shape)) {
        const v = validate(value[key], st, `${path}.${key}`, report);
        if (v !== undefined) out[key] = v;
      }
      return out;
    }
    default: throw new Error(`schema: unknown kind ${t.k}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────

const cls = (...c) => c.filter(Boolean).join(' ');
const when = (v, f) => (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) ? '' : f(v));
const tag = (t, c, html) => `<${t}${c ? ` class="${c}"` : ''}>${html}</${t}>`;
const img = (ctx, src, alt = '', c = '', extra = '') => `<img class="${c}" src="${esc(ctx.asset(src))}" alt="${esc(alt)}"${extra} loading="eager" decoding="async">`;
const ul = (ctx, items, c = '') => `<ul${c ? ` class="${c}"` : ''}>${items.map((i) => `<li>${ctx.md(i)}</li>`).join('')}</ul>`;

/** Text children: paragraphs split on blank lines, "- " lines become a list. */
export function prose(ctx, text) {
  return String(text).split(/\n\s*\n/).map((para) => {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^[-•] /.test(l))) return ul(ctx, lines.map((l) => l.slice(2)));
    return `<p>${ctx.md(lines.join(' '))}</p>`;
  }).join('');
}

// What every whole slide accepts.
const COMMON = {
  chapter: S.str(),        // the part of the deck this slide belongs to; carries over to the next slides
  notes: S.str(),          // what the speaker says; shown with N, never printed, stripped from a shared copy
  id: S.str(),             // an anchor: deck.html#id
  ground: S.oneOf(['paper', 'tint', 'dark', 'accent']),
  source: S.text(),        // where the figures on the slide come from, printed in the footer
};

/** The frame every whole slide shares: numbered and footed at build time, so it reads without JS. */
export function frame(ctx, p, kind, inner, { head = '', ground, attrs = '' } = {}) {
  const g = p.ground || ground || 'paper';
  const chapter = ctx.chapter || '';
  return `<section class="${cls('dk-slide', `dk-${kind}`, `dk-ground-${g}`, chapter && 'has-chapter', p.id && 'has-id')}" `
    + `data-n="${ctx.n}" data-kind="${kind}" data-ground="${g}" data-title="${esc(ctx.title)}" data-chapter="${esc(ctx.group ?? chapter)}"${p.id ? ` id="${esc(p.id)}"` : ''}${attrs}>`
    + head + inner
    + `<footer class="dk-foot"><span class="dk-foot-l">${esc(ctx.meta.footer || '')}</span>`
    + `<span class="dk-src">${when(p.source, (s) => `${ctx.t('source')}${ctx.md(s)}`)}</span>`
    + `<span class="dk-num">${ctx.n}</span></footer>`
    + when(p.notes, (n) => `<aside class="dk-notes" hidden>${esc(n)}</aside>`)
    + '</section>';
}

export const head = (ctx, p) => {
  const inner = when(ctx.chapter, (c) => `<p class="dk-chapter">${ctx.md(c)}</p>`)
    + when(p.kicker, (k) => `<p class="dk-kicker">${ctx.md(k)}</p>`)
    + when(p.title, (t) => `<h2 class="dk-title">${ctx.md(t)}</h2>`)
    + when(p.lead, (l) => `<p class="dk-lead">${ctx.md(l)}</p>`);
  return inner ? `<header class="dk-head">${inner}</header>` : '';
};

const logoRow = (ctx, logos, c = 'dk-logo-row') => when(logos, (ls) => `<div class="${c}">${ls.map((l) => img(ctx, l.src, l.alt || '', 'dk-logo')).join('')}</div>`);
const LOGO = S.textOr('src', { src: req(S.src()), alt: S.str() });

// ── Whole slides ──────────────────────────────────────────────────────────────────────────────

export const components = {
  Cover: {
    slide: true,
    doc: 'The opening slide: what the deck is, for which occasion, by whom.',
    props: {
      ...COMMON,
      kicker: S.text({ max: 70 }), title: req(S.text({ max: 90 })), subtitle: S.text({ max: 120 }), lead: S.text({ max: 200 }),
      by: S.text(), date: S.str(), url: S.str(), mark: S.src(), image: S.src(), logos: S.list(LOGO, { max: 8 }),
    },
    children: 'none',
    render: (p, ctx) => frame(ctx, p, 'cover', `
      <div class="dk-cover-band">${when(p.kicker, (k) => `<span class="dk-cover-kicker">${ctx.md(k)}</span>`)}${when(p.url, (u) => `<span class="dk-cover-url">${esc(u)}</span>`)}</div>
      <div class="dk-cover-main">
        <div class="dk-cover-text">
          <h1 class="dk-cover-title">${ctx.md(p.title)}</h1>
          ${when(p.subtitle, (s) => `<p class="dk-cover-sub">${ctx.md(s)}</p>`)}
          ${when(p.lead, (s) => `<p class="dk-cover-lead">${ctx.md(s)}</p>`)}
          ${p.by || p.date ? `<p class="dk-cover-by">${when(p.by, (b) => `<span>${ctx.md(b)}</span>`)}${when(p.date, (d) => `<span class="dk-cover-date">${esc(ctx.date(d))}</span>`)}</p>` : ''}
        </div>
        ${p.mark || p.image ? `<div class="dk-cover-visual">${when(p.image, (s) => img(ctx, s, '', 'dk-cover-image'))}${when(p.mark, (s) => img(ctx, s, '', 'dk-cover-mark'))}</div>` : ''}
      </div>
      ${logoRow(ctx, p.logos, 'dk-cover-logos')}`),
  },

  Divider: {
    slide: true,
    doc: 'Opens a part of the deck. Its title becomes the chapter of the slides that follow.',
    props: { ...COMMON, n: S.int(), title: req(S.text({ max: 70 })), lead: S.text({ max: 180 }), image: S.src() },
    children: 'none',
    chapter: (p) => p.title,
    render: (p, ctx) => frame(ctx, p, 'divider', `
      ${when(p.image, (s) => `<div class="dk-bleed dk-divider-image" aria-hidden="true">${img(ctx, s)}</div>`)}
      <div class="dk-divider-main">
        ${when(p.n, (n) => `<span class="dk-divider-n" data-num="${n}">${ctx.t('part')} ${n}</span>`)}
        <h2 class="dk-title">${ctx.md(p.title)}</h2>
        ${when(p.lead, (l) => `<p class="dk-lead">${ctx.md(l)}</p>`)}
      </div>`, { ground: 'dark', attrs: p.n ? ` data-part="${p.n}"` : '' }),
  },

  Agenda: {
    slide: true,
    doc: 'The table of contents. Repeat it with `active` to open each part: the rest fades.',
    props: {
      ...COMMON, title: S.text(), active: S.int(), numbering: S.oneOf(['roman', 'decimal', 'none']),
      items: req(S.list(S.textOr('title', { title: req(S.text()), items: S.list(S.text(), { max: 6 }) }), { min: 2, max: 7 })),
    },
    children: 'none',
    chapter: (p) => { const it = p.active ? p.items?.[p.active - 1] : null; return typeof it === 'string' ? it : it?.title ?? ''; },
    render: (p, ctx) => {
      const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
      const num = (i) => (p.numbering === 'none' ? '' : p.numbering === 'decimal' ? `${i + 1}.` : `${roman[i]}.`);
      return frame(ctx, { ...p, title: p.title ?? ctx.t('agenda') }, 'agenda', head(ctx, { title: p.title ?? ctx.t('agenda') }) + `
      <div class="dk-body"><ol class="${cls('dk-agenda-list', p.active && 'has-active')}">${p.items.map((it, i) => `
        <li class="${cls(p.active === i + 1 && 'is-active')}"><span class="dk-agenda-n">${num(i)}</span><div><span class="dk-agenda-title">${ctx.md(it.title)}</span>${when(it.items, (s) => ul(ctx, s, 'dk-agenda-sub'))}</div></li>`).join('')}
      </ol></div>`);
    },
  },

  Statement: {
    slide: true,
    doc: 'One sentence, the whole slide: a thesis, a figure that deserves a screen, a quote.',
    props: { ...COMMON, kicker: S.text(), text: req(S.text({ max: 180 })), sub: S.text({ max: 160 }), image: S.src() },
    children: 'none',
    render: (p, ctx) => frame(ctx, p, 'statement', `
      ${when(p.image, (s) => `<div class="dk-bleed dk-statement-image" aria-hidden="true">${img(ctx, s)}</div>`)}
      <div class="dk-statement-main">
        ${when(p.kicker, (k) => `<p class="dk-kicker">${ctx.md(k)}</p>`)}
        <p class="dk-statement-text">${ctx.md(p.text)}</p>
        ${when(p.sub, (s) => `<p class="dk-statement-sub">${ctx.md(s)}</p>`)}
      </div>`, { ground: p.image ? 'paper' : 'tint' }),
  },

  Closing: {
    slide: true,
    doc: 'The last slide. A partner deck ends on the next step, an internal one on questions.',
    props: {
      ...COMMON, kicker: S.text(), title: req(S.text({ max: 70 })), lead: S.text({ max: 200 }), url: S.str(), mark: S.src(),
      contacts: S.list(S.obj({ name: req(S.str()), role: S.text(), email: S.str(), phone: S.str() }), { max: 4 }),
      logos: S.list(LOGO, { max: 10 }),
    },
    children: 'none',
    render: (p, ctx) => frame(ctx, p, 'closing', `
      <div class="dk-closing-main">
        ${when(p.kicker, (k) => `<p class="dk-kicker">${ctx.md(k)}</p>`)}
        <h2 class="dk-title">${ctx.md(p.title)}</h2>
        ${when(p.lead, (l) => `<p class="dk-lead">${ctx.md(l)}</p>`)}
        ${when(p.contacts, (cs) => `<div class="dk-contacts">${cs.map((c) => `<div class="dk-contact"><strong>${esc(c.name)}</strong>${when(c.role, (r) => `<span>${ctx.md(r)}</span>`)}${when(c.email, (e) => `<span>${esc(e)}</span>`)}${when(c.phone, (e) => `<span>${esc(e)}</span>`)}</div>`).join('')}</div>`)}
        ${when(p.url, (u) => `<p class="dk-closing-url">${esc(u)}</p>`)}
      </div>
      ${when(p.mark, (s) => `<div class="dk-closing-visual">${img(ctx, s, '', 'dk-cover-mark')}</div>`)}
      ${logoRow(ctx, p.logos, 'dk-cover-logos')}`, { ground: 'accent' }),
  },

  Slide: {
    slide: true,
    doc: 'The ordinary slide: a title, an optional kicker and lead, then blocks.',
    props: { ...COMMON, kicker: S.text({ max: 70 }), title: req(S.text({ max: 110 })), lead: S.text({ max: 240 }), align: S.oneOf(['center', 'top']) },
    children: 'blocks',
    render: (p, ctx, kids) => frame(ctx, p, 'slide',
      head(ctx, p) + `<div class="${cls('dk-body', p.align === 'top' && 'is-top')}">${kids.join('')}</div>`),
  },

  // ── Blocks ──────────────────────────────────────────────────────────────────────────────────

  Text: {
    doc: 'Paragraphs. A line starting with "- " is a list item.',
    props: { size: S.oneOf(['normal', 'large']), text: S.text() },
    children: 'text',
    render: (p, ctx, kids) => `<div class="${cls('dk-block dk-text', p.size === 'large' && 'is-large')}">${p.text ? prose(ctx, p.text) : kids.join('')}</div>`,
  },

  Bullets: {
    doc: 'Points, flat or in headed groups. Each point may carry sub-points.',
    props: {
      style: S.oneOf(['arrow', 'dot', 'check', 'number']),
      items: S.list(S.textOr('text', { text: req(S.text()), items: S.list(S.text(), { max: 5 }) }), { max: 7 }),
      groups: S.list(S.obj({ head: S.text(), items: req(S.list(S.textOr('text', { text: req(S.text()), items: S.list(S.text(), { max: 5 }) }), { max: 6 })) }), { max: 4 }),
    },
    children: 'none',
    check: (p) => (!p.items?.length && !p.groups?.length ? 'Bullets needs items or groups' : null),
    render: (p, ctx) => {
      const list = (items) => `<ul class="dk-points">${items.map((i) => `<li>${ctx.md(i.text)}${when(i.items, (s) => ul(ctx, s, 'dk-subpoints'))}</li>`).join('')}</ul>`;
      const groups = p.groups?.length ? p.groups : [{ items: p.items }];
      return `<div class="${cls('dk-block dk-bullets', `is-${p.style || 'arrow'}`)}">${groups.map((g) => `<div class="dk-group">${when(g.head, (h) => `<h3 class="dk-group-head">${ctx.md(h)}</h3>`)}${list(g.items)}</div>`).join('')}</div>`;
    },
  },

  Cards: {
    doc: 'Two to four boxes of the same kind, side by side, equal heights.',
    props: {
      cols: S.int(),
      items: req(S.list(S.obj({
        label: S.text(), title: S.text({ max: 60 }), text: S.text({ max: 220 }), items: S.list(S.text(), { max: 6 }),
        icon: S.src(), image: S.src(), tone: S.oneOf(['plain', 'soft', 'accent', 'c1', 'c2', 'c3', 'c4']), foot: S.text(),
      }), { min: 1, max: 6 })),
    },
    children: 'none',
    render: (p, ctx) => `<div class="dk-block dk-cards" style="--cols:${p.cols || Math.min(p.items.length, 4)}">${p.items.map((c) => `
      <article class="${cls('dk-card', c.tone && `is-${c.tone}`)}">
        ${when(c.image, (s) => img(ctx, s, '', 'dk-card-image'))}
        ${when(c.label, (l) => `<p class="dk-card-label">${ctx.md(l)}</p>`)}
        <div class="dk-card-body">
          ${when(c.icon, (s) => img(ctx, s, '', 'dk-card-icon'))}
          ${when(c.title, (t) => `<h3 class="dk-card-title">${ctx.md(t)}</h3>`)}
          ${when(c.text, (t) => `<p class="dk-card-text">${ctx.md(t)}</p>`)}
          ${when(c.items, (s) => ul(ctx, s, 'dk-card-items'))}
        </div>
        ${when(c.foot, (f) => `<p class="dk-card-foot">${ctx.md(f)}</p>`)}
      </article>`).join('')}</div>`,
  },

  Stats: {
    doc: 'Key figures. `big` for three or four headline numbers, `grid` for five or more.',
    props: {
      size: S.oneOf(['big', 'grid']), cols: S.int(), label: S.text(),
      items: req(S.list(S.obj({ value: req(S.str({ max: 12 })), label: S.text({ max: 70 }), sub: S.text(), source: S.text() }), { min: 1, max: 8 })),
    },
    children: 'none',
    render: (p, ctx) => {
      const size = p.size || (p.items.length > 4 ? 'grid' : 'big');
      return `<div class="${cls('dk-block dk-stats', `is-${size}`)}" style="--cols:${p.cols || (size === 'grid' ? 3 : p.items.length)}">${p.items.map((s) => `
        <div class="dk-stat"><strong class="dk-stat-value">${ctx.md(s.value)}</strong>${when(s.label, (l) => `<span class="dk-stat-label">${ctx.md(l)}</span>`)}${when(s.sub, (l) => `<span class="dk-stat-sub">${ctx.md(l)}</span>`)}${when(s.source, (l) => `<small class="dk-stat-source">${ctx.md(l)}</small>`)}</div>`).join('')}</div>`;
    },
  },

  Steps: {
    doc: 'A path in order: phases, a method, a roadmap. Numbered by default.',
    props: {
      numbered: S.bool(), look: S.oneOf(['chevrons', 'cards']),
      items: req(S.list(S.obj({ label: S.text(), title: req(S.text({ max: 50 })), text: S.text({ max: 180 }), items: S.list(S.text(), { max: 5 }) }), { min: 2, max: 6 })),
    },
    children: 'none',
    render: (p, ctx) => `<ol class="${cls('dk-block dk-steps', `is-${p.look || 'chevrons'}`)}" style="--cols:${p.items.length}">${p.items.map((s, i) => `
      <li class="dk-step">
        <div class="dk-step-head">${p.numbered === false ? '' : `<span class="dk-step-n">${String(i + 1).padStart(2, '0')}</span>`}<span class="dk-step-title">${ctx.md(s.title)}</span></div>
        ${when(s.label, (l) => `<p class="dk-step-label">${ctx.md(l)}</p>`)}
        <div class="dk-step-body">${when(s.text, (t) => `<p>${ctx.md(t)}</p>`)}${when(s.items, (x) => ul(ctx, x))}</div>
      </li>`).join('')}</ol>`,
  },

  Timeline: {
    doc: 'Dated milestones on one axis.',
    props: { items: req(S.list(S.obj({ date: req(S.str({ max: 14 })), title: req(S.text({ max: 60 })), text: S.text({ max: 120 }), accent: S.bool() }), { min: 2, max: 8 })) },
    children: 'none',
    render: (p, ctx) => `<ol class="dk-block dk-timeline" style="--cols:${p.items.length}">${p.items.map((t) => `
      <li class="${cls('dk-tl-item', t.accent && 'is-accent')}"><span class="dk-tl-date">${esc(t.date)}</span><span class="dk-tl-dot" aria-hidden="true"></span><span class="dk-tl-title">${ctx.md(t.title)}</span>${when(t.text, (x) => `<span class="dk-tl-text">${ctx.md(x)}</span>`)}</li>`).join('')}</ol>`,
  },

  Table: {
    doc: 'A comparison or an inventory. `highlight` marks one column (1 is the first).',
    props: { head: S.list(S.text()), rows: req(S.list(S.list(S.text()), { min: 1, max: 9 })), highlight: S.int(), compact: S.bool() },
    children: 'none',
    render: (p, ctx) => {
      const c = (i) => (p.highlight === i + 1 ? ' class="is-key"' : '');
      return `<div class="${cls('dk-block dk-table', p.compact && 'is-compact')}"><table>${when(p.head, (h) => `<thead><tr>${h.map((x, i) => `<th${c(i)}>${ctx.md(x)}</th>`).join('')}</tr></thead>`)}<tbody>${p.rows.map((r) => `<tr>${r.map((x, i) => `<td${c(i)}>${ctx.md(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    },
  },

  Image: {
    doc: 'A photo or a figure. In a Split it takes the full height of its column.',
    props: { src: req(S.src()), alt: S.str(), caption: S.text({ max: 120 }), fit: S.oneOf(['cover', 'contain']), height: S.int(), focus: S.str(), frame: S.bool() },
    children: 'none',
    render: (p, ctx) => `<figure class="${cls('dk-block dk-image', `is-${p.fit || 'cover'}`, p.frame && 'is-framed')}"${p.height ? ` style="--h:${p.height}px"` : ''}>${img(ctx, p.src, p.alt || '', '', p.focus ? ` style="object-position:${esc(p.focus)}"` : '')}${when(p.caption, (c) => `<figcaption>${ctx.md(c)}</figcaption>`)}</figure>`,
  },

  Gallery: {
    doc: 'Several photos with captions, same size.',
    props: {
      cols: S.int(), caption: S.oneOf(['above', 'below']), height: S.int(), fit: S.oneOf(['cover', 'contain']),
      items: req(S.list(S.textOr('src', { src: req(S.src()), caption: S.text({ max: 80 }), alt: S.str() }), { min: 2, max: 9 })),
    },
    children: 'none',
    render: (p, ctx) => `<div class="${cls('dk-block dk-gallery', `caption-${p.caption || 'below'}`, `is-${p.fit || 'cover'}`)}" style="--cols:${p.cols || Math.min(p.items.length, 4)}${p.height ? `;--h:${p.height}px` : ''}">${p.items.map((g) => `<figure>${img(ctx, g.src, g.alt || '')}${when(g.caption, (c) => `<figcaption>${ctx.md(c)}</figcaption>`)}</figure>`).join('')}</div>`,
  },

  People: {
    doc: 'A team. `avatars` is a small credit row, `small` a dense grid, `large` a few portraits.',
    props: {
      size: S.oneOf(['large', 'small', 'avatars']), cols: S.int(),
      items: req(S.list(S.obj({ photo: S.src(), name: req(S.str()), role: S.text({ max: 60 }), text: S.text({ max: 100 }) }), { min: 1, max: 12 })),
    },
    children: 'none',
    render: (p, ctx) => {
      const size = p.size || (p.items.length > 4 ? 'small' : 'large');
      const initials = (n) => n.split(/\s+/).map((w) => w[0]).filter((c) => /\p{Lu}/u.test(c)).slice(0, 2).join('');
      return `<div class="${cls('dk-block dk-people', `is-${size}`)}" style="--cols:${p.cols || Math.min(p.items.length, size === 'small' ? 6 : 4)}">${p.items.map((x) => `
        <figure class="dk-person">${x.photo ? img(ctx, x.photo, x.name, 'dk-person-photo') : `<span class="dk-person-photo is-initials" aria-hidden="true">${esc(initials(x.name))}</span>`}${size === 'avatars' ? '' : `<figcaption><strong>${esc(x.name)}</strong>${when(x.role, (r) => `<span class="dk-person-role">${ctx.md(r)}</span>`)}${when(x.text, (t) => `<span class="dk-person-text">${ctx.md(t)}</span>`)}</figcaption>`}</figure>`).join('')}</div>`;
    },
  },

  Logos: {
    doc: 'Partner logos, flat or grouped by kind of relationship.',
    props: {
      size: S.oneOf(['small', 'medium', 'large']),
      items: S.list(LOGO, { max: 16 }),
      groups: S.list(S.obj({ title: S.text(), items: req(S.list(LOGO, { max: 10 })) }), { max: 4 }),
    },
    children: 'none',
    check: (p) => (!p.items?.length && !p.groups?.length ? 'Logos needs items or groups' : null),
    render: (p, ctx) => {
      const wall = (ls) => `<div class="dk-logo-wall">${ls.map((l) => `<span class="dk-logo-cell">${img(ctx, l.src, l.alt || '', 'dk-logo')}</span>`).join('')}</div>`;
      return `<div class="${cls('dk-block dk-logos', `is-${p.size || 'medium'}`)}">${p.groups?.length
        ? p.groups.map((g) => `<div class="dk-logo-group">${when(g.title, (t) => `<p class="dk-logo-group-title">${ctx.md(t)}</p>`)}${wall(g.items)}</div>`).join('')
        : wall(p.items)}</div>`;
    },
  },

  Quote: {
    doc: 'Someone else\'s words, with who said them.',
    props: { text: req(S.text({ max: 260 })), by: S.text(), role: S.text(), photo: S.src() },
    children: 'none',
    render: (p, ctx) => `<figure class="dk-block dk-quote">${when(p.photo, (s) => img(ctx, s, p.by || '', 'dk-quote-photo'))}<div><blockquote>${ctx.md(p.text)}</blockquote>${p.by || p.role ? `<figcaption>${when(p.by, (b) => `<strong>${ctx.md(b)}</strong>`)}${when(p.role, (r) => `<span>${ctx.md(r)}</span>`)}</figcaption>` : ''}</div></figure>`,
  },

  Compare: {
    doc: 'Two states side by side: before and after, today and tomorrow, option A and option B.',
    props: Object.fromEntries(['left', 'right'].map((k) => [k, req(S.obj({ label: S.text(), title: S.text(), text: S.text(), items: S.list(S.text(), { max: 6 }), image: S.src() }))]).concat([['arrow', S.bool()]])),
    children: 'none',
    render: (p, ctx) => {
      const pane = (x, side) => `<div class="${cls('dk-pane', `is-${side}`)}">${when(x.label, (l) => `<span class="dk-pane-label">${ctx.md(l)}</span>`)}${when(x.image, (s) => img(ctx, s, '', 'dk-pane-image'))}${when(x.title, (t) => `<h3>${ctx.md(t)}</h3>`)}${when(x.text, (t) => `<p>${ctx.md(t)}</p>`)}${when(x.items, (s) => ul(ctx, s))}</div>`;
      return `<div class="dk-block dk-compare">${pane(p.left, 'left')}${p.arrow === false ? '' : '<span class="dk-compare-arrow" aria-hidden="true"></span>'}${pane(p.right, 'right')}</div>`;
    },
  },

  Split: {
    doc: 'Columns. `ratio` gives their widths ("1 1", "3 2", "1 1 1"); each child is a column.',
    props: { ratio: S.str(), align: S.oneOf(['top', 'center', 'stretch']) },
    children: 'blocks',
    check: (p, kids) => {
      const n = (p.ratio || '1 1').trim().split(/\s+/).length;
      return kids.length !== n ? `Split ratio "${p.ratio || '1 1'}" has ${n} columns but ${kids.length} children` : null;
    },
    render: (p, ctx, kids) => {
      const cols = (p.ratio || '1 1').trim().split(/\s+/).map((x) => `${Number(x) || 1}fr`).join(' ');
      return `<div class="${cls('dk-block dk-split', `is-${p.align || 'stretch'}`)}" style="--split:${cols}">${kids.map((k) => `<div class="dk-col">${k}</div>`).join('')}</div>`;
    },
  },

  Callout: {
    doc: 'One sentence set apart. `goal` states the aim, `next` what happens next, `point` the takeaway.',
    props: { tone: S.oneOf(['point', 'goal', 'next', 'note', 'warn']), label: S.text(), text: S.text() },
    children: 'text',
    render: (p, ctx, kids) => `<div class="${cls('dk-block dk-callout', `is-${p.tone || 'point'}`)}"><span class="dk-callout-icon" aria-hidden="true"></span><div>${when(p.label, (l) => `<p class="dk-callout-label">${ctx.md(l)}</p>`)}${p.text ? `<p>${ctx.md(p.text)}</p>` : kids.join('')}</div></div>`,
  },

  Meta: {
    doc: 'Who, when, how much: the facts line under a project name.',
    props: { title: S.text({ max: 80 }), by: S.text(), items: S.list(S.obj({ label: S.text(), value: req(S.text()) }), { max: 4 }) },
    children: 'none',
    render: (p, ctx) => `<div class="dk-block dk-meta">${when(p.title, (t) => `<p class="dk-meta-title">${ctx.md(t)}</p>`)}${when(p.by, (b) => `<p class="dk-meta-by">${ctx.md(b)}</p>`)}${when(p.items, (xs) => `<p class="dk-meta-items">${xs.map((x) => `<span>${when(x.label, (l) => `<b>${ctx.md(l)}</b>${ctx.t('colon')}`)}${ctx.md(x.value)}</span>`).join('')}</p>`)}</div>`,
  },

  Bars: {
    doc: 'A bar chart in HTML: labels and values stay text.',
    props: { unit: S.str(), max: S.num(), items: req(S.list(S.obj({ label: req(S.text()), value: req(S.num()), display: S.str(), accent: S.bool() }), { min: 2, max: 10 })) },
    children: 'none',
    render: (p, ctx) => {
      const top = p.max || Math.max(...p.items.map((i) => i.value)) || 1;
      return `<div class="dk-block dk-bars" style="--cols:${p.items.length}">${p.items.map((b) => `
        <div class="${cls('dk-bar', b.accent && 'is-accent')}"><span class="dk-bar-value">${esc(b.display ?? `${b.value}${p.unit || ''}`)}</span><span class="dk-bar-track"><span class="dk-bar-fill" style="height:${Math.max(2, (b.value / top) * 100).toFixed(1)}%"></span></span><span class="dk-bar-label">${ctx.md(b.label)}</span></div>`).join('')}</div>`;
    },
  },

  Donut: {
    doc: 'Shares of a whole, with the total in the middle and a legend beside it.',
    props: { total: S.str(), label: S.text(), items: req(S.list(S.obj({ label: req(S.text()), value: req(S.num()), display: S.str() }), { min: 2, max: 6 })) },
    children: 'none',
    render: (p, ctx) => {
      const sum = p.items.reduce((a, b) => a + b.value, 0) || 1;
      let at = 0;
      const stops = p.items.map((b, i) => { const from = at; at += (b.value / sum) * 100; return `var(--dk-c${(i % 5) + 1}) ${from.toFixed(2)}% ${at.toFixed(2)}%`; }).join(', ');
      return `<div class="dk-block dk-donut"><div class="dk-donut-ring" style="background:conic-gradient(${stops})"><div class="dk-donut-hole">${when(p.total, (t) => `<strong>${esc(t)}</strong>`)}${when(p.label, (l) => `<span>${ctx.md(l)}</span>`)}</div></div><ul class="dk-donut-legend">${p.items.map((b, i) => `<li><i style="background:var(--dk-c${(i % 5) + 1})"></i><span>${ctx.md(b.label)}</span><b>${esc(b.display ?? `${Math.round((b.value / sum) * 100)}\u00a0%`)}</b></li>`).join('')}</ul></div>`;
    },
  },
};

/** What a brand's components.mjs receives, so it never imports the kit by path. */
export const helpers = { S, frame, head, prose, esc, when, cls, img, ul, logoRow };
