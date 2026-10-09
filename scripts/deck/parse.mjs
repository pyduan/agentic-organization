// Reads a deck file: a frontmatter block, then components, nothing else.
//
// The format is the subset of MDX that the Bayes Impact intranet and a consulting practice's decks
// converged on:
// a slide is a component, its content goes in literal props, and a deck imports nothing. Parsing it
// here rather than through an MDX compiler keeps the kit free of dependencies, and lets the parser
// refuse what MDX would accept: an expression, an import, a raw <div> with a style on it. Each of
// those is how a deck starts carrying its own layout, and a deck that carries its own layout is
// invisible to every rule and every check the kit has.
//
//   ---
//   title: "Comité de pilotage"
//   ---
//
//   <Cover title="…" />
//   <Slide title="…" lead="…">
//     <Cards items={[{ title: "…", text: "…" }]} />
//     <Callout>La phrase que la slide doit laisser</Callout>
//   </Slide>
//
//   {/* A comment: kept in the source, never published. */}

export class DeckError extends Error {
  constructor(message, line) {
    super(line ? `line ${line}: ${message}` : message);
    this.line = line;
  }
}

/** Frontmatter: flat `key: value` lines. Quoted values keep their colons; that is the YAML trap. */
export function frontmatter(src) {
  const m = src.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { meta: {}, body: src, lineOffset: 0 };
  const meta = {};
  m[1].split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim() || raw.trim().startsWith('#')) return;
    const kv = raw.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!kv) throw new DeckError(`frontmatter: expected "key: value", got "${raw.trim()}"`, i + 2);
    let v = kv[2].trim();
    if (!/^["']/.test(v)) v = v.replace(/\s+#.*$/, '');
    if (/^".*"$/.test(v)) v = JSON.parse(v);
    else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    else if (v === 'true' || v === 'false') v = v === 'true';
    else if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (/:\s/.test(v)) throw new DeckError(`frontmatter: quote the value of "${kv[1]}", it contains ": "`, i + 2);
    meta[kv[1]] = v;
  });
  return { meta, body: src.slice(m[0].length), lineOffset: m[0].split('\n').length - 1 };
}

/**
 * A JS literal, and only a literal: objects, arrays, strings, numbers, true, false, null. Comments
 * and trailing commas are allowed, so a long list of items stays editable by hand. A name, a call
 * or a spread is refused, which is what makes it safe to read without evaluating anything.
 */
export function parseLiteral(src, start = 0, lineAt = () => 0) {
  let i = start;
  const fail = (msg) => { throw new DeckError(msg, lineAt(i)); };
  const ws = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); if (e < 0) fail('unclosed comment'); i = e + 2; continue; }
      return;
    }
  };
  const string = () => {
    const q = src[i++];
    let out = '';
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') {
        const c = src[++i];
        out += { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '`': '`' }[c] ?? (c === 'u' ? String.fromCharCode(parseInt(src.slice(i + 1, (i += 4) + 1), 16)) : c);
        i++;
        continue;
      }
      if (q === '`' && src.startsWith('${', i)) fail('template expressions are not allowed in a deck; write the text out');
      if (q !== '`' && src[i] === '\n') fail('a string cannot span lines; use backticks for a long text');
      out += src[i++];
    }
    if (src[i] !== q) fail('unclosed string');
    i++;
    return out;
  };
  const value = () => {
    ws();
    const c = src[i];
    if (c === '{') {
      i++;
      const o = {};
      for (;;) {
        ws();
        if (src[i] === '}') { i++; return o; }
        let key;
        if (src[i] === '"' || src[i] === "'") key = string();
        else {
          const k = src.slice(i).match(/^[A-Za-z_$][\w$-]*/);
          if (!k) fail(`expected a key, found "${src.slice(i, i + 12)}"`);
          key = k[0];
          i += key.length;
        }
        ws();
        if (src[i] !== ':') fail(`expected ":" after "${key}"`);
        i++;
        o[key] = value();
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return o; }
        fail(`expected "," or "}" in an object, found "${src.slice(i, i + 12)}"`);
      }
    }
    if (c === '[') {
      i++;
      const a = [];
      for (;;) {
        ws();
        if (src[i] === ']') { i++; return a; }
        a.push(value());
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return a; }
        fail(`expected "," or "]" in a list, found "${src.slice(i, i + 12)}"`);
      }
    }
    if (c === '"' || c === "'" || c === '`') return string();
    const num = src.slice(i).match(/^-?\d+(\.\d+)?/);
    if (num) { i += num[0].length; return Number(num[0]); }
    for (const [w, v] of [['true', true], ['false', false], ['null', null]]) {
      if (src.startsWith(w, i) && !/[\w$]/.test(src[i + w.length] || '')) { i += w.length; return v; }
    }
    fail(`only literal values are allowed in a deck (text, numbers, lists, objects), found "${src.slice(i, i + 20).split('\n')[0]}"`);
  };
  const v = value();
  ws();
  return { value: v, end: i };
}

/** The body: a tree of { type: 'el', name, props, children, line } and { type: 'text', text, line }. */
export function parseBody(body, lineOffset = 0) {
  const lineStarts = [0];
  for (let k = 0; k < body.length; k++) if (body[k] === '\n') lineStarts.push(k + 1);
  const lineAt = (pos) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1; }
    return lo + 1 + lineOffset;
  };
  let i = 0;

  const comment = () => {
    const e = body.indexOf('*/}', i);
    if (e < 0) throw new DeckError('unclosed {/* comment */}', lineAt(i));
    i = e + 3;
  };

  const element = () => {
    const at = i;
    const m = body.slice(i).match(/^<([A-Z][A-Za-z0-9]*)/);
    i += m[0].length;
    const props = {};
    for (;;) {
      while (/\s/.test(body[i] || '')) i++;
      if (body.startsWith('{/*', i)) { comment(); continue; }
      if (body.startsWith('/>', i)) { i += 2; return { type: 'el', name: m[1], props, children: [], line: lineAt(at) }; }
      if (body[i] === '>') { i++; break; }
      const a = body.slice(i).match(/^([A-Za-z][\w-]*)/);
      if (!a) throw new DeckError(`<${m[1]}>: unexpected "${body.slice(i, i + 15).split('\n')[0]}"`, lineAt(i));
      i += a[1].length;
      if (body[i] !== '=') { props[a[1]] = true; continue; }
      i++;
      const q = body[i];
      if (q === '"' || q === "'") {
        const end = body.indexOf(q, i + 1);
        if (end < 0) throw new DeckError(`<${m[1]} ${a[1]}=…>: unclosed quote`, lineAt(i));
        props[a[1]] = body.slice(i + 1, end);
        i = end + 1;
      } else if (q === '{') {
        const { value, end } = parseLiteral(body, i + 1, lineAt);
        if (body[end] !== '}') throw new DeckError(`<${m[1]} ${a[1]}={…}>: expected "}" after the value`, lineAt(end));
        props[a[1]] = value;
        i = end + 1;
      } else throw new DeckError(`<${m[1]} ${a[1]}=…>: a value is "text" or {literal}`, lineAt(i));
    }
    const children = nodes(m[1]);
    return { type: 'el', name: m[1], props, children, line: lineAt(at) };
  };

  const nodes = (closing) => {
    const out = [];
    let text = '', textAt = i;
    const flush = () => {
      if (text.trim()) out.push({ type: 'text', text: text.replace(/^\s*\n|\n\s*$/g, '').trim(), line: lineAt(textAt) });
      text = '';
    };
    while (i < body.length) {
      if (body.startsWith('{/*', i)) { comment(); continue; }
      if (body.startsWith('</', i)) {
        const m = body.slice(i).match(/^<\/([A-Za-z][A-Za-z0-9]*)\s*>/);
        if (!m || m[1] !== closing) throw new DeckError(`unexpected ${body.slice(i, i + 20).split('\n')[0]}${closing ? `, expected </${closing}>` : ''}`, lineAt(i));
        i += m[0].length;
        flush();
        return out;
      }
      if (/^<[A-Z]/.test(body.slice(i, i + 2))) { flush(); out.push(element()); textAt = i; continue; }
      if (/^<[a-z!]/.test(body.slice(i, i + 2))) {
        throw new DeckError(`raw HTML (${body.slice(i, i + 12).split(/[\s>]/)[0]}…) is not allowed in a deck: compose a component, or add one to the brand`, lineAt(i));
      }
      if (/^(import|export)\s/.test(body.slice(i, i + 7)) && (i === 0 || body[i - 1] === '\n')) {
        throw new DeckError('a deck imports nothing: every component comes from the registry', lineAt(i));
      }
      if (body[i] === '{') throw new DeckError('an expression is not allowed in a deck text; write the text out', lineAt(i));
      if (!text) textAt = i;
      text += body[i++];
    }
    if (closing) throw new DeckError(`<${closing}> is never closed`, lineAt(i));
    flush();
    return out;
  };

  return nodes(null);
}

export function parseDeck(src) {
  const { meta, body, lineOffset } = frontmatter(src);
  const tree = parseBody(body, lineOffset);
  const stray = tree.find((n) => n.type === 'text');
  if (stray) throw new DeckError(`text outside a slide: "${stray.text.slice(0, 40)}"`, stray.line);
  return { meta, slides: tree };
}
