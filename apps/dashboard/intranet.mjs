// The intranet's pages, rendered at build time from the data scripts/dashboard-data.mjs gathers.
//
// Static HTML on purpose: the intranet is the first thing the setup publishes, minutes into the
// first session, and it must build with Node alone, before anything has been installed. Every page
// is complete without JavaScript; the scripts remember whether this viewer closed the banner, keep the
// current tab in view, and, on a page with tick boxes (components.mjs), save a tick.
//
// What is the owner's to edit lives in source/content/, never here:
//   intranet-home.md   the banner at the top of the home page (quickstart, how this works)
//   intranet-tools.md  the cards under "Tools", one line per app or page
// What this file holds is the shape: the words of the chrome (STRINGS, translated in one place, as
// in the company pack's intranet), the tabs, and the layout.
//
// Navigation follows source/formats/webapp.md ▸ One row of tabs, then a sidebar: the sections are
// tabs in the header; a section with several pages (Projects) lists them in a sidebar, which folds
// into one control above the title on a phone. When the sections outgrow one row (SIDEBAR_FROM of
// them, or an extension that groups them), they move to a sidebar of their own, down the left side,
// grouped under headings, and fold into one menu on a phone.
//
// An instance adds its own tabs, pages, home sections and styles through the extension point
// (apps/dashboard/extend.mjs, documented in source/formats/dashboard.md ▸ Adding your own views),
// never by editing this file: `renderIntranet({ ..., extension })` takes what it registered, and
// the shell, the sidebar and the small pieces below are exported so its pages are the kit's.

import { renderMarkdown, inline, esc, slugify } from '../../scripts/doc/markdown.mjs';
import { isOverdue } from '../../lib/todo.mjs';
import { typo, baseLang } from '../../scripts/deck/text.mjs';
import { checkboxScript } from './components.mjs';
import { readFileSync } from 'node:fs';

/** The kit's language. An extension sets its own with intranet.locale('fr-FR'), for one build. */
export const LOCALE = 'en-GB';

export const STRINGS = {
  'nav.home': 'Home',
  'nav.projects': 'Projects',
  'nav.menu': 'Menu',
  'banner.title': 'Quickstart',
  'banner.hide': 'Hide',
  'banner.show': 'Show',
  'tiles.running': ['project running', 'projects running'],
  'tiles.open': ['thing to do', 'things to do'],
  'tiles.late': ['late', 'late'],
  'tiles.decide': ['decision waiting', 'decisions waiting'],
  'home.waiting': 'Who waits on what',
  'home.waitingNote': 'Each person and what they hold, decisions first, then what is late.',
  'home.projects': 'Where things stand',
  'home.moved': 'What moved',
  'home.tools': 'Tools',
  'home.empty': 'No projects tracked yet. Tell the agent "start tracking" and the name of a piece of work, and this page fills itself in.',
  'who.nobody': 'No one named',
  'who.more': (n) => `and ${n} more`,
  'badge.decide': 'to decide',
  'badge.late': 'late',
  'badge.new': 'new since your last visit',
  'card.counts': (open, done) => `${open} open · ${done} done`,
  'card.nothing': 'nothing listed yet',
  'card.private': 'details kept in its own repo',
  'card.counted': (n) => `${n} ${n === 1 ? 'project' : 'projects'}, details kept in its own repo`,
  'projects.all': 'All projects',
  'projects.title': 'Projects',
  'projects.open': 'Open',
  'projects.noOpen': 'Nothing open.',
  'projects.moved': 'What moved',
  'projects.private': (names) => `Not read here, by their own choice: ${names}.`,
  'tool.unpublished': 'not published yet',
  'foot.built': (when) => `Built from the repository on ${when}. Nothing is edited here: when a page is wrong, the file behind it is.`,
  'foot.signout': 'Sign out',
  // The components an extension uses (components.mjs).
  'ui.done': 'done',
  'ui.of': (done, total) => `${done} of ${total}`,
  'checks.offline': 'These boxes do not save from here yet: they show the state of the last build.',
  'checks.saving': 'Saving…',
  'checks.saved': 'Saved in the repository.',
  'checks.failed': 'Not saved. Try again.',
  'gantt.label': 'Timeline',
  'gantt.events': 'Calendar',
  'gantt.thisWeek': 'this week',
  'gantt.today': 'today',
  'gantt.event': 'event',
  'gantt.milestone': 'milestone',
  'gantt.action': 'dated action',
  'gantt.done': 'done',
  'gantt.late': 'late',
};

/** The sections, as [path from the root, label key]. One row of tabs, never two. */
export const TABS = [['', 'nav.home'], ['projects/', 'nav.projects']];

/**
 * From this many sections, the row of tabs becomes a sidebar down the left side. Seven tabs no
 * longer fit a laptop's header beside the organization's name, and a row that scrolls hides most of
 * the sections from whoever is looking for one.
 */
export const SIDEBAR_FROM = 7;

/**
 * What an extension may hide when it replaces it (intranet.hide): a section of the kit's home page,
 * or the Projects tab. A closed list, so a typo stops the build instead of hiding nothing. The
 * projects' pages are built either way, so a link to one keeps working.
 */
export const HIDE_KEYS = ['home.tiles', 'home.waiting', 'home.projects', 'home.moved', 'home.tools', 'tab.projects'];

// What an extension adds to the chrome, for the length of one renderIntranet() call: its tabs placed
// among the kit's, its groups, and its words over the kit's. Null renders exactly the kit's own.
let chrome = null;
// Whether this build has news for the tab badges (badges.js), for the length of one renderIntranet().
let withNews = false;

/** A word of the chrome: the extension's translation if it gave one, else the kit's. */
export const t = (key, ...args) => {
  const v = chrome?.strings && key in chrome.strings ? chrome.strings[key] : STRINGS[key];
  return typeof v === 'function' ? v(...args) : v;
};
const plural = (key, n) => {
  const v = chrome?.strings && key in chrome.strings ? chrome.strings[key] : STRINGS[key];
  return v[n === 1 ? 0 : 1];
};

/**
 * The tabs as they render now: the kit's, with an extension's placed among them. A tab goes before
 * the one its `before` names, or after its `after`, and by default before Projects; several placed
 * at one spot keep the order they were added in.
 */
export function tabs() {
  const out = TABS.map(([to, key]) => ({ to, key, after: null }));
  for (const x of chrome?.tabs || []) {
    if (out.some((o) => o.to === x.path)) continue;
    let at;
    if (x.after != null) {
      at = out.findIndex((o) => o.to === x.after);
      if (at < 0) at = out.length;
      else { at += 1; while (at < out.length && out[at].after === x.after) at += 1; }
    } else {
      at = out.findIndex((o) => o.to === (x.before ?? 'projects/'));
      if (at < 0) at = out.length;
    }
    out.splice(at, 0, { to: x.path, key: x.label, after: x.after ?? null });
  }
  const gone = chrome?.hide?.includes('tab.projects') ? 'projects/' : null;
  return out.filter((o) => o.to !== gone).map((o) => [o.to, o.key]);
}

/** The language pages are built in: the extension's (intranet.locale), else the kit's LOCALE. */
export const locale = () => chrome?.locale || LOCALE;

const label = (key) => {
  const v = t(key);
  return v === undefined ? key : v;
};

/**
 * Whether the sections render as a sidebar rather than a row: groups asked for, or too many to fit,
 * and no page of the build has a sidebar of its own. Two navigation levels never share an
 * orientation (webapp.md ▸ One row of tabs, then a sidebar): when a section's pages are a vertical
 * sidebar, the sections stay a horizontal row, scrolling sideways when they outgrow it.
 */
export const sidebarNav = () => !chrome?.sided && (Boolean(chrome?.groups?.length) || tabs().length >= SIDEBAR_FROM);

/**
 * The sections as the sidebar shows them, [{ label, tabs }]: the tabs no group names first, under no
 * heading and in the row's order, then each group in the order it was declared, its tabs in the
 * order it lists them.
 */
export function navGroups() {
  const all = tabs();
  const grouped = new Set((chrome?.groups || []).flatMap((g) => g.paths));
  const out = [{ label: null, tabs: all.filter(([to]) => !grouped.has(to)) }];
  for (const g of chrome?.groups || []) out.push({ label: g.label, tabs: g.paths.map((p) => all.find(([to]) => to === p)).filter(Boolean) });
  return out.filter((g) => g.tabs.length);
}

// ---------------------------------------------------------------- the owner's words

/**
 * The banner, from source/content/intranet-home.md: the first `#` heading is its title, what sits
 * between it and the first `##` its lede, and each `##` section a column. HTML comments are notes
 * for the agent and never shown. An empty or missing file gives no banner: that is how an instance
 * turns it off.
 */
export function parseHome(md) {
  const lines = String(md ?? '').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  let title = null;
  const lede = [];
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) { cur = { heading: h2[1], body: [] }; sections.push(cur); continue; }
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    if (h1 && title === null && !cur) { title = h1[1]; continue; }
    (cur ? cur.body : lede).push(line);
  }
  const out = {
    title,
    lede: lede.join('\n').trim(),
    sections: sections
      .map((s) => ({ heading: s.heading, id: slugify(s.heading), body: s.body.join('\n').trim() }))
      .filter((s) => s.body),
  };
  return out.title || out.lede || out.sections.length ? out : null;
}

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** The heading the kit shipped before the banner was called Quickstart, read as no heading. */
const OLD_DEFAULT_TITLE = 'start here';

/**
 * The banner's title as it shows: the owner's heading, unless there is none, it repeats the
 * organization's name the header already shows (case and accents aside), or it is the kit's old
 * default; then the chrome's word, `banner.title` (Quickstart, translatable like any other).
 */
export function bannerTitle(title, org) {
  const f = fold(title);
  return !f || f === fold(org) || f === OLD_DEFAULT_TITLE ? null : title;
}

const TOOL = /^\s*[-*]\s+\[([^\]]+)\]\(([^)\s]*)\)\s*[·:—–-]?\s*(.*?)\s*$/;

/** A link the page may follow: the web, mail, or a path inside the intranet. Anything else is unset. */
function safeHref(href) {
  const h = String(href ?? '').trim();
  if (!h || /^todo$/i.test(h)) return null;
  if (/^(https?:|mailto:)/i.test(h)) return h;
  if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return null; // javascript:, data:, and the like
  return h;
}

/**
 * The tools, from source/content/intranet-tools.md: one list line per tool,
 * `- [Label](address) what it is for`. An address of `TODO` (or none) shows the card as not
 * published yet, which is the honest state of an app before its Worker exists.
 */
export function parseTools(md) {
  const out = [];
  for (const line of String(md ?? '').replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    const m = line.match(TOOL);
    if (m) out.push({ label: m[1].trim(), href: safeHref(m[2]), text: m[3] });
  }
  return out;
}

// ---------------------------------------------------------------- what the data says

/** Who holds which open item, across every project whose wording travels. */
export function waiting(projects, today) {
  const people = new Map();
  for (const p of projects) {
    if (p.countsOnly) continue;
    p.open.forEach((item, order) => {
      const row = {
        ...item,
        order,
        project: p.title,
        page: p.page,
        decide: (item.tags || []).includes('decide'),
        late: isOverdue(item.due, today),
      };
      for (const who of item.owners?.length ? item.owners : [null]) {
        if (!people.has(who)) people.set(who, []);
        people.get(who).push(row);
      }
    });
  }
  const rank = (r) => (r.decide ? 0 : r.late ? 1 : r.due ? 2 : 3);
  return [...people.entries()]
    .map(([who, items]) => ({
      who,
      items: items.sort((a, b) => rank(a) - rank(b) || (a.due || '').localeCompare(b.due || '') || a.order - b.order),
    }))
    .sort((a, b) => (a.who === null) - (b.who === null) || b.items.length - a.items.length || String(a.who).localeCompare(String(b.who)));
}

/** The numbers at the top, counted from the data at build time and never written in prose. */
export function stats(projects, today) {
  const words = projects.filter((p) => !p.countsOnly);
  const open = words.flatMap((p) => p.open);
  return {
    running: projects.filter((p) => p.stage !== 'done').length,
    open: projects.reduce((n, p) => n + p.counts.open, 0),
    late: open.filter((i) => isOverdue(i.due, today)).length,
    decide: open.filter((i) => (i.tags || []).includes('decide')).length,
  };
}

// ---------------------------------------------------------------- pieces

const day = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });

export function todoRow(item, today, { project = null, base = '', notes = false } = {}) {
  const bits = [`<span class="todo-text">${esc(item.text)}</span>`];
  if (project) bits.push(item.page
    ? `<a class="todo-project" href="${base}${esc(item.page)}">${esc(project)}</a>`
    : `<span class="todo-project">${esc(project)}</span>`);
  if (item.decide ?? (item.tags || []).includes('decide')) bits.push(`<em class="badge strong">${t('badge.decide')}</em>`);
  for (const o of project ? [] : item.owners || []) bits.push(`<em class="badge">@${esc(o)}</em>`);
  if (item.due) {
    const late = isOverdue(item.due, today);
    bits.push(`<em class="badge${late ? ' strong' : ''}">${esc(item.due)}${late ? ` · ${t('badge.late')}` : ''}</em>`);
  }
  const note = notes && item.note ? `<small class="todo-note">${esc(item.note)}</small>` : '';
  return `<li>${bits.join(' ')}${note}</li>`;
}

export function projectCard(p, base, today) {
  const total = p.counts.open + p.counts.done;
  const pct = total ? Math.round((p.counts.done / total) * 100) : 0;
  const title = p.page ? `<a href="${base}${esc(p.page)}">${esc(p.title)}</a>` : esc(p.title);
  const foot = p.consent === 'counts' ? t('card.counted', p.counts.projects)
    : p.countsOnly ? t('card.private') : null;
  return `<article class="card">
  <div class="card-top"><h3>${title}</h3>${p.stage ? `<span class="pill${p.stage === 'active' ? ' on' : ''}">${esc(p.stage)}</span>` : ''}</div>
  ${total ? `<div class="meter" role="img" aria-label="${pct}%"><i style="width:${pct}%"></i></div>` : ''}
  <small>${total ? t('card.counts', p.counts.open, p.counts.done) : t('card.nothing')}</small>
  ${p.open.length ? `<ul class="todo">${p.open.slice(0, 4).map((i) => todoRow(i, today)).join('')}</ul>` : ''}
  ${foot ? `<small>${foot}</small>` : ''}
</article>`;
}

/** One number tile: the figure, what it counts, and an optional line under it. The label is HTML. */
export const tile = (n, text, note = '') => `<div class="tile"><b>${n}</b><span>${text}</span>${note ? `<small>${note}</small>` : ''}</div>`;

function tiles(s) {
  const one = (n, key) => tile(n, plural(key, n));
  return `<div class="tiles">${one(s.running, 'tiles.running')}${one(s.open, 'tiles.open')}${one(s.late, 'tiles.late')}${one(s.decide, 'tiles.decide')}</div>`;
}

export function feed(entries, base) {
  return `<div class="feed">${entries.map((r) => `<div><small>${day(r.date)}</small><span>${r.project
    ? `<b>${r.page ? `<a href="${base}${esc(r.page)}">${esc(r.project)}</a>` : esc(r.project)}</b> · ` : ''}${esc(r.text)}</span></div>`).join('')}</div>`;
}

function banner(home, org) {
  if (!home) return '';
  const own = bannerTitle(home.title, org);
  const cols = home.sections.map((s) => `<section id="${esc(s.id)}"><h2>${inline(s.heading)}</h2>${renderMarkdown(s.body)}</section>`).join('');
  return `<details class="banner" id="start" open>
  <summary><span class="wrap banner-head"><span class="banner-title">${own ? inline(own) : esc(t('banner.title'))}</span><span class="banner-toggle" data-hide="${t('banner.hide')}" data-show="${t('banner.show')}"></span></span></summary>
  <div class="wrap banner-body">
    ${home.lede ? `<div class="banner-lede">${renderMarkdown(home.lede)}</div>` : ''}
    ${cols ? `<div class="banner-cols">${cols}</div>` : ''}
  </div>
</details>
<script>
  // Closed once, closed for this viewer on this browser. Storage may be refused (a private window):
  // then the banner simply stays open.
  (() => {
    const b = document.getElementById('start');
    try { if (localStorage.getItem('intranet.banner') === 'closed') b.open = false; } catch {}
    b.addEventListener('toggle', () => { try { localStorage.setItem('intranet.banner', b.open ? 'open' : 'closed'); } catch {} });
  })();
</script>`;
}

function toolCards(tools, base) {
  if (!tools.length) return '';
  return `<h2 id="tools">${t('home.tools')}</h2>
<div class="tools">${tools.map((x) => {
    const href = x.href && !/^([a-z][a-z0-9+.-]*:|\/)/i.test(x.href) ? base + x.href : x.href;
    const head = href ? `<a href="${esc(href)}">${esc(x.label)}</a>` : `${esc(x.label)} <em class="badge">${t('tool.unpublished')}</em>`;
    return `<article class="tool${href ? '' : ' off'}"><h3>${head}</h3>${x.text ? `<p>${inline(x.text)}</p>` : ''}</article>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------- the shell

/**
 * A whole page in the kit's chrome: the head, the one row of tabs, then `before` (the home page's
 * banner) and `body`, then the footer. `depth` is how many folders below the root the page sits,
 * and `tab` the path of the tab it belongs to ('' for Home).
 *
 * Past two tabs the row scrolls sideways inside the header on a phone instead of widening the page,
 * and a line of script brings the current tab into view; with the kit's own two, neither is there.
 * From SIDEBAR_FROM tabs, or as soon as an extension groups them, the sections leave the header for
 * a sidebar (sideNav below), unless a page of the build has a sidebar of its own (sidebarNav). A page
 * holding a tick box gets the boxes' script (components.mjs ▸ checkboxScript).
 */
export function shell({ data, depth, tab, title, body, before = '' }) {
  const base = '../'.repeat(depth);
  const all = tabs();
  const side = sidebarNav();
  const many = !side && all.length > 2;
  const link = ([to, key]) => `<a href="${base}${to}"${to === tab ? ' aria-current="page" class="on"' : ''}>${label(key)}</a>`;
  // Groups kept in a row (a build whose pages have their own sidebar): the groups' order, a rule between them.
  const row = !side && chrome?.groups?.length
    ? navGroups().map((g) => g.tabs.map(link).join('')).join('<span class="tab-sep" aria-hidden="true"></span>')
    : all.map(link).join('');
  const when = new Date(data.generated).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
  const ticks = /data-todo-source=/.test(body) || /data-todo-source=/.test(before);
  return `<!doctype html>
<html lang="${locale().slice(0, 2)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title ? `${title} · ${data.org}` : data.org)}</title>
<link rel="stylesheet" href="${base}tokens.css">
<link rel="stylesheet" href="${base}intranet.css">
</head>
<body${side ? ' class="has-nav"' : ''}>
${side ? sideNav({ data, base, tab, link }) : `<header class="top${many ? ' many' : ''}"><div class="wrap top-in">
  <a class="mark" href="${base}">${esc(data.org)}</a>
  <nav class="tabs" aria-label="Sections">${row}</nav>
</div></header>`}
${many ? `<script>
  // The row of tabs scrolls sideways on a phone: start it with the current tab in view.
  (() => {
    const n = document.querySelector('.top .tabs'), a = n && n.querySelector('[aria-current]');
    if (a && n.scrollWidth > n.clientWidth) n.scrollLeft = a.offsetLeft - (n.clientWidth - a.offsetWidth) / 2;
  })();
</script>
` : ''}${before}
${body}
<footer class="wrap foot">
  <p>${esc(t('foot.built', when))}</p>
  <p><a href="/cdn-cgi/access/logout">${t('foot.signout')}</a></p>
</footer>
${withNews ? `<script src="${base}badges.js" data-base="${base}" data-label="${esc(t('badge.new'))}" defer></script>\n` : ''}${ticks ? `${checkboxScript()}\n` : ''}</body>
</html>
`;
}

/**
 * The sections as a sidebar: a column down the left side on a wide screen, the organization's name
 * at its top, the sections under their group headings; on a phone, a bar with the name and one menu
 * that names the current section and opens the same list. The two navs carry the same links, since
 * only one shows at a time and a page must work without script.
 */
function sideNav({ data, base, tab, link }) {
  const groups = navGroups().map((g) => `<div class="nav-group">${g.label ? `<p class="nav-group-label">${esc(label(g.label))}</p>` : ''}${g.tabs.map(link).join('')}</div>`).join('');
  const here = tabs().find(([to]) => to === tab);
  return `<aside class="nav-side"><a class="mark" href="${base}">${esc(data.org)}</a><nav aria-label="Sections">${groups}</nav></aside>
<header class="top nav-bar"><div class="wrap top-in">
  <a class="mark" href="${base}">${esc(data.org)}</a>
  <details class="nav-fold"><summary>${here ? label(here[1]) : t('nav.menu')}</summary><nav aria-label="Sections">${groups}</nav></details>
</div></header>`;
}

/**
 * A section's pages beside the page: a sidebar on a wide screen, one folded control above the title
 * on a phone (webapp.md ▸ One row of tabs, then a sidebar). `links` are { to, label } with `to` a
 * path from the root; `sub: true` indents a link under the one before it, and `group: true` makes
 * the entry a heading rather than a link. `current` is the path of the page shown; `fold` names the
 * folded control when it should differ from `label`.
 */
export function withSide({ label: name, fold = name, links, current }, base, inner) {
  const nav = links.map((l) => (l.group
    ? `<span class="side-group">${esc(l.label)}</span>`
    : `<a href="${base}${esc(l.to)}"${l.to === current ? ' aria-current="page"' : ''}${l.sub ? ' class="sub"' : ''}>${esc(l.label)}</a>`)).join('');
  const here = links.find((l) => !l.group && l.to === current)?.label ?? name;
  return `<div class="wrap with-side"><aside class="side" aria-label="${esc(name)}"><nav>${nav}</nav></aside><main><details class="side-fold"><summary>${esc(fold)} · ${esc(here)}</summary><nav>${nav}</nav></details>${inner}</main></div>`;
}

// ---------------------------------------------------------------- pages

/** Where an extension may place sections on the home page, top to bottom. */
export const HOME_SLOTS = ['top', 'before-tools', 'end'];

/**
 * The home page. `slots` holds an extension's sections as HTML, by slot: `top` under the banner and
 * above the numbers, `before-tools` after the kit's dashboards, `end` last in the page. `hide` lists
 * the kit's sections the extension replaces (HIDE_KEYS); 'home.projects' takes the empty state and
 * the line naming private repos with it, since both stand in for the project cards.
 */
export function homePage({ data, home, tools, today, slots = {}, hide = [] }) {
  const base = '';
  const s = stats(data.projects, today);
  const parts = [];
  const shown = (key) => !hide.includes(key);
  const slot = (name) => { for (const html of slots[name] || []) if (html) parts.push(html); };
  slot('top');
  if (!data.projects.length) {
    if (shown('home.projects')) parts.push(`<p class="empty">${esc(t('home.empty'))}</p>`);
  } else {
    if (shown('home.tiles')) parts.push(tiles(s));
    const who = shown('home.waiting') ? waiting(data.projects, today) : [];
    if (who.length) {
      parts.push(`<h2 id="waiting">${t('home.waiting')}</h2><p class="note">${t('home.waitingNote')}</p>
<div class="people">${who.map((w) => `<article class="card">
  <div class="card-top"><h3>${w.who ? `@${esc(w.who)}` : t('who.nobody')}</h3><span class="count">${w.items.length}</span></div>
  <ul class="todo">${w.items.slice(0, 5).map((i) => todoRow(i, today, { project: i.project, base })).join('')}</ul>
  ${w.items.length > 5 ? `<small>${t('who.more', w.items.length - 5)}</small>` : ''}
</article>`).join('')}</div>`);
    }
    if (shown('home.projects')) parts.push(`<h2 id="projects">${t('home.projects')}</h2><div class="cards">${data.projects.map((p) => projectCard(p, base, today)).join('')}</div>`);
    if (data.recap.length && shown('home.moved')) parts.push(`<h2 id="moved">${t('home.moved')}</h2>${feed(data.recap, base)}`);
  }
  slot('before-tools');
  if (shown('home.tools')) parts.push(toolCards(tools, base));
  if (data.private?.length && shown('home.projects')) parts.push(`<p class="empty">${esc(t('projects.private', data.private.join(', ')))}</p>`);
  slot('end');
  return shell({ data, depth: 0, tab: '', title: null, before: banner(home, data.org), body: `<main class="wrap">${parts.join('\n')}</main>` });
}

function projectsSide(data, current) {
  return {
    label: t('projects.title'),
    fold: t('nav.projects'),
    current: current || 'projects/',
    links: [{ to: 'projects/', label: t('projects.all') }]
      .concat(data.projects.filter((p) => p.page).map((p) => ({ to: p.page, label: p.title }))),
  };
}

/** Whether the Projects section has pages to list beside the page: one link to itself is no sidebar. */
const projectsSided = (data) => data.projects.some((p) => p.page);

export function projectsPage({ data, today }) {
  const base = '../';
  const inner = `<h1>${t('projects.title')}</h1>
${data.projects.length ? `<div class="cards">${data.projects.map((p) => projectCard(p, base, today)).join('')}</div>` : `<p class="empty">${esc(t('home.empty'))}</p>`}
${data.private?.length ? `<p class="empty">${esc(t('projects.private', data.private.join(', ')))}</p>` : ''}`;
  const body = projectsSided(data) ? withSide(projectsSide(data, null), base, inner) : `<main class="wrap">${inner}</main>`;
  return shell({ data, depth: 1, tab: 'projects/', title: t('projects.title'), body });
}

export function projectPage({ data, project: p, today }) {
  const base = '../../';
  const total = p.counts.open + p.counts.done;
  const pct = total ? Math.round((p.counts.done / total) * 100) : 0;
  const inner = `<div class="page-head"><h1>${esc(p.title)}</h1>${p.stage ? `<span class="pill${p.stage === 'active' ? ' on' : ''}">${esc(p.stage)}</span>` : ''}</div>
${total ? `<div class="meter wide" role="img" aria-label="${pct}%"><i style="width:${pct}%"></i></div>` : ''}
<p class="note">${total ? t('card.counts', p.counts.open, p.counts.done) : t('card.nothing')}</p>
${p.countsOnly ? `<p class="empty">${t('card.private')}</p>` : `
<h2>${t('projects.open')}</h2>
${p.open.length ? `<ul class="todo big">${p.open.map((i) => todoRow(i, today, { notes: true })).join('')}</ul>` : `<p class="note">${t('projects.noOpen')}</p>`}
${(p.log || []).length ? `<h2>${t('projects.moved')}</h2>${feed(p.log, base)}` : ''}`}`;
  return shell({ data, depth: 2, tab: 'projects/', title: p.title, body: withSide(projectsSide(data, p.page), base, inner) });
}

/**
 * Every file of the built intranet, as { path: contents }. `extension` is what an instance's
 * extension registered (apps/dashboard/extend.mjs ▸ loadExtension); without one the output is the
 * kit's own, byte for byte.
 */
/** A short, stable key for an item of news: identifiers only reach the viewer's browser storage. */
const keyOf = (s) => { let h = 5381; for (const c of String(s)) h = ((h * 33) ^ c.codePointAt(0)) >>> 0; return h.toString(36); };

/**
 * What the tab badges count, as [{ key, href, date }]: every dated entry of a project's log that has a
 * page (data.recap), and what an extension adds with intranet.news(). An item without an href or a
 * date is dropped, since no tab could own it and no visit could clear it.
 */
export function newsItems(data, extra = []) {
  const recap = (data.recap || []).filter((r) => r.page && r.date)
    .map((r) => ({ key: keyOf(`${r.date}|${r.page}|${r.text}`), href: r.page, date: r.date }));
  const more = extra.filter((x) => x && x.href && x.date).map((x) => ({ key: String(x.key || keyOf(`${x.date}|${x.href}`)), href: String(x.href), date: String(x.date) }));
  return [...recap, ...more];
}

export function renderIntranet({ data, home, tools, css, today = new Date().toISOString().slice(0, 10), extension = null }) {
  chrome = extension ? { tabs: extension.tabs, groups: extension.groups, strings: extension.strings, hide: extension.hide, locale: extension.locale || null } : null;
  try {
    const ctx = (path) => extension.context({ data, today, path });
    // The extension's pages render first: whether any has a sidebar of its own decides, for every
    // page, whether the sections may be a sidebar too (sidebarNav).
    const rendered = (extension?.pages || []).map((pg) => ({ pg, out: pg.render(ctx(pg.path)) }));
    if (chrome) chrome.sided = projectsSided(data) || rendered.some(({ out }) => out && typeof out === 'object' && out.side);
    const news = newsItems(data, (extension?.news || []).flatMap((fn) => fn(ctx('')) || []));
    withNews = news.length > 0;
    const slots = {};
    for (const [name, renders] of Object.entries(extension?.home || {})) slots[name] = renders.map((render) => render(ctx('')));
    const files = {
      'index.html': homePage({ data, home, tools, today, slots, hide: extension?.hide || [] }),
      'projects/index.html': projectsPage({ data, today }),
      'intranet.css': extension?.css.length ? `${css}${extension.css.map((c) => `\n/* ---- ${c.from} ---- */\n${c.text}`).join('')}` : css,
    };
    for (const p of data.projects.filter((x) => x.page)) files[`${p.page}index.html`] = projectPage({ data, project: p, today });
    for (const { pg, out } of rendered) {
      const file = pg.path.endsWith('/') || pg.path === '' ? `${pg.path}index.html` : pg.path;
      if (file in files) throw new Error(`intranet extension: ${file} is already a page of the kit's; give yours another path`);
      files[file] = pageFrom(pg, file, out, data);
    }
    if (withNews) {
      files['news.json'] = `${JSON.stringify({ today, items: news })}\n`;
      files['badges.js'] = readFileSync(new URL('./badges.js', import.meta.url), 'utf8');
    }
    if (baseLang(locale()) === 'fr') for (const f of Object.keys(files)) if (f.endsWith('.html')) files[f] = typeset(files[f], 'fr');
    return files;
  } finally {
    chrome = null;
    withNews = false;
  }
}

/** An extension's page: its render gave a whole file (a string) or { title, body, side, tab }. */
function pageFrom(pg, file, out, data) {
  if (typeof out === 'string') return out;
  if (!out || typeof out.body !== 'string') throw new Error(`intranet extension: the page ${pg.path} rendered no body`);
  const depth = file.split('/').length - 1;
  const base = '../'.repeat(depth);
  const tab = out.tab ?? tabs().map(([to]) => to).filter((to) => to && pg.path.startsWith(to)).sort((a, b) => b.length - a.length)[0] ?? null;
  const body = out.side
    ? withSide({ current: pg.path, ...out.side }, base, out.body)
    : `<main class="wrap">${out.body}</main>`;
  return shell({ data, depth, tab, title: out.title ?? null, body });
}

// Tags, and the elements whose text is code or script: their insides are never typeset.
const RAW = /^<(script|style|code|pre|textarea)\b/i;

/**
 * The typography of a language applied to the text of an HTML page, never to its tags, attributes,
 * URLs or to what sits in <script>, <style>, <code>, <pre> or <textarea>. In French
 * (scripts/deck/text.mjs ▸ typo, the documents' and decks' own rule) a no-break space goes before
 * : ; ? ! and inside « », and between the groups of a large number, so a line never starts with a
 * sign or splits a figure. Any other language is returned as it came, byte for byte.
 */
export function typeset(html, lang = locale()) {
  if (baseLang(lang) !== 'fr') return html;
  const out = [];
  let raw = null; // the element whose end closes a stretch left as is
  for (const part of String(html).split(/(<!--[\s\S]*?-->|<[^>]*>)/)) {
    if (part.startsWith('<')) {
      if (!raw) { const m = part.match(RAW); if (m) raw = m[1].toLowerCase(); }
      else if (part.toLowerCase().startsWith(`</${raw}`)) raw = null;
      out.push(part);
    } else out.push(raw ? part : typo(part, lang));
  }
  return out.join('');
}
