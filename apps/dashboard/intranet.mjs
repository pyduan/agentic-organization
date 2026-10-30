// The intranet's pages, rendered at build time from the data scripts/dashboard-data.mjs gathers.
//
// Static HTML on purpose: the intranet is the first thing the setup publishes, minutes into the
// first session, and it must build with Node alone, before anything has been installed. Every page
// is complete without JavaScript; the only script remembers whether this viewer closed the banner.
//
// What is the owner's to edit lives in source/content/, never here:
//   intranet-home.md   the banner at the top of the home page (quickstart, how this works)
//   intranet-tools.md  the cards under "Tools", one line per app or page
// What this file holds is the shape: the words of the chrome (STRINGS, translated in one place, as
// in the company pack's intranet), the tabs, and the layout.
//
// Navigation follows source/formats/webapp.md ▸ One row of tabs, then a sidebar: the sections are
// tabs in the header; a section with several pages (Projects) lists them in a sidebar, which folds
// into one control above the title on a phone.

import { renderMarkdown, inline, esc, slugify } from '../../scripts/doc/markdown.mjs';
import { isOverdue } from '../../lib/todo.mjs';

export const LOCALE = 'en-GB';

export const STRINGS = {
  'nav.home': 'Home',
  'nav.projects': 'Projects',
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
};

const t = (key, ...args) => {
  const v = STRINGS[key];
  return typeof v === 'function' ? v(...args) : v;
};
const plural = (key, n) => STRINGS[key][n === 1 ? 0 : 1];

/** The sections, as [path from the root, label key]. One row of tabs, never two. */
export const TABS = [['', 'nav.home'], ['projects/', 'nav.projects']];

// ---------------------------------------------------------------- the owner's words

/**
 * The banner, from source/content/intranet-home.md: the first `#` heading is its title, what sits
 * between it and the first `##` its lede, and each `##` section a column. HTML comments are notes
 * for the agent and never shown. An empty or missing file gives no banner.
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

const day = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });

function todoRow(item, today, { project = null, base = '', notes = false } = {}) {
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

function projectCard(p, base, today) {
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

function tiles(s) {
  const tile = (n, key) => `<div class="tile"><b>${n}</b><span>${plural(key, n)}</span></div>`;
  return `<div class="tiles">${tile(s.running, 'tiles.running')}${tile(s.open, 'tiles.open')}${tile(s.late, 'tiles.late')}${tile(s.decide, 'tiles.decide')}</div>`;
}

function feed(entries, base) {
  return `<div class="feed">${entries.map((r) => `<div><small>${day(r.date)}</small><span>${r.project
    ? `<b>${r.page ? `<a href="${base}${esc(r.page)}">${esc(r.project)}</a>` : esc(r.project)}</b> · ` : ''}${esc(r.text)}</span></div>`).join('')}</div>`;
}

function banner(home) {
  if (!home) return '';
  const cols = home.sections.map((s) => `<section id="${esc(s.id)}"><h2>${inline(s.heading)}</h2>${renderMarkdown(s.body)}</section>`).join('');
  return `<details class="banner" id="start" open>
  <summary><span class="wrap banner-head"><span class="banner-title">${inline(home.title || '')}</span><span class="banner-toggle" data-hide="${t('banner.hide')}" data-show="${t('banner.show')}"></span></span></summary>
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

function shell({ data, depth, tab, title, body, before = '' }) {
  const base = '../'.repeat(depth);
  const tabs = TABS.map(([to, key]) => `<a href="${base}${to}"${to === tab ? ' aria-current="page" class="on"' : ''}>${t(key)}</a>`).join('');
  const when = new Date(data.generated).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
  return `<!doctype html>
<html lang="${LOCALE.slice(0, 2)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title ? `${title} · ${data.org}` : data.org)}</title>
<link rel="stylesheet" href="${base}tokens.css">
<link rel="stylesheet" href="${base}intranet.css">
</head>
<body>
<header class="top"><div class="wrap top-in">
  <a class="mark" href="${base}">${esc(data.org)}</a>
  <nav class="tabs" aria-label="Sections">${tabs}</nav>
</div></header>
${before}
${body}
<footer class="wrap foot">
  <p>${esc(t('foot.built', when))}</p>
  <p><a href="/cdn-cgi/access/logout">${t('foot.signout')}</a></p>
</footer>
</body>
</html>
`;
}

// ---------------------------------------------------------------- pages

export function homePage({ data, home, tools, today }) {
  const base = '';
  const s = stats(data.projects, today);
  const parts = [];
  if (!data.projects.length) {
    parts.push(`<p class="empty">${esc(t('home.empty'))}</p>`);
  } else {
    parts.push(tiles(s));
    const who = waiting(data.projects, today);
    if (who.length) {
      parts.push(`<h2 id="waiting">${t('home.waiting')}</h2><p class="note">${t('home.waitingNote')}</p>
<div class="people">${who.map((w) => `<article class="card">
  <div class="card-top"><h3>${w.who ? `@${esc(w.who)}` : t('who.nobody')}</h3><span class="count">${w.items.length}</span></div>
  <ul class="todo">${w.items.slice(0, 5).map((i) => todoRow(i, today, { project: i.project, base })).join('')}</ul>
  ${w.items.length > 5 ? `<small>${t('who.more', w.items.length - 5)}</small>` : ''}
</article>`).join('')}</div>`);
    }
    parts.push(`<h2 id="projects">${t('home.projects')}</h2><div class="cards">${data.projects.map((p) => projectCard(p, base, today)).join('')}</div>`);
    if (data.recap.length) parts.push(`<h2 id="moved">${t('home.moved')}</h2>${feed(data.recap, base)}`);
  }
  parts.push(toolCards(tools, base));
  if (data.private?.length) parts.push(`<p class="empty">${esc(t('projects.private', data.private.join(', ')))}</p>`);
  return shell({ data, depth: 0, tab: '', title: null, before: banner(home), body: `<main class="wrap">${parts.join('\n')}</main>` });
}

function sideNav(data, current, base) {
  const pages = data.projects.filter((p) => p.page);
  const links = [`<a href="${base}projects/"${current ? '' : ' aria-current="page"'}>${t('projects.all')}</a>`]
    .concat(pages.map((p) => `<a href="${base}${esc(p.page)}"${current === p.page ? ' aria-current="page"' : ''}>${esc(p.title)}</a>`))
    .join('');
  const here = current ? data.projects.find((p) => p.page === current)?.title : t('projects.all');
  return {
    aside: `<aside class="side" aria-label="${t('projects.title')}"><nav>${links}</nav></aside>`,
    fold: `<details class="side-fold"><summary>${t('nav.projects')} · ${esc(here)}</summary><nav>${links}</nav></details>`,
  };
}

function withSide(data, current, base, inner) {
  const nav = sideNav(data, current, base);
  return `<div class="wrap with-side">${nav.aside}<main>${nav.fold}${inner}</main></div>`;
}

export function projectsPage({ data, today }) {
  const base = '../';
  const inner = `<h1>${t('projects.title')}</h1>
${data.projects.length ? `<div class="cards">${data.projects.map((p) => projectCard(p, base, today)).join('')}</div>` : `<p class="empty">${esc(t('home.empty'))}</p>`}
${data.private?.length ? `<p class="empty">${esc(t('projects.private', data.private.join(', ')))}</p>` : ''}`;
  return shell({ data, depth: 1, tab: 'projects/', title: t('projects.title'), body: withSide(data, null, base, inner) });
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
  return shell({ data, depth: 2, tab: 'projects/', title: p.title, body: withSide(data, p.page, base, inner) });
}

/** Every file of the built intranet, as { path: contents }. */
export function renderIntranet({ data, home, tools, css, today = new Date().toISOString().slice(0, 10) }) {
  const files = {
    'index.html': homePage({ data, home, tools, today }),
    'projects/index.html': projectsPage({ data, today }),
    'intranet.css': css,
  };
  for (const p of data.projects.filter((x) => x.page)) files[`${p.page}index.html`] = projectPage({ data, project: p, today });
  return files;
}
