// The paginator: pours a document's blocks into real A4 pages, in the browser.
//
// Every page carries the running head and an "n / N" footer, the footer always at the bottom.
// Blocks go in one at a time; a block that no longer fits moves to the next page. A list, a
// description list or a table is cut between two items, never inside one, and a table repeats its
// header. A heading never ends a page, nor does a sentence ending in a colon: both leave with what
// they announce. Pages have a physical size, so the screen shows what the printer will produce.
//
// Inlined into each built document by scripts/doc/build.mjs; no dependency.

(function () {
  const HEADING = /^H[2-4]$/;
  const SPLITTABLE = new Set(['UL', 'OL', 'DL', 'TABLE']);
  const announces = (el) => HEADING.test(el.tagName) || (el.tagName === 'P' && /:\s*$/.test(el.textContent));

  function makePage(root) {
    const page = document.createElement('section');
    page.className = 'doc-page';
    if (root.hasAttribute('data-onepager')) page.classList.add('is-onepager');
    page.innerHTML = '<header class="doc-page-run"><span class="doc-page-mark"><i></i><span></span></span><span class="doc-page-kicker"></span></header>'
      + '<div class="doc-page-body doc-prose"></div>'
      + '<footer class="doc-page-foot"><span class="doc-page-left"></span><span class="doc-page-num"></span></footer>';
    page.querySelector('.doc-page-mark span').textContent = root.dataset.mark || '';
    page.querySelector('.doc-page-kicker').textContent = root.dataset.kicker || '';
    page.querySelector('.doc-page-left').textContent = root.dataset.foot || '';
    return page;
  }

  /** Cuts a list or a table: what fits stays, the rest goes to the next page. */
  function split(el, body, fits) {
    if (!SPLITTABLE.has(el.tagName)) return null;
    const from = el.tagName === 'TABLE' ? el.tBodies[0] : el;
    if (!from || from.children.length < 2) return null;
    const head = el.cloneNode(false);
    let into = head;
    if (el.tagName === 'TABLE') {
      if (el.tHead) head.append(el.tHead.cloneNode(true));
      into = document.createElement('tbody');
      head.append(into);
    }
    body.append(head);
    let moved = 0;
    while (from.firstElementChild) {
      const item = from.firstElementChild;
      into.append(item);
      if (!fits()) { from.prepend(item); break; }
      moved++;
    }
    if (!moved) { head.remove(); return null; }
    if (el.tagName === 'OL') el.setAttribute('start', String(Number(head.getAttribute('start') || 1) + moved));
    head.remove();
    return [head, from.children.length ? el : null];
  }

  function paginate(root) {
    const flow = root.querySelector('.doc-flow');
    const pages = root.querySelector('.doc-pages');
    if (!flow || !pages) return;
    pages.style.zoom = '1';
    pages.innerHTML = '';
    const queue = [...flow.children].map((n) => n.cloneNode(true));
    let page = makePage(root);
    pages.append(page);
    let body = page.querySelector('.doc-page-body');
    const fits = () => body.scrollHeight <= body.clientHeight + 1 && body.scrollWidth <= body.clientWidth + 1;
    const next = () => { page = makePage(root); pages.append(page); body = page.querySelector('.doc-page-body'); };

    while (queue.length) {
      const block = queue.shift();
      // A page break asked for (:::pagebreak): what follows starts a new page, unless the page is
      // still empty or nothing follows. The marker itself goes on no page.
      if (block.hasAttribute('data-pagebreak')) { if (body.children.length && queue.length) next(); continue; }
      body.append(block);
      if (fits()) continue;
      block.remove();

      const parts = split(block, body, fits);
      if (parts) {
        body.append(parts[0]);
        if (parts[1]) queue.unshift(parts[1]);
      } else if (!body.children.length) {
        // Taller than a page on its own: placed anyway, and flagged for the check.
        body.append(block);
        block.setAttribute('data-overflow', '');
        console.warn('paged: a block is taller than a page', block.textContent.slice(0, 60));
        continue;
      } else {
        queue.unshift(block);
      }

      const carried = [];
      while (body.children.length > 1 && announces(body.lastElementChild)) {
        const h = body.lastElementChild;
        h.remove();
        carried.unshift(h);
      }
      queue.unshift(...carried);
      if (!queue.length) break;
      next();
    }

    const all = [...pages.children];
    all.forEach((p, i) => { p.querySelector('.doc-page-num').textContent = `${i + 1} / ${all.length}`; });
    root.dataset.overflow = String(pages.querySelectorAll('[data-overflow]').length);
    root.dataset.pages = String(all.length);
    fit(root);
  }

  /** On screen the pages shrink to the window's width; in print they are at 100%. */
  function fit(root) {
    const pages = root.querySelector('.doc-pages');
    const first = pages && pages.firstElementChild;
    if (!first) return;
    const z = Math.min(1, root.clientWidth / (first.offsetWidth + 2));
    pages.style.zoom = z < 1 ? z.toFixed(3) : '1';
  }

  const roots = [...document.querySelectorAll('.doc-paged')];
  const run = () => roots.forEach(paginate);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(run);
  addEventListener('resize', () => roots.forEach(fit));
  addEventListener('beforeprint', () => roots.forEach((r) => { r.querySelector('.doc-pages').style.zoom = '1'; }));
  addEventListener('afterprint', () => roots.forEach(fit));
})();
