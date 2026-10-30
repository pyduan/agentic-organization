// An invented extension, to show the shape of one and to test the extension point: a neighbourhood
// co-op that keeps a volunteer rota, a list of rooms and a notice board in its repository. Nothing
// here is anyone's real organization.
//
// A real instance writes its own at apps/intranet-extend/index.mjs (kit-sync never touches it);
// this one is built only when asked: node scripts/dashboard-data.mjs --extend=apps/dashboard/example-extension/index.mjs
//
// It reads three files, each optional, and every page says what fills it when the file is missing:
//   rota.md      one shift per line:  - 2026-11-02 · @sam · Opening shift
//   rooms.md     one room per line:   - Back room · 12 seats · free on Tuesdays
//   notices.md   a heading per notice, newest first

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

  intranet.strings({ 'nav.rota': 'Rota', 'nav.rooms': 'Rooms', 'nav.notices': 'Notices' });
  intranet.tab('rota/', 'nav.rota');
  intranet.tab('rooms/', 'nav.rooms');
  intranet.tab('notices/', 'nav.notices', { after: 'projects/' });

  const shiftList = (list) => (list.length
    ? `<ul class="todo big">${list.map((s) => `<li><span class="todo-text">${esc(s.what)}</span><em class="badge">${esc(s.date)}</em><em class="badge${s.who === 'nobody' ? ' strong' : ''}">${s.who === 'nobody' ? 'nobody yet' : `@${esc(s.who)}`}</em></li>`).join('')}</ul>`
    : '<p class="empty">No shift on the rota. Add one line per shift to <code>rota.md</code>: <code>- 2026-11-02 · @sam · Opening shift</code>.</p>');

  const rotaSide = {
    label: 'Rota',
    links: [{ to: 'rota/', label: 'Coming shifts' }, { to: 'rota/swaps/', label: 'Shifts to fill' }],
  };

  intranet.home('top', (c) => `<section class="coop-week">
<h2 id="this-week">This week at the co-op</h2>
<div class="tiles">${c.tile(coming.length, coming.length === 1 ? 'shift coming' : 'shifts coming')}${c.tile(unfilled.length, unfilled.length === 1 ? 'shift to fill' : 'shifts to fill', unfilled.length ? `<a href="${c.href('rota/swaps/')}">Who can take one?</a>` : '')}${c.tile(rooms.length, rooms.length === 1 ? 'room' : 'rooms')}</div>
</section>`);

  intranet.home('before-tools', (c) => (notices.length
    ? `<h2 id="notices">Latest notice</h2><article class="card coop-notice"><h3><a href="${c.href('notices/')}">${inline(notices[0].title)}</a></h3>${renderMarkdown(notices[0].body)}</article>`
    : ''));

  intranet.page('rota/', () => ({
    title: 'Rota',
    side: rotaSide,
    body: `<h1>Coming shifts</h1><p class="note">From <code>rota.md</code>, soonest first.</p>${shiftList(coming)}`,
  }));
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
  intranet.page('notices/', () => ({
    title: 'Notices',
    body: `<h1>Notices</h1>${notices.length
      ? notices.map((n) => `<article class="card coop-notice"><h3>${inline(n.title)}</h3>${renderMarkdown(n.body)}</article>`).join('')
      : '<p class="empty">No notice yet. Each <code>##</code> heading in <code>notices.md</code> is one.</p>'}`,
  }));

  intranet.css(new URL('./example.css', import.meta.url));
}
