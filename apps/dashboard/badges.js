// The badges on the tabs: on each tab, how many things are new for this viewer since their last visit
// to it, nothing at zero, cleared when the tab is opened. The intranet's build writes news.json (the
// recent entries of every project's log, plus what an extension adds with intranet.news), each item
// { key, href, date }; this file counts them per tab and draws the badge. Alerts keep their own,
// stricter signal: a badge says "something moved here", never "this needs you".
//
// Visits stay in this browser (localStorage `intranet.tabs.seen`): per tab, the date of the visit and
// the keys already seen, identifiers only, never a title. Storage may be refused (a private window):
// then every recent item counts, which is the honest answer for a viewer we cannot remember.
(() => {
  const FIRST_VISIT_DAYS = 7; // on a tab never visited, only what is less than a week old counts
  const MAX_KEYS = 400;
  const STORE = 'intranet.tabs.seen';

  /** The tab an item belongs to: the longest tab path its href starts with; the home tab ('') takes nothing. */
  function tabOf(href, paths) {
    let best = null;
    for (const p of paths) if (p && href.startsWith(p) && (best === null || p.length > best.length)) best = p;
    return best;
  }

  /** Per tab, what leads there and was not seen at its last visit. */
  function count(items, paths, seen = {}, { today = new Date().toISOString().slice(0, 10) } = {}) {
    const since = new Date(Date.parse(`${today}T00:00:00Z`) - FIRST_VISIT_DAYS * 864e5).toISOString().slice(0, 10);
    const n = Object.fromEntries(paths.map((p) => [p, 0]));
    for (const x of items) {
      const tab = tabOf(String(x.href || ''), paths);
      if (tab === null) continue;
      const v = seen[tab];
      if (v ? (v.keys || []).includes(x.key) : String(x.date || '') < since) continue;
      n[tab] += 1;
    }
    return n;
  }

  /** A visit to a tab: what leads there is seen; the most recent keys are kept. */
  function visit(seen, tab, items, paths, at = new Date().toISOString()) {
    const keys = items.filter((x) => tabOf(String(x.href || ''), paths) === tab).map((x) => x.key);
    const before = (seen[tab] && seen[tab].keys) || [];
    return { ...seen, [tab]: { at, keys: [...new Set([...keys, ...before])].slice(0, MAX_KEYS) } };
  }

  const api = { tabOf, count, visit, FIRST_VISIT_DAYS };
  // Outside a page (the tests), the functions are left on globalThis and nothing is drawn.
  if (typeof document === 'undefined') { globalThis.intranetBadges = api; return; }

  const me = document.currentScript;
  const base = (me && me.dataset.base) || '';
  const label = (me && me.dataset.label) || 'new';
  const navs = [...document.querySelectorAll('header.top .tabs, .nav-side nav, .nav-fold nav')];
  if (!navs.length) return;
  const root = new URL(base || './', location.href).pathname;
  const pathOf = (a) => { const p = new URL(a.getAttribute('href'), location.href).pathname; return p.startsWith(root) ? p.slice(root.length) : null; };
  const here = location.pathname.startsWith(root) ? location.pathname.slice(root.length) : '';
  fetch(`${base}news.json`, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((news) => {
    if (!news || !Array.isArray(news.items)) return;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { seen = {}; }
    for (const nav of navs) {
      const links = [...nav.querySelectorAll('a')].map((el) => ({ el, p: pathOf(el) })).filter((x) => x.p !== null);
      const paths = [...new Set(links.map((x) => x.p))];
      const current = tabOf(here, paths);
      if (current !== null) seen = visit(seen, current, news.items, paths);
      const n = count(news.items, paths, seen, { today: news.today });
      for (const { el, p } of links) {
        for (const old of el.querySelectorAll('.tab-n')) old.remove();
        if (!n[p] || p === current) continue;
        const b = document.createElement('span');
        b.className = 'tab-n';
        b.textContent = n[p] > 99 ? '99+' : String(n[p]);
        b.setAttribute('aria-label', `${n[p]} ${label}`);
        el.append(b);
      }
    }
    try { localStorage.setItem(STORE, JSON.stringify(seen)); } catch { /* refused: nothing remembered */ }
  }).catch(() => {});
})();
