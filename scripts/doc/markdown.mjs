// A document's body, markdown to HTML. Everything a file contains is escaped before the marks are
// set, so nothing in a document becomes markup by accident.
//
// Blocks: headings (# is the title, ## a numbered band, ### and #### below), paragraphs, lists
// with [ ] and [x] tasks, tables, quotes, code, rules, and the directives `:::name argument` …
// `:::` below. An unknown directive stops the build: a shape that is missing becomes a directive
// here, never CSS inside a document.
//
// A blank is written `[what goes here]` and highlighted on screen, never filled with a guess
// (source/formats/document.md ▸ Blanks). A real link `[label](url)` is not a blank.

import { typo } from '../deck/text.mjs';

export const DIRECTIVES = ['rows', 'cols', 'compare', 'steps', 'timeline', 'callout', 'quote', 'facts', 'fold', 'pagebreak'];

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Bold, italic, code, links and blanks in one line. The text is escaped first. */
export function inline(text, ctx = {}) {
  const codes = [];
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  const links = [];
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => { links.push([label, href]); return `\u0001${links.length - 1}\u0001`; });
  s = typo(esc(s), ctx.lang);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?![\w*])/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]\u0001]+)\]/g, (_, b) => { ctx.blanks?.push(b); return `<mark class="doc-blank">[${b}]</mark>`; });
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => {
    const [label, href] = links[Number(i)];
    const ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${esc(href)}"${ext}>${typo(esc(label), ctx.lang)}</a>`;
  });
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
}

const LIST_ITEM = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const indentOf = (l) => l.match(/^\s*/)[0].length;
const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isTableSep = (l) => /^\|?\s*:?-{2,}/.test(l.trim());
const isBlockStart = (l) => /^(#{1,4}\s|>|```|\||:::)/.test(l) || LIST_ITEM.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l);

function renderList(lines, start, base, ctx) {
  const ordered = /^\s*\d+\./.test(lines[start]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && LIST_ITEM.test(lines[j]) && indentOf(lines[j]) >= base) { i = j; continue; }
      break;
    }
    const m = line.match(LIST_ITEM);
    const ind = indentOf(line);
    if (m && ind === base) { items.push({ text: m[3], children: [] }); i++; continue; }
    if (m && ind > base && items.length) { const r = renderList(lines, i, ind, ctx); items.at(-1).children.push(r.html); i = r.i; continue; }
    if (!m && ind > base && items.length) { items.at(-1).text += ` ${line.trim()}`; i++; continue; }
    break;
  }
  const tag = ordered ? 'ol' : 'ul';
  const li = ({ text, children }) => {
    const task = text.match(/^\[([ xX])\]\s+(.*)$/);
    const body = task ? `<span class="doc-check">${task[1] === ' ' ? '☐' : '☑'}</span>${inline(task[2], ctx)}` : inline(text, ctx);
    return `<li>${body}${children.join('')}</li>`;
  };
  return { html: `<${tag}>${items.map(li).join('')}</${tag}>`, i };
}

/** The bullets of a directive, continuation lines joined, and "**Label**: text" read apart. */
function itemsOf(body) {
  const items = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) { items.push(m[1]); continue; }
    if (line.trim() && items.length) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items.map((t) => {
    const lab = t.match(/^\*\*([^*]+)\*\*\s*[:|·-]?\s*(.*)$/);
    return lab ? { label: lab[1].trim(), text: lab[2].trim() } : { label: '', text: t.trim() };
  });
}

/** Sub-blocks opened by a `### ` heading, for columns and comparisons. */
function sectionsOf(body) {
  const parts = body.split(/^### /m);
  parts.shift();
  return parts.map((p) => { const [title, ...rest] = p.split('\n'); return { title: title.trim(), body: rest.join('\n') }; });
}

function renderDirective(name, arg, body, ctx) {
  const md = (s) => renderMarkdown(s, ctx);
  const il = (s) => inline(s, ctx);
  switch (name) {
    case 'rows':
      return `<dl class="doc-rows">${itemsOf(body).map((r) => `<div><dt>${il(r.label)}</dt><dd>${il(r.text)}</dd></div>`).join('')}</dl>`;
    case 'cols': {
      const parts = sectionsOf(body);
      return `<div class="doc-cols" style="--n:${Number(arg) || parts.length || 2}">${parts.map((p) => `<div><h4>${il(p.title)}</h4>${md(p.body)}</div>`).join('')}</div>`;
    }
    // Two or more cards side by side; the last one is the option the document argues for.
    case 'compare':
      return `<div class="doc-compare">${sectionsOf(body).map((p, k, all) => `<div${k === all.length - 1 ? ' class="ours"' : ''}><h4>${il(p.title)}</h4>${md(p.body)}</div>`).join('')}</div>`;
    case 'steps':
      return `<ol class="doc-steps">${itemsOf(body).map((s, k) => `<li><span class="doc-steps-n">${k + 1}</span><div>${s.label ? `<b>${il(s.label)}</b>` : ''}${s.text ? `<p>${il(s.text)}</p>` : ''}</div></li>`).join('')}</ol>`;
    case 'timeline':
      return `<ol class="doc-timeline">${itemsOf(body).map((s) => `<li><span class="doc-timeline-t">${il(s.label)}</span><span>${il(s.text)}</span></li>`).join('')}</ol>`;
    case 'callout':
      return `<aside class="doc-callout">${arg ? `<div class="doc-label">${il(arg)}</div>` : ''}${md(body)}</aside>`;
    case 'quote':
      return `<figure class="doc-pull"><blockquote>${md(body)}</blockquote>${arg ? `<figcaption>${il(arg)}</figcaption>` : ''}</figure>`;
    case 'facts':
      return `<ul class="doc-facts">${itemsOf(body).map((f) => `<li>${f.label ? `<b>${il(f.label)}</b> ` : ''}${il(f.text)}</li>`).join('')}</ul>`;
    // Folded on screen, opened by a click; printed open.
    case 'fold':
      return `<details class="doc-fold"><summary>${il(arg || 'Details')}</summary><div>${md(body)}</div></details>`;
    case 'pagebreak':
      return '<div class="doc-pagebreak" data-pagebreak aria-hidden="true"></div>';
    default:
      throw new Error(`unknown directive ":::${name}" (known: ${DIRECTIVES.join(', ')})`);
  }
}

/** A markdown body, rendered. HTML comments are removed: they are notes for the agent. */
export function renderMarkdown(src, ctx = {}) {
  const lines = String(src ?? '').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const dir = line.match(/^:::([a-z][\w-]*)\s*(.*)$/);
    if (dir) {
      const buf = [];
      i++;
      // A pagebreak stands alone; every other directive runs to its closing `:::`.
      if (dir[1] !== 'pagebreak') { while (i < lines.length && !/^:::\s*$/.test(lines[i])) buf.push(lines[i++]); i++; }
      out.push(renderDirective(dir[1], dir[2].trim(), buf.join('\n'), ctx));
      continue;
    }
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (h) {
      const level = Math.max(2, h[1].length);
      out.push(`<h${level} id="${slugify(h[2])}">${inline(h[2], ctx)}</h${level}>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'), ctx)}</blockquote>`);
      continue;
    }
    if (/^\|/.test(line.trim()) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) rows.push(cells(lines[i++]));
      const thead = head.some(Boolean) ? `<thead><tr>${head.map((c) => `<th>${inline(c, ctx)}</th>`).join('')}</tr></thead>` : '';
      out.push(`<table>${thead}<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, ctx)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (LIST_ITEM.test(line)) { const r = renderList(lines, i, indentOf(line), ctx); out.push(r.html); i = r.i; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && isBlockStart(lines[i]))) buf.push(lines[i++].trim());
    out.push(`<p>${inline(buf.join(' '), ctx)}</p>`);
  }
  return out.join('\n');
}
