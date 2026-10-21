// The blocks of a deck about an agentic organization: a shared base that learns in a loop, the
// views rebuilt from one source, a correction that redraws a figure and writes its rule, the chain
// of intermediaries before and the agents now, the levels of working with AI, what people see and
// what runs under it, the rules that learn as cases arrive, and the smaller shapes around them
// (the point a slide leaves, the sentences heard in every company, a stack of layers, a room
// surveyed, workshop tables, a folder tree, a remark that becomes a rule).
//
// Taken, as method and shapes only, from the decks of a consulting practice and the Bayes Impact
// intranet, where they were drawn for slides that show an organization run by agents. Every
// content is the deck's: the examples are in scripts/deck/examples/agentic-organization/.
//
// The same contract as every component (components.mjs): a schema, then render → HTML. Text stays
// HTML text, so the check measures every word (size, spill, contrast); SVG only draws the wires,
// the rings and the pulses, and is hidden from assistive technology. A diagram's horizontal
// positions are percentages of its block and its vertical ones pixels, so its wires (an SVG
// stretched to the block) and its boxes stay together on any brand's margins.
//
// What moves: the markup is always the finished state, which is what the check measures, the PDF
// prints, a reader without script sees and a reader who asked for less motion gets. Two kinds:
//   loops   (Cycle, Hub) run while their slide is shown, in CSS and SVG, under html.dk-live only
//   plays   (Regen, Redraw, LearnTree, Hub, FeedbackLoop) tell their story in beats when their
//           slide opens, then hold the end; R, or ↻ in the viewer's bar, plays them again.
//           data-play on the block lists when each beat lands; inside it, data-at="k" arrives at
//           beat k, data-hits="k j" flashes at those beats, data-from/data-to counts (engine.js).

export default ({ S, cls, when, esc }) => {
  const req = (t) => ({ ...t, required: true });
  const pct = (x, w) => `${((x / w) * 100).toFixed(3)}%`;
  const two = (i) => String(i + 1).padStart(2, '0');
  // A file as an agent writes it: its name, a few lines, and the line it adds.
  const FILE = S.obj({ name: req(S.str()), lines: S.list(S.text(), { max: 6 }), add: S.text() });
  // `at`: the beat its new line is written; `boxAt`: the beat the whole file arrives.
  const file = (ctx, f, { at, boxAt, cls: c = '' } = {}) => `<div class="${cls('dk-file', c)}"${boxAt ? ` data-at="${boxAt}"` : ''}>`
    + `<p class="dk-file-bar">${esc(f.name)}</p><div class="dk-file-code">`
    + (f.lines || []).map((l) => `<span class="dk-file-line">${ctx.md(l)}</span>`).join('')
    + when(f.add, (a) => `<span class="dk-file-line dk-file-add"${at ? ` data-at="${at}"` : ''}>${ctx.md(a)}</span>`)
    + '</div></div>';
  const cap = (ctx, text, fresh) => `<p class="dk-cap"><span>${ctx.md(text)}</span>${fresh ? `<em class="dk-fresh">${ctx.md(fresh)}</em>` : ''}</p>`;
  // Unique within a deck: the slide number, then the block's rank on it.
  let seq = 0;
  const uid = (ctx, k) => `dk-${k}-${ctx.n}-${++seq}`;

  return {
    Cycle: {
      doc: 'A shared base that learns in a loop: the base in the centre, three to six steps a pulse goes round, up to four teams in the corners. Takes the slide\'s width.',
      props: {
        center: req(S.obj({ title: req(S.text({ max: 32 })), text: S.text({ max: 60 }) })),
        steps: req(S.list(S.obj({ title: req(S.text({ max: 22 })), text: S.text({ max: 42 }) }), { min: 3 })),
        around: S.list(S.text({ max: 22 }), { max: 4 }),
      },
      children: 'none',
      check: (p) => (p.steps?.length > 6 ? `Cycle takes three to six steps, not ${p.steps.length}` : null),
      render: (p, ctx) => {
        const W = 1120, H = 440, C = { x: 560, y: 220 }, RX = 360, RY = 172;
        const n = p.steps.length;
        // The steps sit where the pulse is after 1/n, 2/n… of its turn: measured along the ellipse,
        // so the pulse reaches each one on the beat that lights it.
        const pts = [];
        const N = 1440;
        let len = 0, prev = null;
        const arc = [];
        for (let k = 0; k <= N; k++) {
          const t = -Math.PI / 2 + (2 * Math.PI * k) / N;
          const q = { x: C.x + RX * Math.cos(t), y: C.y + RY * Math.sin(t) };
          if (prev) len += Math.hypot(q.x - prev.x, q.y - prev.y);
          arc.push({ ...q, len });
          prev = q;
        }
        for (let i = 0; i < n; i++) pts.push(arc.find((a) => a.len >= (len * i) / n) || arc[0]);
        const ring = `M${C.x},${C.y - RY} A${RX},${RY} 0 1,1 ${C.x - 0.1},${C.y - RY} Z`;
        const corners = [[90, 30], [1030, 30], [1030, 410], [90, 410]];
        const around = (p.around || []).slice(0, 4);
        const turn = n * 2;
        return `<div class="dk-block dk-cycle" data-n="${n}" style="--n:${n}">
          <svg class="dk-wire" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            ${around.map((_, i) => `<line x1="${corners[i][0]}" y1="${corners[i][1]}" x2="${C.x}" y2="${C.y}" />`).join('')}
            <path class="dk-cycle-ring" d="${ring}" />
            <circle class="dk-pulse" r="9"><animateMotion dur="${turn}s" repeatCount="indefinite" path="${ring}" /></circle>
          </svg>
          ${around.map((a, i) => `<span class="dk-cycle-team" style="left:${pct(corners[i][0], W)};top:${corners[i][1]}px">${ctx.md(a)}</span>`).join('')}
          <div class="dk-cycle-core"><strong>${ctx.md(p.center.title)}</strong>${when(p.center.text, (t) => `<span>${ctx.md(t)}</span>`)}</div>
          <ol class="dk-cycle-steps">${p.steps.map((s, i) => `
            <li class="dk-cycle-step" style="left:${pct(pts[i].x, W)};top:${pts[i].y.toFixed(1)}px;--i:${i}"><b><span class="dk-cycle-n">${two(i)}</span> ${ctx.md(s.title)}</b>${when(s.text, (t) => `<span>${ctx.md(t)}</span>`)}</li>`).join('')}
          </ol>
        </div>`;
      },
    },

    Regen: {
      doc: 'One source of truth and the views rebuilt from it: what comes in on the left, the line the agent writes for each in the middle, and on the right a plan, a slide and a demo that move when the input they depend on arrives (`by`, an index from 0). Takes the slide\'s width.',
      props: {
        inputs: req(S.list(S.obj({
          kind: S.text({ max: 40 }), title: req(S.text({ max: 60 })), text: S.text({ max: 90 }),
          file: req(S.str()), lines: S.list(S.text(), { max: 2 }), add: req(S.text({ max: 40 })),
        }), { min: 1, max: 3 })),
        source: S.text(),
        plan: S.obj({
          title: S.text(), cols: req(S.list(S.str({ max: 8 }), { min: 2, max: 8 })),
          rows: req(S.list(S.obj({ title: req(S.text({ max: 26 })), from: req(S.num()), to: req(S.num()), from2: S.num(), to2: S.num(), by: S.int(), added: S.bool() }), { min: 1, max: 5 })),
        }),
        slide: S.obj({ title: S.text(), kicker: S.text({ max: 30 }), before: S.text({ max: 50 }), after: req(S.text({ max: 50 })), text: S.text({ max: 60 }), by: S.int() }),
        demo: S.obj({ title: S.text(), ask: req(S.text({ max: 60 })), answer: req(S.text({ max: 90 })), cite: S.text({ max: 50 }), by: S.int() }),
      },
      children: 'none',
      check: (p) => {
        const n = p.inputs?.length || 0;
        const bys = [...(p.plan?.rows || []).map((r) => r.by), p.slide?.by, p.demo?.by].filter((b) => b !== undefined);
        const bad = bys.find((b) => b < 0 || b >= n);
        if (bad !== undefined) return `Regen: by=${bad} names no input (there are ${n}, counted from 0)`;
        return !p.plan && !p.slide && !p.demo ? 'Regen needs at least one view: plan, slide or demo' : null;
      },
      render: (p, ctx) => {
        const n = p.inputs.length;
        // Three beats an input: it arrives (3i+1), its line is written (3i+2), what depends on it moves (3i+3).
        const moves = (by) => (by === undefined ? undefined : 3 * by + 3);
        const beats = Array.from({ length: n }, (_, i) => [i * 3000 + 300, i * 3000 + 1100, i * 3000 + 1900]).flat().join(' ');
        const plan = p.plan;
        const nc = plan ? plan.cols.length : 1;
        const span = (a, b) => `${(Math.max(0, Math.min(a, nc)) / nc * 100).toFixed(2)}%`;
        const bar = (r) => `--a:${span(r.from)};--w:${span(r.to - r.from)};--a2:${span(r.from2 ?? r.from)};--w2:${span((r.to2 ?? r.to) - (r.from2 ?? r.from))}`;
        const hits = (xs) => xs.filter(Boolean).join(' ');
        const views = [];
        if (plan) {
          views.push(`<section class="dk-regen-view dk-regen-plan"${hits(plan.rows.map((r) => moves(r.by))) ? ` data-hits="${hits(plan.rows.map((r) => moves(r.by)))}"` : ''}>
            ${cap(ctx, plan.title || ctx.t('plan'), ctx.t('rebuilt'))}
            <div class="dk-regen-cols" style="--nc:${nc}">${plan.cols.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
            <ul class="dk-regen-rows" style="--nc:${nc}">${plan.rows.map((r) => `
              <li class="${cls('dk-regen-row', r.added ? 'is-added' : r.by !== undefined && 'is-moved')}"${r.by !== undefined ? ` data-at="${moves(r.by)}"` : ''}><span>${ctx.md(r.title)}</span><span class="dk-regen-track"><i style="${bar(r)}"></i></span></li>`).join('')}
            </ul></section>`);
        }
        if (p.slide) {
          const s = p.slide;
          views.push(`<section class="dk-regen-view dk-regen-slide"${s.by !== undefined ? ` data-at="${moves(s.by)}"` : ''}>
            ${cap(ctx, s.title || ctx.t('slideView'), ctx.t('rebuilt'))}
            <div class="dk-regen-frame">${when(s.kicker, (k) => `<small>${ctx.md(k)}</small>`)}${when(s.before, (b) => `<b class="is-before">${ctx.md(b)}</b>`)}<b class="is-after">${ctx.md(s.after)}</b>${when(s.text, (t) => `<span>${ctx.md(t)}</span>`)}</div>
          </section>`);
        }
        if (p.demo) {
          const d = p.demo;
          views.push(`<section class="dk-regen-view dk-regen-demo"${d.by !== undefined ? ` data-at="${moves(d.by)}"` : ''}>
            ${cap(ctx, d.title || ctx.t('demo'), ctx.t('rebuilt'))}
            <div class="dk-regen-chat"><p class="dk-regen-ask">${ctx.md(d.ask)}</p><p class="dk-regen-answer"><span>${ctx.md(d.answer)}</span>${when(d.cite, (c) => `<span class="dk-regen-cite">${ctx.md(c)}</span>`)}</p></div>
          </section>`);
        }
        return `<div class="dk-block dk-regen" data-play="${beats}" data-hit="2200" data-hold="1400">
          <ol class="dk-regen-inputs">${p.inputs.map((x, i) => `
            <li class="dk-regen-in" data-at="${3 * i + 1}">${when(x.kind, (k) => `<span class="dk-regen-kind">${ctx.md(k)}</span>`)}<b>${ctx.md(x.title)}</b>${when(x.text, (t) => `<span class="dk-regen-text">${ctx.md(t)}</span>`)}</li>`).join('')}
          </ol>
          <span class="dk-arrow" aria-hidden="true"></span>
          <div class="dk-regen-source">${cap(ctx, p.source || ctx.t('sourceOfTruth'))}${p.inputs.map((x, i) => file(ctx, { name: x.file, lines: x.lines, add: x.add }, { at: 3 * i + 2 })).join('')}</div>
          <span class="dk-arrow" aria-hidden="true"></span>
          <div class="${cls('dk-regen-views', `has-${views.length}`)}">${views.join('')}</div>
        </div>`;
      },
    },

    Redraw: {
      doc: 'A correction made once in conversation redraws a figure and writes the rule: the conversation, the figure (a `plan` whose dimension figures collide, or a `chart` whose labels do), the rules file and its new line. Takes the slide\'s width.',
      props: {
        tool: S.text({ max: 30 }),
        chat: req(S.list(S.obj({ who: S.text({ max: 24 }), text: req(S.text({ max: 110 })), me: S.bool() }), { min: 2, max: 3 })),
        plan: S.obj({ title: S.text({ max: 50 }), w: req(S.str({ max: 7 })), wi: req(S.str({ max: 7 })), h: req(S.str({ max: 7 })), hi: req(S.str({ max: 7 })) }),
        chart: S.obj({ title: S.text({ max: 50 }), items: req(S.list(S.obj({ label: req(S.text({ max: 16 })), value: req(S.num()) }), { min: 3, max: 7 })) }),
        rule: req(FILE),
      },
      children: 'none',
      check: (p) => (!p.plan === !p.chart ? 'Redraw draws one figure: a plan or a chart' : null),
      render: (p, ctx) => {
        // Beats: the correction (1), the answer (2), the figure redrawn (3), the rule written (4).
        const last = p.chat.length;
        let fig, title;
        if (p.plan) {
          const q = p.plan;
          title = q.title;
          // A window drawn as a fabrication plan, 340 × 290: its inner dimensions start on the
          // lines of the outer ones, where their figures collide, and move to a second line.
          fig = `<div class="dk-redraw-plan">
            <svg viewBox="0 0 340 290" width="340" height="290" aria-hidden="true">
              <rect class="dk-redraw-frame" x="60" y="12" width="190" height="222" />
              <rect class="dk-redraw-open" x="77" y="29" width="156" height="188" />
              <line class="dk-redraw-mullion" x1="155" y1="29" x2="155" y2="217" />
              <g class="dk-redraw-dim"><line x1="60" y1="256" x2="250" y2="256" /><line x1="60" y1="248" x2="60" y2="264" /><line x1="250" y1="248" x2="250" y2="264" /></g>
              <g class="dk-redraw-dim is-move-x"><line x1="77" y1="256" x2="233" y2="256" /><line x1="77" y1="250" x2="77" y2="262" /><line x1="233" y1="250" x2="233" y2="262" /></g>
              <g class="dk-redraw-dim"><line x1="280" y1="12" x2="280" y2="234" /><line x1="272" y1="12" x2="288" y2="12" /><line x1="272" y1="234" x2="288" y2="234" /></g>
              <g class="dk-redraw-dim is-move-y"><line x1="280" y1="29" x2="280" y2="217" /><line x1="274" y1="29" x2="286" y2="29" /><line x1="274" y1="217" x2="286" y2="217" /></g>
              <g class="dk-redraw-clash"><ellipse cx="158" cy="246" rx="34" ry="16" /><ellipse cx="270" cy="124" rx="16" ry="36" /></g>
            </svg>
            <span class="dk-redraw-num" style="left:155px;top:246px">${esc(q.w)}</span>
            <span class="dk-redraw-num is-move-x" style="left:162px;top:246px">${esc(q.wi)}</span>
            <span class="dk-redraw-num is-v" style="left:270px;top:123px">${esc(q.h)}</span>
            <span class="dk-redraw-num is-v is-move-y" style="left:270px;top:130px">${esc(q.hi)}</span>
          </div>`;
        } else {
          const c = p.chart;
          title = c.title;
          const top = Math.max(...c.items.map((b) => b.value)) || 1;
          // Labels collide where half their widths add up to more than a column (about 7.6px a
          // character at 14px): those are circled until the chart is redrawn.
          const pitch = 330 / c.items.length;
          const w = (s) => String(s).replace(/[*`]/g, '').length * 7.6;
          const clash = c.items.slice(1).map((b, i) => ((w(c.items[i].label) + w(b.label)) / 2 > pitch - 4 ? i : -1)).filter((i) => i >= 0);
          fig = `<div class="dk-redraw-chart" style="--nb:${c.items.length}">
            <div class="dk-redraw-bars">${c.items.map((b) => `<span class="dk-redraw-bar" style="height:${Math.max(3, (b.value / top) * 100).toFixed(1)}%"></span>`).join('')}</div>
            <div class="dk-redraw-labels">${c.items.map((b, i) => `<span class="${cls(i % 2 && 'is-odd')}">${ctx.md(b.label)}</span>`).join('')}</div>
            <svg class="dk-redraw-clash" viewBox="0 0 330 290" width="330" height="290" aria-hidden="true">${clash.map((i) => `<ellipse cx="${(pitch * (i + 1)).toFixed(1)}" cy="244" rx="22" ry="14" />`).join('')}</svg>
          </div>`;
        }
        return `<div class="dk-block dk-redraw" data-play="1300 2700 3600 4700" data-hit="1300" data-hold="900">
          <div class="dk-redraw-panel dk-redraw-chat">
            <p class="dk-cap"><span class="dk-redraw-dot" aria-hidden="true"></span><span>${ctx.md(p.tool || ctx.t('conversation'))}</span></p>
            ${p.chat.map((m, i) => `<p class="${cls('dk-redraw-msg', m.me && 'is-me')}"${i > 0 ? ` data-at="${Math.min(i, 2)}"` : ''}>${when(m.who, (w) => `<b>${ctx.md(w)}</b>`)}<span>${ctx.md(m.text)}</span></p>`).join('')}
          </div>
          <div class="dk-redraw-panel dk-redraw-fig" data-at="${Math.max(3, last)}">
            ${cap(ctx, title || '', ctx.t('redrawn'))}
            ${fig}
          </div>
          <div class="dk-redraw-panel dk-redraw-rule">
            <p class="dk-cap"><span>${ctx.md(ctx.t('rule'))}</span></p>
            ${file(ctx, p.rule, { at: 4 })}
          </div>
        </div>`;
      },
    },

    Hub: {
      doc: 'Before and now in one diagram: the chain of intermediaries before, with its loop back; now, the people who ask, the agents that carry it out, the shared base they read and write, and the system it plugs into. Takes the slide\'s width.',
      props: {
        before: req(S.obj({
          label: S.text({ max: 16 }), loop: S.text({ max: 60 }),
          nodes: req(S.list(S.obj({ title: req(S.text({ max: 24 })), text: S.text({ max: 26 }) }), { min: 3, max: 6 })),
        })),
        now: req(S.obj({
          label: S.text({ max: 16 }),
          who: req(S.obj({ title: req(S.text({ max: 20 })), text: S.text({ max: 60 }) })),
          head: S.text({ max: 44 }),
          agents: req(S.list(S.obj({ tag: S.text({ max: 22 }), ask: req(S.text({ max: 40 })) }), { min: 2 })),
          base: req(S.obj({ title: req(S.text({ max: 26 })), text: S.text({ max: 22 }), caption: S.text({ max: 64 }) })),
          system: S.obj({ title: req(S.text({ max: 20 })), text: S.text({ max: 40 }), caption: S.text({ max: 50 }) }),
        })),
      },
      children: 'none',
      check: (p) => (p.now?.agents?.length > 3 ? `Hub draws two or three agents, not ${p.now.agents.length}` : null),
      render: (p, ctx) => {
        const W = 1120;
        const id = uid(ctx, 'hub');
        const b = p.before, now = p.now;
        // Before: the links in a row, an arrow going above each gap and one coming back below, the long loop under them.
        const nodes = b.nodes, n = nodes.length;
        const GAP = 48, NY = 30, NH = 62;
        const nw = (W - (n - 1) * GAP) / n;
        const cx = (i) => i * (nw + GAP) + nw / 2;
        const O = Math.min(52, nw / 3);
        const fwd = nodes.slice(1).map((_, i) => `M${cx(i) + O} ${NY} C${cx(i) + O} ${NY - 24} ${cx(i + 1) - O} ${NY - 24} ${cx(i + 1) - O} ${NY - 3}`);
        const back = nodes.slice(1).map((_, i) => `M${cx(i + 1) - O} ${NY + NH} C${cx(i + 1) - O} ${NY + NH + 22} ${cx(i) + O} ${NY + NH + 22} ${cx(i) + O} ${NY + NH + 3}`);
        const loop = `M${cx(n - 1)} ${NY + NH} C${cx(n - 1)} ${NY + NH + 62} ${cx(0)} ${NY + NH + 62} ${cx(0)} ${NY + NH + 3}`;
        // Now: who asks, the agents, the base, the system.
        const ag = now.agents, k = ag.length;
        const AX = 270, AW = 360, AY = 190, AH = k === 2 ? 76 : 62, AG = k === 2 ? 24 : 12;
        const ay = (j) => AY + j * (AH + AG), acy = (j) => ay(j) + AH / 2;
        const mid = (acy(0) + acy(k - 1)) / 2;
        const WX = 0, WW = 200, WH = 132, WY = mid - WH / 2;
        const BX = 790, BY = mid, BR = 80;
        const EX = 950, EW = 170, EH = 88, EY = BY - EH / 2;
        const req1 = ag.map((_, j) => `M${WX + WW} ${mid} C${WX + WW + 36} ${mid} ${AX - 36} ${acy(j)} ${AX - 4} ${acy(j)}`);
        const tgt = (j) => { const y = BY + (j - (k - 1) / 2) * 34; return [BX - Math.sqrt(BR * BR - (y - BY) ** 2) - 4, y]; };
        const toBase = ag.map((_, j) => { const [x, y] = tgt(j); return `M${AX + AW + 4} ${acy(j)} C${AX + AW + 44} ${acy(j)} ${x - 44} ${y} ${x} ${y}`; });
        // Tall enough for the last agent and two lines of caption under the base.
        const H = Math.ceil(Math.max(ay(k - 1) + AH, BY + BR + 8 + 42, now.system ? EY + EH + 8 + 42 : 0));
        const toSys = now.system ? [`M${BX + BR + 4} ${BY - 12} L${EX - 4} ${BY - 12}`, `M${EX - 4} ${BY + 12} L${BX + BR + 4} ${BY + 12}`] : [];
        // Hidden until it starts, or it would wait at the drawing's top left corner.
        const dot = (d, dur, begin, c = '', back2 = false) => `<circle class="dk-pulse${c}" r="5" visibility="hidden"><set attributeName="visibility" to="visible" begin="${begin}s" /><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite"${back2 ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : ''} path="${d}" /></circle>`;
        const box = (x, y, w, h, c, inner) => `<div class="${c}" style="left:${pct(x, W)};top:${y.toFixed(1)}px;width:${pct(w, W)};height:${h}px">${inner}</div>`;
        return `<div class="dk-block dk-hub" style="height:${H}px" data-play="300 4800" data-hold="900">
          <svg class="dk-wire" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            <defs>${['a', 'b'].map((m) => `<marker id="${id}-${m}" class="dk-hub-head-${m}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" /></marker>`).join('')}</defs>
            <g class="dk-hub-band is-before" data-at="1">
              ${[...fwd, ...back].map((d) => `<path d="${d}" marker-end="url(#${id}-a)" />`).join('')}
              <path class="dk-hub-loop" d="${loop}" marker-end="url(#${id}-a)" />
              ${fwd.map((d, i) => dot(d, 1.3, (i * 0.3).toFixed(2), ' is-faint')).join('')}
              ${back.map((d, i) => dot(d, 1.3, (0.65 + i * 0.3).toFixed(2), ' is-faint')).join('')}
              ${dot(loop, 3.2, 1, ' is-faint')}
            </g>
            <g class="dk-hub-band is-now" data-at="2">
              ${[...req1, ...toBase, ...toSys].map((d) => `<path d="${d}" marker-end="url(#${id}-b)" />`).join('')}
              ${req1.map((d, j) => dot(d, 1.6, (j * 0.45).toFixed(2))).join('')}
              ${toBase.map((d, j) => dot(d, 1.8, (0.8 + j * 0.45).toFixed(2))).join('')}
              ${toBase.map((d, j) => dot(d, 1.8, (1.7 + j * 0.45).toFixed(2), ' is-learn', true)).join('')}
              ${toSys.map((d, j) => dot(d, 1.2, (1.2 + j * 0.6).toFixed(2))).join('')}
            </g>
          </svg>
          <div class="dk-hub-band is-before" data-at="1">
            <p class="dk-hub-label is-before" style="top:0">${ctx.md(b.label || ctx.t('before'))}</p>
            ${nodes.map((x, i) => box(cx(i) - nw / 2, NY, nw, NH, 'dk-hub-node', `<b>${ctx.md(x.title)}</b>${when(x.text, (t) => `<span>${ctx.md(t)}</span>`)}`)).join('')}
            ${when(b.loop, (l) => `<p class="dk-hub-quote" style="top:${NY + NH + 32}px"><q>${ctx.md(l)}</q></p>`)}
          </div>
          <div class="dk-hub-band is-now" data-at="2">
            <p class="dk-hub-label is-now" style="top:${AY - 30}px">${ctx.md(now.label || ctx.t('now'))}</p>
            ${when(now.head, (h) => `<p class="dk-hub-head" style="left:${pct(AX, W)};top:${AY - 30}px">${ctx.md(h)}</p>`)}
            ${box(WX, WY, WW, WH, 'dk-hub-who', `<b>${ctx.md(now.who.title)}</b>${when(now.who.text, (t) => `<span>${ctx.md(t)}</span>`)}`)}
            ${ag.map((a, j) => box(AX, ay(j), AW, AH, 'dk-hub-agent', `${when(a.tag, (t) => `<span class="dk-hub-tag">${ctx.md(t)}</span>`)}<q>${ctx.md(a.ask)}</q>`)).join('')}
            ${box(BX - BR, BY - BR, BR * 2, BR * 2, 'dk-hub-base', `<b>${ctx.md(now.base.title)}</b>${when(now.base.text, (t) => `<span>${ctx.md(t)}</span>`)}`)}
            ${when(now.base.caption, (c) => `<p class="dk-hub-caption" style="left:${pct(BX - 140, W)};width:${pct(280, W)};top:${BY + BR + 8}px">${ctx.md(c)}</p>`)}
            ${now.system ? box(EX, EY, EW, EH, 'dk-hub-system', `<b>${ctx.md(now.system.title)}</b>${when(now.system.text, (t) => `<span>${ctx.md(t)}</span>`)}`) : ''}
            ${now.system?.caption ? `<p class="dk-hub-caption" style="left:${pct(EX, W)};width:${pct(EW, W)};top:${EY + EH + 8}px">${ctx.md(now.system.caption)}</p>` : ''}
          </div>
        </div>`;
      },
    },

    Levels: {
      doc: 'Levels of working with AI, side by side: what each asks of people and where the information lives. `here` marks the level the deck proposes, with its tag.',
      props: {
        labels: S.obj({ need: S.text(), where: S.text() }),
        items: req(S.list(S.obj({
          n: S.str({ max: 3 }), title: req(S.text({ max: 40 })), text: S.text({ max: 130 }),
          need: S.text({ max: 60 }), where: S.text({ max: 70 }), here: S.text({ max: 36 }),
        }), { min: 2, max: 4 })),
      },
      children: 'none',
      render: (p, ctx) => {
        const need = p.labels?.need || ctx.t('levelNeed'), where = p.labels?.where || ctx.t('levelWhere');
        return `<div class="dk-block dk-levels" style="--cols:${p.items.length}">${p.items.map((l, i) => `
          <article class="${cls('dk-level', l.here && 'is-here')}">
            ${when(l.here, (h) => `<span class="dk-level-tag">${ctx.md(h)}</span>`)}
            <span class="dk-level-n">${esc(l.n ?? String(i))}</span>
            <h3 class="dk-level-title">${ctx.md(l.title)}</h3>
            ${when(l.text, (t) => `<p class="dk-level-text">${ctx.md(t)}</p>`)}
            ${l.need || l.where ? `<dl>${when(l.need, (x) => `<dt>${ctx.md(need)}</dt><dd>${ctx.md(x)}</dd>`)}${when(l.where, (x) => `<dt>${ctx.md(where)}</dt><dd>${ctx.md(x)}</dd>`)}</dl>` : ''}
          </article>`).join('')}</div>`;
      },
    },

    Iceberg: {
      doc: 'What people see, and what runs under it: a conversation above the line, a claim on the line, and under it, dense on purpose, the files that carry the work, one line each.',
      props: {
        above: S.text({ max: 30 }), below: S.text({ max: 40 }),
        chat: req(S.list(S.obj({ text: req(S.text({ max: 90 })), me: S.bool() }), { min: 1, max: 2 })),
        claim: req(S.text({ max: 90 })),
        columns: req(S.list(S.obj({
          title: req(S.text({ max: 30 })),
          items: req(S.list(S.obj({ k: req(S.str({ max: 30 })), text: S.text({ max: 50 }) }), { min: 1, max: 4 })),
        }), { min: 2, max: 4 })),
      },
      children: 'none',
      render: (p, ctx) => `<div class="dk-block dk-iceberg">
        <div class="dk-iceberg-top"><p class="dk-cap"><span>${ctx.md(p.above || ctx.t('above'))}</span></p>
          <div class="dk-iceberg-chat">${p.chat.map((m) => `<p class="${cls('dk-iceberg-msg', m.me && 'is-me')}">${ctx.md(m.text)}</p>`).join('')}</div></div>
        <div class="dk-iceberg-line"><p>${ctx.md(p.claim)}</p></div>
        <div class="dk-iceberg-deep"><p class="dk-cap"><span>${ctx.md(p.below || ctx.t('below'))}</span></p>
          <div class="dk-iceberg-cols" style="--cols:${p.columns.length}">${p.columns.map((c) => `
            <section><h3>${ctx.md(c.title)}</h3><ul>${c.items.map((x) => `<li><code>${esc(x.k)}</code>${when(x.text, (t) => `<span>${ctx.md(t)}</span>`)}</li>`).join('')}</ul></section>`).join('')}
          </div></div>
      </div>`,
    },

    LearnTree: {
      doc: 'What arrives on one side and the rules that learn from it on the other: cards arrive one by one, each lights the file of the tree it writes to (`at`, the card\'s index from 0) or adds it (`added`), and the last rule is shown as written.',
      props: {
        heads: S.list(S.text({ max: 34 }), { max: 2 }),
        counts: S.list(S.obj({ from: req(S.int()), to: req(S.int()), label: S.text({ max: 14 }) }), { max: 2 }),
        items: req(S.list(S.obj({ meta: S.text({ max: 20 }), text: req(S.text({ max: 70 })) }), { min: 2, max: 5 })),
        tree: req(S.list(S.obj({ name: req(S.str({ max: 32 })), depth: S.int(), kind: S.oneOf(['folder', 'file']), at: S.list(S.int()), added: S.bool() }), { min: 2, max: 12 })),
        file: FILE,
      },
      children: 'none',
      render: (p, ctx) => {
        const n = p.items.length;
        const beats = Array.from({ length: n }, (_, i) => 450 + i * 1300).join(' ');
        const rows = treeRows(p.tree);
        const head = (i) => {
          const c = p.counts?.[i];
          return `<p class="dk-learn-head"><span>${when(p.heads?.[i], (h) => ctx.md(h))}</span>${c ? `<span class="dk-learn-count"><b data-from="${c.from}" data-to="${c.to}">${esc(new Intl.NumberFormat(ctx.lang).format(c.to))}</b> ${when(c.label, (l) => ctx.md(l))}</span>` : ''}</p>`;
        };
        return `<div class="dk-block dk-learn" data-play="${beats}" data-hold="1200">
          <div class="dk-learn-col">${head(0)}<ol class="dk-learn-items">${p.items.map((it, i) => `
            <li class="dk-learn-item" data-at="${i + 1}">${when(it.meta, (m) => `<span class="dk-learn-meta">${ctx.md(m)}</span>`)}<span>${ctx.md(it.text)}</span></li>`).join('')}
          </ol></div>
          <span class="dk-arrow" aria-hidden="true"></span>
          <div class="dk-learn-col">${head(1)}
            <ul class="dk-tree">${rows.map((r) => {
              const at = (r.at || []).filter((k) => k >= 0 && k < n).map((k) => k + 1);
              return `<li class="${cls('dk-tree-row', `is-${r.kind}`, at.length && 'is-touched')}"${r.added && at.length ? ` data-at="${at[0]}"` : ''}${at.length ? ` data-hits="${at.join(' ')}"` : ''}>${treeNode(r, esc)}</li>`;
            }).join('')}</ul>
            ${p.file ? file(ctx, p.file, { boxAt: n, cls: 'dk-learn-file' }) : ''}
          </div>
        </div>`;
      },
    },

    Point: {
      doc: 'The sentence the slide leaves, at its foot, with a label (“The point” by default). A Callout sets a sentence apart in the flow; a Point closes the slide.',
      props: { label: S.text({ max: 24 }), text: S.text({ max: 160 }) },
      children: 'text',
      render: (p, ctx, kids) => `<div class="dk-block dk-point"><span class="dk-point-label">${ctx.md(p.label || ctx.t('point'))}</span><div class="dk-point-text">${p.text ? `<p>${ctx.md(p.text)}</p>` : kids.join('')}</div></div>`,
    },

    Phrases: {
      doc: 'Sentences heard in every company, in cards: a tag, the sentence as it is said, and what it really says.',
      props: {
        cols: S.int(),
        items: req(S.list(S.obj({ tag: S.text({ max: 26 }), quote: req(S.text({ max: 90 })), text: S.text({ max: 110 }) }), { min: 2, max: 6 })),
      },
      children: 'none',
      render: (p, ctx) => `<div class="dk-block dk-phrases" style="--cols:${p.cols || (p.items.length === 4 ? 2 : Math.min(p.items.length, 3))}">${p.items.map((x) => `
        <article class="dk-phrase">${when(x.tag, (t) => `<p class="dk-card-label">${ctx.md(t)}</p>`)}<q>${ctx.md(x.quote)}</q>${when(x.text, (t) => `<p class="dk-phrase-text">${ctx.md(t)}</p>`)}</article>`).join('')}</div>`,
    },

    Layers: {
      doc: 'A stack read from the top down, one layer a row: `tone` "accent" for the layer the deck proposes, "base" for the ground under the rest. `side` explains how the layers hold together.',
      props: {
        items: req(S.list(S.obj({ title: req(S.text({ max: 30 })), text: S.text({ max: 110 }), tone: S.oneOf(['accent', 'base']) }), { min: 2, max: 5 })),
        side: S.obj({ title: S.text({ max: 30 }), items: S.list(S.text({ max: 70 }), { max: 4 }), text: S.text({ max: 110 }) }),
      },
      children: 'none',
      render: (p, ctx) => `<div class="${cls('dk-block dk-layers', p.side && 'has-side')}">
        <div class="dk-layer-stack">${p.items.map((l) => `<div class="${cls('dk-layer', l.tone && `is-${l.tone}`)}"><b>${ctx.md(l.title)}</b>${when(l.text, (t) => `<span>${ctx.md(t)}</span>`)}</div>`).join('')}</div>
        ${when(p.side, (s) => `<aside class="dk-layer-side">${when(s.title, (t) => `<p class="dk-card-label">${ctx.md(t)}</p>`)}${when(s.items, (xs) => `<ul>${xs.map((x) => `<li>${ctx.md(x)}</li>`).join('')}</ul>`)}${when(s.text, (t) => `<p class="dk-layer-side-text">${ctx.md(t)}</p>`)}</aside>`)}
      </div>`,
    },

    Survey: {
      doc: 'What a room said about itself, one dot per person: the room by level, the share that names something, the obstacles as bars over the size of the room. For a real room: the figures come from its cards.',
      props: {
        total: req(S.int()),
        levels: req(S.obj({ title: S.text({ max: 40 }), items: req(S.list(S.obj({ n: req(S.int()), title: req(S.text({ max: 22 })), text: S.text({ max: 60 }) }), { min: 2, max: 4 })) })),
        share: S.obj({ title: S.text({ max: 50 }), n: req(S.int()), note: S.text({ max: 90 }) }),
        bars: S.obj({ title: S.text({ max: 40 }), items: req(S.list(S.obj({ label: req(S.text({ max: 36 })), n: req(S.int()) }), { min: 1, max: 5 })) }),
      },
      children: 'none',
      check: (p) => {
        const sum = (p.levels?.items || []).reduce((a, l) => a + l.n, 0);
        return p.total && sum > p.total ? `Survey: the levels count ${sum} people in a room of ${p.total}` : null;
      },
      render: (p, ctx) => {
        const of = ctx.t('outOf');
        const dots = (k, c = '') => Array.from({ length: Math.max(0, k) }, () => `<i${c}></i>`).join('');
        return `<div class="${cls('dk-block dk-survey', !(p.share || p.bars) && 'is-alone')}">
          <section class="dk-survey-panel">${when(p.levels.title, (t) => `<p class="dk-cap"><span>${ctx.md(t)}</span></p>`)}${p.levels.items.map((l, i) => `
            <div class="dk-survey-level" data-tone="${Math.min(i, 2)}"><div class="dk-survey-k"><b>${ctx.md(l.title)}</b>${when(l.text, (t) => `<span>${ctx.md(t)}</span>`)}</div><div class="dk-survey-dots" role="img" aria-label="${l.n} ${esc(of)} ${p.total}">${dots(l.n)}</div><span class="dk-survey-n">${l.n}</span></div>`).join('')}
          </section>
          ${p.share || p.bars ? `<div class="dk-survey-side">
            ${when(p.share, (s) => `<section class="dk-survey-panel">${when(s.title, (t) => `<p class="dk-cap"><span>${ctx.md(t)}</span></p>`)}<div class="dk-survey-share"><div class="dk-survey-dots is-row" role="img" aria-label="${s.n} ${esc(of)} ${p.total}">${dots(Math.min(s.n, p.total), ' class="is-on"')}${dots(p.total - s.n)}</div><span class="dk-survey-n">${s.n} <small>${ctx.md(of)} ${p.total}</small></span></div>${when(s.note, (t) => `<p class="dk-survey-note">${ctx.md(t)}</p>`)}</section>`)}
            ${when(p.bars, (b) => `<section class="dk-survey-panel">${when(b.title, (t) => `<p class="dk-cap"><span>${ctx.md(t)}</span></p>`)}${b.items.map((x) => `<div class="dk-survey-bar"><span>${ctx.md(x.label)}</span><span class="dk-survey-track"><i style="width:${((Math.min(x.n, p.total) / Math.max(p.total, 1)) * 100).toFixed(1)}%"></i></span><span class="dk-survey-n">${x.n}</span></div>`).join('')}</section>`)}
          </div>` : ''}
        </div>`;
      },
    },

    Room: {
      doc: 'Workshop tables as a seating plan: one round table per group, its people as initials (the names stay in the notes), who leads it and who is its AI lead, the workflow it works on.',
      props: {
        tables: req(S.list(S.obj({
          title: req(S.text({ max: 30 })), text: S.text({ max: 70 }),
          people: req(S.list(S.obj({ name: req(S.str()), role: S.oneOf(['lead', 'ai', 'both']) }), { min: 2, max: 8 })),
        }), { min: 1, max: 4 })),
        note: S.text({ max: 90 }),
      },
      children: 'none',
      render: (p, ctx) => {
        const initials = (people) => {
          const seen = new Set();
          return people.map(({ name }) => {
            const w = String(name).trim().split(/\s+/);
            let i = ((w[0]?.[0] ?? '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
            if (seen.has(i)) i += (w[w.length - 1]?.[1] ?? '').toUpperCase();
            seen.add(i);
            return i;
          });
        };
        const role = (r) => cls(r === 'lead' || r === 'both' ? 'is-lead' : '', r === 'ai' || r === 'both' ? 'is-ai' : '');
        return `<div class="dk-block dk-room">
          <div class="dk-room-tables" style="--cols:${p.tables.length}">${p.tables.map((t, k) => {
            const ini = initials(t.people), m = t.people.length;
            return `<section class="dk-room-table" data-tone="${(k % 4) + 1}">
              <p class="dk-room-head"><span>${ctx.md(ctx.t('table'))} ${k + 1}</span><b>${ctx.md(t.title)}</b></p>
              <div class="dk-room-round"><span class="dk-room-top"><b>${m}</b>${ctx.md(ctx.t('people'))}</span>${t.people.map((g, j) => `<span class="${cls('dk-room-seat', role(g.role))}" style="--a:${Math.round((360 * j) / m - 90)}deg" title="${esc(g.name)}">${esc(ini[j])}</span>`).join('')}</div>
              ${when(t.text, (x) => `<p class="dk-room-text">${ctx.md(x)}</p>`)}
            </section>`;
          }).join('')}</div>
          <p class="dk-room-legend"><span class="dk-room-seat is-lead" aria-hidden="true"></span>${ctx.md(ctx.t('tableLead'))}<span class="dk-room-seat is-ai" aria-hidden="true"></span>${ctx.md(ctx.t('tableAi'))}${when(p.note, (x) => `<span class="dk-room-sep" aria-hidden="true"></span>${ctx.md(x)}`)}</p>
        </div>`;
      },
    },

    FolderTree: {
      doc: 'A folder tree drawn as one, a line per entry with what it holds: `depth` from 0, `kind` "folder", "repo" or "file", `hot` for the entry to remember. `title` names the repository or the machine.',
      props: {
        title: S.str({ max: 50 }),
        items: req(S.list(S.obj({ name: req(S.str({ max: 32 })), depth: S.int(), kind: S.oneOf(['folder', 'repo', 'file']), note: S.text({ max: 70 }), hot: S.bool() }), { min: 2, max: 13 })),
      },
      children: 'none',
      render: (p, ctx) => `<figure class="dk-block dk-folders">${when(p.title, (t) => `<figcaption class="dk-file-bar">${esc(t)}</figcaption>`)}
        <ul class="dk-tree has-notes">${treeRows(p.items).map((r) => `<li class="${cls('dk-tree-row', `is-${r.kind}`, r.hot && 'is-hot')}">${treeNode(r, esc)}${r.note ? `<span class="dk-tree-note">${ctx.md(r.note)}</span>` : '<span></span>'}</li>`).join('')}</ul>
      </figure>`,
    },

    FeedbackLoop: {
      doc: 'A remark on a page becomes a rule, and the tracking says so on its own: the page with the comment pinned on one sentence (`hl`, from 0), the source file and its new line, the board whose row moves and whose count climbs. Takes the slide\'s width.',
      props: {
        doc: req(S.obj({ title: req(S.text({ max: 40 })), lines: req(S.list(S.text({ max: 70 }), { min: 1, max: 4 })), hl: S.int() })),
        comment: req(S.obj({ who: S.text({ max: 24 }), text: req(S.text({ max: 80 })) })),
        file: req(FILE),
        board: req(S.obj({
          title: S.text({ max: 40 }),
          rows: req(S.list(S.obj({ title: req(S.text({ max: 44 })), state: S.oneOf(['done', 'running', 'blocked', 'todo']), to: S.oneOf(['done', 'running', 'blocked', 'todo']) }), { min: 1, max: 4 })),
          count: S.obj({ label: S.text({ max: 40 }), from: req(S.int()), to: req(S.int()) }),
        })),
        captions: S.list(S.text({ max: 30 }), { max: 3 }),
      },
      children: 'none',
      render: (p, ctx) => {
        const hl = p.doc.hl ?? 0;
        const c = p.captions || [];
        const state = (s, extra = '') => `<span class="${cls('dk-state', `is-${s || 'todo'}`, extra)}">${ctx.md(ctx.t(`state-${s || 'todo'}`))}</span>`;
        return `<div class="dk-block dk-loop" data-play="500 1500 2500 3500 4500" data-hit="1100" data-hold="900">
          <section class="dk-loop-panel">${cap(ctx, c[0] || ctx.t('loopDoc'))}
            <div class="dk-loop-doc"><b>${ctx.md(p.doc.title)}</b>${p.doc.lines.map((l, i) => `<p class="${cls(i === hl && 'is-hl')}"${i === hl ? ' data-at="1"' : ''}>${ctx.md(l)}</p>`).join('')}</div>
            <div class="dk-loop-comment" data-at="1">${when(p.comment.who, (w) => `<b>${ctx.md(w)}</b>`)}<span>${ctx.md(p.comment.text)}</span></div>
          </section>
          <span class="dk-arrow" data-at="2" aria-hidden="true"></span>
          <section class="dk-loop-panel">${cap(ctx, c[1] || ctx.t('loopFile'))}${file(ctx, p.file, { at: 3 })}</section>
          <span class="dk-arrow" data-at="4" aria-hidden="true"></span>
          <section class="dk-loop-panel" data-at="5">${cap(ctx, c[2] || p.board.title || ctx.t('loopBoard'))}
            <ul class="dk-loop-rows">${p.board.rows.map((r) => `<li${r.to ? ' class="is-moves"' : ''}><span>${ctx.md(r.title)}</span>${r.to ? `${state(r.state, 'is-from')}${state(r.to, 'is-to')}` : state(r.state)}</li>`).join('')}</ul>
            ${when(p.board.count, (k) => `<p class="dk-loop-count"><b data-from="${k.from}" data-to="${k.to}">${esc(new Intl.NumberFormat(ctx.lang).format(k.to))}</b><span>${ctx.md(k.label || '')}</span></p>`)}
          </section>
        </div>`;
      },
    },
  };
};

/** A flat tree ({ name, depth }) with its guides written out, as `tree` draws one. */
function treeRows(items) {
  const rows = items.map((x) => ({ ...x, depth: Math.max(0, x.depth ?? 0), kind: x.kind || (/\/$/.test(x.name) ? 'folder' : 'file') }));
  // An entry is the last of its siblings when nothing at its depth follows before a shallower one.
  const last = rows.map((r, i) => {
    for (let j = i + 1; j < rows.length; j++) { if (rows[j].depth < r.depth) return true; if (rows[j].depth === r.depth) return false; }
    return true;
  });
  const open = [];
  return rows.map((r, i) => {
    open.length = r.depth;
    const prefix = r.depth === 0 ? '' : open.slice(1).map((o) => (o ? '│  ' : '   ')).join('') + (last[i] ? '└─ ' : '├─ ');
    open[r.depth] = !last[i];
    return { ...r, prefix };
  });
}

const ICON = {
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
  repo: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="2.2"/>',
  file: '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/>',
};
const treeNode = (r, esc) => `<span class="dk-tree-node">${r.prefix ? `<span class="dk-tree-pre" aria-hidden="true">${r.prefix}</span>` : ''}`
  + `<svg class="dk-tree-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[r.kind] || ICON.file}</svg>`
  + `<span class="dk-tree-name">${esc(r.name)}</span></span>`;
