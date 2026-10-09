// The viewer. One slide at a time, scaled to the window like a presentation program.
//   → ← space, Page Up/Down, Home/End · O overview · N notes · F fullscreen · P print to PDF
//   #7 opens slide 7, #some-id opens the slide with that id · swipe on a touch screen
// ?check lays every slide out at full size, one under the other, for the deck checker.
(() => {
  const html = document.documentElement;
  if (new URLSearchParams(location.search).has('check')) { html.classList.add('dk-check'); return; }

  const app = document.getElementById('dk');
  const stage = document.getElementById('dk-stage');
  const wrap = stage.parentElement;
  const slides = [...stage.querySelectorAll(':scope > .dk-slide')];
  const n = slides.length;
  if (!n) return;
  const $ = (s) => app.querySelector(s);
  const t = JSON.parse(app.dataset.strings || '{}');

  const fit = () => {
    const r = wrap.getBoundingClientRect();
    const margin = document.fullscreenElement ? 0 : r.width < 720 ? 8 : 28;
    const scale = Math.max(0.05, Math.min((r.width - margin) / 1280, (r.height - margin) / 720));
    stage.style.setProperty('--dk-scale', scale.toFixed(4));
  };
  new ResizeObserver(fit).observe(wrap);
  fit();

  // The overview: every slide as a thumbnail, grouped by chapter. Built once, on first open.
  const overview = $('.dk-overview');
  let built = false;
  const buildOverview = () => {
    if (built) return;
    built = true;
    let last = null;
    slides.forEach((s, i) => {
      const ch = s.dataset.chapter || '';
      if (ch && ch !== last) {
        const h = document.createElement('p');
        h.className = 'dk-thumb-chapter';
        h.textContent = ch;
        overview.append(h);
      }
      last = ch;
      const b = document.createElement('button');
      b.className = 'dk-thumb';
      b.dataset.go = String(i);
      const f = document.createElement('span');
      f.className = 'dk-thumb-frame';
      const c = s.cloneNode(true);
      c.removeAttribute('id');
      c.removeAttribute('data-active');
      c.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
      f.append(c);
      const l = document.createElement('span');
      l.textContent = `${i + 1}. ${s.dataset.title || ''}`;
      b.append(f, l);
      overview.append(b);
    });
  };

  let cur = 0;
  const go = (i, { push = false } = {}) => {
    cur = Math.max(0, Math.min(n - 1, i));
    slides.forEach((s, j) => s.toggleAttribute('data-active', j === cur));
    const s = slides[cur];
    $('.dk-progress i').style.width = `${((cur + 1) / n) * 100}%`;
    $('.dk-count').textContent = `${cur + 1} / ${n}`;
    $('.dk-chrome-chapter').textContent = s.dataset.chapter || s.dataset.title || '';
    $('.dk-notes-panel').textContent = s.querySelector('.dk-notes')?.textContent.trim() || t.noNotes || '';
    overview.querySelectorAll('.dk-thumb').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.go) === cur)));
    const hash = s.id ? `#${s.id}` : `#${cur + 1}`;
    if (location.hash !== hash) history[push ? 'pushState' : 'replaceState'](null, '', hash);
  };

  const toggle = (attr, force) => {
    const on = force ?? !app.hasAttribute(attr);
    app.toggleAttribute(attr, on);
    app.querySelectorAll(`[data-toggles="${attr}"]`).forEach((b) => b.setAttribute('aria-pressed', String(on)));
    if (attr === 'data-overview' && on) { buildOverview(); overview.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' }); }
    requestAnimationFrame(fit);
  };
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : html.requestFullscreen?.());
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(fit));

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-go], [data-act]');
    if (!el) return;
    if (el.dataset.go != null) { go(Number(el.dataset.go), { push: true }); toggle('data-overview', false); return; }
    ({ next: () => go(cur + 1), prev: () => go(cur - 1), overview: () => toggle('data-overview'), notes: () => toggle('data-notes'), full: fullscreen, print: () => window.print() })[el.dataset.act]?.();
  });
  // A click on the slide itself moves forward, on its left fifth back; a click on a link does not.
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, [data-no-nav]')) return;
    const r = wrap.getBoundingClientRect();
    go(cur + (e.clientX - r.left < r.width / 5 ? -1 : 1));
  });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(k)) { e.preventDefault(); go(cur + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); go(cur - 1); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(n - 1);
    else if (k === 'o' || k === 'O') toggle('data-overview');
    else if (k === 'n' || k === 'N') toggle('data-notes');
    else if (k === 'f' || k === 'F') fullscreen();
    else if (k === 'p' || k === 'P') window.print();
    else if (k === 'Escape') toggle('data-overview', false);
  });

  let x0 = null;
  wrap.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  const fromHash = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return 0;
    const byId = slides.findIndex((s) => s.id === h);
    if (byId >= 0) return byId;
    const k = parseInt(h, 10);
    return Number.isFinite(k) ? k - 1 : 0;
  };
  window.addEventListener('hashchange', () => go(fromHash()));
  window.addEventListener('popstate', () => go(fromHash()));
  go(fromHash());
})();
