// The viewer. One slide at a time, scaled to the window like a presentation program.
//   → ← space, Page Up/Down, Home/End · O overview · N notes · F fullscreen · P print to PDF
//   R plays the slide's animation again · #7 opens slide 7, #some-id the slide with that id ·
//   swipe on a touch screen
// ?check lays every slide out at full size, one under the other, for the deck checker.
//
// What moves on a slide moves only here, and only for a reader who did not ask for less motion
// (html.dk-live). Everything else, the check, the PDF, a page without script, shows the finished
// state the components write.
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
      // A thumbnail shows the finished state, whatever its slide was doing when the overview opened.
      c.querySelectorAll('.is-playing').forEach((e) => { e.classList.remove('is-playing'); delete e.dataset.step; });
      c.querySelectorAll('.on, .hit').forEach((e) => e.classList.remove('on', 'hit'));
      f.append(c);
      const l = document.createElement('span');
      l.textContent = `${i + 1}. ${s.dataset.title || ''}`;
      b.append(f, l);
      overview.append(b);
    });
  };

  // Blocks that play (agentic.mjs): their markup is the finished state. When their slide opens
  // they empty, then tell their story in beats and hold the end.
  //   data-play="300 1200"  when each beat lands, in ms after the slide opens (data-hit: how long
  //                         a flash lasts, data-hold: how long the end waits before it settles)
  //   [data-at="k"]         arrives at beat k (from 1): .on from then, .hit for a moment
  //   [data-hits="2 4"]     is there from the start, and flashes .hit at the beats it names
  //   [data-from][data-to]  a figure that counts from one to the other across the beats
  // The root carries .is-playing and data-step while it plays; its CSS says what "not yet" looks like.
  const motion = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (motion) html.classList.add('dk-live');
  const fmt = new Intl.NumberFormat(html.lang || 'en');
  const player = (root) => {
    const beats = root.dataset.play.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    const hitMs = Number(root.dataset.hit) || 900, hold = Number(root.dataset.hold) || 600;
    const arrivals = [...root.querySelectorAll('[data-at]')], touched = [...root.querySelectorAll('[data-hits]')];
    const marked = [...arrivals, ...touched];
    const figures = [...root.querySelectorAll('[data-from][data-to]')].map((el) => ({ el, final: el.textContent }));
    const timers = [];
    const clear = () => { while (timers.length) clearTimeout(timers.pop()); };
    const later = (f, ms) => timers.push(setTimeout(f, ms));
    const hitsAt = (el, k) => (el.dataset.at !== undefined ? Number(el.dataset.at) === k : el.dataset.hits.split(/\s+/).includes(String(k)));
    // No transition while it resets, so emptying it is not itself an animation.
    const instant = (f) => { root.classList.add('is-instant'); f(); void root.offsetWidth; root.classList.remove('is-instant'); };
    const at = (k) => {
      root.dataset.step = String(k);
      for (const el of arrivals) el.classList.toggle('on', Number(el.dataset.at) <= k);
      for (const el of marked) el.classList.toggle('hit', hitsAt(el, k));
      for (const { el } of figures) {
        const a = Number(el.dataset.from), z = Number(el.dataset.to);
        el.textContent = fmt.format(Math.round(a + ((z - a) * k) / Math.max(1, beats.length)));
      }
      if (k > 0) later(() => { for (const el of marked) if (hitsAt(el, k)) el.classList.remove('hit'); }, hitMs);
    };
    const finish = () => {
      clear();
      instant(() => {
        root.classList.remove('is-playing');
        delete root.dataset.step;
        for (const el of marked) el.classList.remove('on', 'hit');
        for (const { el, final } of figures) el.textContent = final;
      });
    };
    const play = () => {
      clear();
      instant(() => { root.classList.add('is-playing'); at(0); });
      beats.forEach((ms, k) => later(() => at(k + 1), ms));
      later(finish, (beats[beats.length - 1] ?? 0) + hold);
    };
    return { play, finish };
  };
  const players = slides.map((s) => [...s.querySelectorAll('[data-play]')].map(player));
  const finishAll = () => players.flat().forEach((p) => p.finish());
  window.addEventListener('beforeprint', finishAll);
  // A loop drawn in SVG (a pulse) starts again with its slide, on the clock of the CSS that lights its steps.
  const restart = (s) => s.querySelectorAll('svg').forEach((v) => { try { v.setCurrentTime?.(0); } catch { /* not an animated SVG */ } });
  const replay = () => { if (motion) players[cur].forEach((p) => p.play()); };

  let cur = 0;
  let shown = -1;
  const go = (i, { push = false } = {}) => {
    cur = Math.max(0, Math.min(n - 1, i));
    slides.forEach((s, j) => s.toggleAttribute('data-active', j === cur));
    const s = slides[cur];
    if (shown !== cur) {
      if (shown >= 0) players[shown].forEach((p) => p.finish());
      shown = cur;
      restart(s);
      replay();
    }
    const r = $('[data-act="replay"]');
    if (r) r.hidden = !(motion && players[cur].length);
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
    ({ next: () => go(cur + 1), prev: () => go(cur - 1), replay, overview: () => toggle('data-overview'), notes: () => toggle('data-notes'), full: fullscreen, print: () => window.print() })[el.dataset.act]?.();
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
    else if (k === 'r' || k === 'R') replay();
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
