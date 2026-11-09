// An invented extension, to show the shape of one and to test the extension point: a neighbourhood
// co-op that keeps a volunteer rota, a list of rooms and a notice board in its repository. Nothing
// here is anyone's real organization.
//
// A real instance writes its own at apps/intranet-extend/index.mjs (kit-sync never touches it);
// this one is built only when asked: node scripts/dashboard-data.mjs --extend=apps/dashboard/example-extension/index.mjs
//
// It reads four files, each optional, and every page says what fills it when the file is missing:
//   rota.md       one shift per line:  - 2026-11-02 · @sam · Opening shift
//   rooms.md      one room per line:   - Back room · 12 seats · free on Tuesdays
//   notices.md    a heading per notice, newest first
//   checklist.md  the opening checklist, a to-do file: - [ ] Check the fire exits due:2026-11 ^k3p9
//
// It uses the kit's components (components.mjs, `c.ui`): key-figure cards with a ring and a stacked
// bar on the home page, a compact Gantt chart in a card at the top of the rota, and tick boxes on the
// checklist, which save to the repository when the intranet's Worker runs the to-do app and
// TODO_SOURCES lists checklist.md under the id todoSourceId('checklist.md') (dashboard.md ▸ Tick boxes).

export default function extend(intranet) {
  const { read, esc, inline, renderMarkdown } = intranet;

  const shifts = read('rota.md').split('\n')
    .map((l) => l.match(/^\s*-\s+(\d{4}-\d{2}-\d{2})\s*·\s*@([\w-]+)\s*·\s*(.+?)\s*$/))
    .filter(Boolean)
    .map(([, date, who, what]) => ({ date, who, what }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const coming = shifts.filter((s) => s.date >= intranet.today);
  const unfilled = coming.filter((s) => s.who === 'nobody');
  const rooms = read('rooms.md').split('\n')
    .map((l) => l.match(/^\s*-\s+([^·]+?)\s*·\s*(.+?)\s*$/)).filter(Boolean)
    .map(([, name, about]) => ({ name, about }));
  const notices = read('notices.md').split(/^## /m).slice(1)
    .map((block) => { const [title, ...body] = block.split('\n'); return { title: title.trim(), body: body.join('\n').trim() }; });
  const checklist = intranet.todos('checklist.md').filter((i) => !i.struck);
  const ticked = checklist.filter((i) => i.done).length;

  intranet.strings({ 'nav.rota': 'Rota', 'nav.rooms': 'Rooms', 'nav.checklist': 'Checklist', 'nav.notices': 'Notices' });
  intranet.tab('rota/', 'nav.rota');
  intranet.tab('rooms/', 'nav.rooms');
  intranet.tab('checklist/', 'nav.checklist');
  intranet.tab('notices/', 'nav.notices', { after: 'projects/' });

  // The shifts and the checklist's dated lines on one chart: a row per volunteer, the shifts nobody
  // holds on a row of their own, the checklist on another.
  const planned = (c) => [
    ...shifts.map((s) => ({ start: s.date, text: s.what, group: s.who === 'nobody' ? 'To fill' : `@${s.who}`, kind: s.who === 'nobody' ? 'late' : 'event', href: c.href(s.who === 'nobody' ? 'rota/swaps/' : 'rota/') })),
    ...checklist.filter((i) => i.due).map((i) => ({ due: i.due, text: i.text, group: 'Checklist', kind: i.done ? 'done' : 'action', done: i.done, href: c.href('checklist/') })),
  ];

  const shiftList = (list) => (list.length
    ? `<ul class="todo big">${list.map((s) => `<li><span class="todo-text">${esc(s.what)}</span><em class="badge">${esc(s.date)}</em><em class="badge${s.who === 'nobody' ? ' strong' : ''}">${s.who === 'nobody' ? 'nobody yet' : `@${esc(s.who)}`}</em></li>`).join('')}</ul>`
    : '<p class="empty">No shift on the rota. Add one line per shift to <code>rota.md</code>: <code>- 2026-11-02 · @sam · Opening shift</code>.</p>');

  const rotaSide = {
    label: 'Rota',
    links: [{ to: 'rota/', label: 'Coming shifts' }, { to: 'rota/swaps/', label: 'Shifts to fill' }],
  };

  intranet.home('top', (c) => {
    const { kpi, ring, stackedBar, pct } = c.ui;
    const filled = coming.length - unfilled.length;
    return `<section class="coop-week">
<h2 id="this-week">This week at the co-op</h2>
<div class="ui-kpis">${kpi({
      visual: ring(pct(filled, coming.length), { sub: `${filled}/${coming.length}`, tone: unfilled.length ? 'warn' : 'ok' }),
      label: 'Shifts covered',
      line: stackedBar([{ n: filled, label: 'held', tone: 'ok' }, { n: unfilled.length, label: 'to fill', tone: 'late' }]),
      href: c.href(unfilled.length ? 'rota/swaps/' : 'rota/'),
      tone: unfilled.length ? 'late' : 'ok',
    })}${kpi({
      visual: ring(pct(ticked, checklist.length), { sub: `${ticked}/${checklist.length}`, tone: 'info' }),
      label: 'Opening checklist',
      line: checklist.length ? `${checklist.length - ticked} left to tick` : 'nothing listed yet',
      href: c.href('checklist/'),
    })}${kpi({ visual: `<b class="ui-big">${rooms.length}</b>`, label: rooms.length === 1 ? 'Room' : 'Rooms', href: c.href('rooms/') })}</div>
</section>`;
  });

  intranet.home('before-tools', (c) => (notices.length
    ? `<h2 id="notices">Latest notice</h2><article class="card coop-notice"><h3><a href="${c.href('notices/')}">${inline(notices[0].title)}</a></h3>${renderMarkdown(notices[0].body)}</article>`
    : ''));

  intranet.page('rota/', (c) => {
    const chart = c.ui.gantt(planned(c), { today: c.today, compact: true, weeks: 8 });
    return {
      title: 'Rota',
      side: rotaSide,
      body: `<h1>Coming shifts</h1>${chart ? `<section class="card coop-plan"><h2>The next eight weeks</h2>${chart}</section>` : ''}<p class="note">From <code>rota.md</code>, soonest first.</p>${shiftList(coming)}`,
    };
  });
  intranet.page('rota/swaps/', () => ({
    title: 'Shifts to fill',
    side: rotaSide,
    body: `<h1>Shifts to fill</h1><p class="note">A shift held by <code>@nobody</code> waits for a volunteer.</p>${shiftList(unfilled)}`,
  }));
  intranet.page('rooms/', () => ({
    title: 'Rooms',
    body: `<h1>Rooms</h1>${rooms.length
      ? `<div class="cards">${rooms.map((r) => `<article class="card"><h3>${esc(r.name)}</h3><small>${inline(r.about)}</small></article>`).join('')}</div>`
      : '<p class="empty">No room listed. Add one line per room to <code>rooms.md</code>.</p>'}`,
  }));
  intranet.page('checklist/', (c) => {
    const { checkbox, gauge, statusChip, initials, todoSourceId } = c.ui;
    const source = todoSourceId('checklist.md');
    const row = (i) => checkbox(i, source, {
      extra: `${i.due ? `<em class="badge">${esc(i.due)}</em>` : ''}${(i.owners || []).map((o) => initials(o)).join('')}${(i.tags || []).includes('decide') ? statusChip('to decide', 'late') : ''}`,
    });
    return {
      title: 'Checklist',
      body: `<h1>Opening checklist</h1>${checklist.length
        ? `<section class="card coop-list" data-group><div class="card-top"><h2>Before the doors open</h2><span class="count" data-count>${ticked}/${checklist.length}</span></div>${gauge(ticked, checklist.length)}<div class="ui-checks">${checklist.map(row).join('')}</div></section>`
        : '<p class="empty">Nothing on the checklist. Add one line per task to <code>checklist.md</code>: <code>- [ ] Check the fire exits</code>.</p>'}`,
    };
  });
  intranet.page('notices/', () => ({
    title: 'Notices',
    body: `<h1>Notices</h1>${notices.length
      ? notices.map((n) => `<article class="card coop-notice"><h3>${inline(n.title)}</h3>${renderMarkdown(n.body)}</article>`).join('')
      : '<p class="empty">No notice yet. Each <code>##</code> heading in <code>notices.md</code> is one.</p>'}`,
  }));

  intranet.css(new URL('./example.css', import.meta.url));
}
