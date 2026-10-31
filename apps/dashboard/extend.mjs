// The intranet's extension point: how an instance adds its own tabs, pages, home-page sections and
// styles without editing the kit's files.
//
// Why it exists: apps/dashboard/ and scripts/dashboard-data.mjs belong to the kit, and every
// update-kit may replace them. Two instances that needed their own views patched the kit at run
// time instead (pushing into the exported TABS, re-rendering the kit's pages from dist/data.json,
// splicing HTML after `<main class="wrap">`, copying the page shell, chaining a second build in
// package.json). Each joint broke silently or loudly with the next kit change. This file replaces
// all of them with one contract the kit keeps stable.
//
// The instance's file is apps/intranet-extend/index.mjs, outside every path kit-sync owns
// (scripts/kit-sync.mjs ▸ FRAMEWORK), so no update ever touches it. `npm run intranet` loads it
// when it exists; when it does not, the intranet is the kit's own, byte for byte.
//
//   // apps/intranet-extend/index.mjs
//   export default function extend(intranet) {
//     intranet.tab('rota/', 'Rota');                        // before Projects unless placed
//     intranet.group('Volunteers', ['rota/', 'rooms/']);    // a heading in the sidebar of sections
//     intranet.page('rota/', (c) => ({ title: 'Rota', body: `<h1>Rota</h1>…` }));
//     intranet.home('top', (c) => `<h2>This week</h2>…`);   // top · before-tools · end
//     intranet.css(new URL('./rota.css', import.meta.url)); // tokens only
//     const drafts = intranet.local?.list('drafts/');       // local/: a --local build only, never deployed
//   }
//
// The full contract is source/formats/dashboard.md ▸ Adding your own views.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { esc, inline, renderMarkdown, slugify } from '../../scripts/doc/markdown.mjs';
import { parse as parseTodos } from '../../lib/todo.mjs';
import {
  HOME_SLOTS, LOCALE, TABS, t, shell, withSide, tile, todoRow, projectCard, feed,
} from './intranet.mjs';

/** Where an instance keeps its extension, from the repository's root. Never shipped by the kit. */
export const EXTENSION = 'apps/intranet-extend/index.mjs';

// A colour written as a value instead of a token: the intranet follows the brand through tokens.css
// only (AGENTS.md ▸ Tokens only), so an extension's stylesheet may not carry a palette of its own.
const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;

const fail = (msg) => { throw new Error(`intranet extension: ${msg}`); };

/** A path inside the intranet: relative, no `..`, a folder ending in `/` or a file with its extension. */
function checkPath(kind, path) {
  if (typeof path !== 'string' || /^\/|\\|(^|\/)\.\.(\/|$)|^[a-z][a-z0-9+.-]*:/i.test(path)) fail(`${kind} path ${JSON.stringify(path)} must be a relative path inside the intranet`);
  if (kind === 'tab' && path && !path.endsWith('/')) fail(`the tab ${path} must be a folder, ending in /`);
  if (kind === 'page' && path && !path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) fail(`the page ${path} must be a folder ending in / or a file with its extension`);
}

/** A path as a log or a comment shows it: from the repository's root when it is inside it. */
const shownPath = (root, file) => { const r = relative(root, file); return r.startsWith('..') ? file : r; };

/** The folder of material kept on one machine only, git-ignored, read with `--local` alone. */
export const LOCAL_DIR = 'local';

/** Is this path inside local/? The repository reader refuses it, so only `intranet.local` reads there. */
const inLocal = (rel) => String(rel).replace(/^\.\//, '').split('/')[0] === LOCAL_DIR;

/**
 * The repository, read the way the kit's build reads it: a missing file is empty, never an error.
 * `local/` is refused: what is in it may only reach a page through `intranet.local`, which exists
 * only in a `--local` build, the one `npm run deploy:intranet` refuses to publish.
 */
export function repoReader(root, { refuseLocal = true } = {}) {
  const abs = (rel) => {
    if (refuseLocal && inLocal(rel)) fail(`${rel} is in ${LOCAL_DIR}/, which is read through intranet.local only (null unless the build runs with --local)`);
    return join(root, rel);
  };
  const read = (rel) => { const file = abs(rel); try { return readFileSync(file, 'utf8'); } catch { return ''; } };
  return {
    root,
    read,
    exists: (rel) => existsSync(abs(rel)),
    /** The entries of a folder, sorted; `ext: '.md'` keeps those files, `dirs: true` the folders. */
    list: (rel, { ext = null, dirs = false } = {}) => {
      const dir = abs(rel);
      try {
        return readdirSync(dir).filter((n) => {
          if (n.startsWith('.')) return false;
          const isDir = statSync(join(dir, n)).isDirectory();
          return dirs ? isDir : !isDir && (!ext || n.endsWith(ext));
        }).sort();
      } catch { return []; }
    },
    /** A to-do file in the canonical format (source/formats/todo.md), parsed by lib/todo.mjs. */
    todos: (rel) => parseTodos(read(rel)),
  };
}

/**
 * Load the instance's extension and run it, collecting what it registers. Returns null when there
 * is none. `data` is what the kit's build gathered (projects, recap, org), so a view can use it.
 */
export async function loadExtension({ root, data, today, file = join(root, EXTENSION), local = false }) {
  if (!file || !existsSync(file)) return null;
  const mod = await import(pathToFileURL(resolve(file)).href);
  const extend = mod.default;
  if (typeof extend !== 'function') fail(`${relative(root, file)} must export a default function`);

  const reg = { file: shownPath(root, file), strings: {}, tabs: [], groups: [], home: {}, pages: [], css: [] };
  const repo = repoReader(root);
  // local/ on this machine, only in a --local build: null otherwise, so a view tests `if (intranet.local)`.
  const localReader = local ? repoReader(join(root, LOCAL_DIR), { refuseLocal: false }) : null;
  const html = { esc, inline, renderMarkdown, slugify };

  const api = {
    ...repo,
    data,
    today,
    html,
    ...html,
    /** local/, read only in a `--local` build (never deployed); null in every other build. */
    local: localReader,
    /** Words for the chrome: new keys for your tabs, or the kit's own keys translated. */
    strings(words) { Object.assign(reg.strings, words); },
    /** A tab in the one row: `label` is a key of the strings or the text itself. */
    tab(path, label, { before, after } = {}) {
      checkPath('tab', path);
      if (reg.tabs.some((x) => x.path === path)) fail(`the tab ${path} is added twice`);
      reg.tabs.push({ path, label, before, after });
    },
    /**
     * A heading in the sidebar of sections, over the tabs `paths` names in that order (the kit's
     * own, '' and 'projects/', included). Declaring one turns the row of tabs into that sidebar.
     */
    group(label, paths) {
      if (!label || !Array.isArray(paths) || !paths.length) fail('a group needs a label and a list of tab paths');
      if (reg.groups.some((g) => g.label === label)) fail(`the group ${label} is declared twice`);
      for (const p of paths) {
        const other = reg.groups.find((g) => g.paths.includes(p));
        if (other || paths.indexOf(p) !== paths.lastIndexOf(p)) fail(`the tab ${JSON.stringify(p)} is in two groups${other ? ` (${other.label} and ${label})` : ''}`);
      }
      reg.groups.push({ label, paths: [...paths] });
    },
    /** A page: `render(c)` returns { title, body, side?, tab? }, or a whole file as a string. */
    page(path, render) {
      checkPath('page', path);
      if (typeof render !== 'function') fail(`the page ${path} needs a render function`);
      if (reg.pages.some((x) => x.path === path)) fail(`the page ${path} is added twice`);
      reg.pages.push({ path, render });
    },
    /** A section of the home page, at one of HOME_SLOTS: `render(c)` returns its HTML. */
    home(slot, render) {
      if (!HOME_SLOTS.includes(slot)) fail(`no home slot "${slot}"; the slots are ${HOME_SLOTS.join(', ')}`);
      if (typeof render !== 'function') fail(`the home section at ${slot} needs a render function`);
      (reg.home[slot] ||= []).push(render);
    },
    /** Styles appended after the kit's intranet.css: a file (a URL) or the text. Tokens only. */
    css(source) {
      const isFile = source instanceof URL;
      const text = isFile ? readFileSync(fileURLToPath(source), 'utf8') : String(source);
      const from = isFile ? shownPath(root, fileURLToPath(source)) : reg.file;
      const bare = text.replace(/\/\*[\s\S]*?\*\//g, '');
      const hit = bare.match(LITERAL_COLOUR);
      if (hit) fail(`${from} writes a colour (${hit[0]}…); use the tokens of tokens.css (var(--color-…)) so the intranet follows the brand`);
      reg.css.push({ from, text });
    },
  };

  await extend(api);

  // A group names tabs, which may be added after it: checked once everything is registered.
  const known = new Set([...TABS.map(([to]) => to), ...reg.tabs.map((x) => x.path)]);
  for (const g of reg.groups) for (const p of g.paths) if (!known.has(p)) fail(`the group ${g.label} names ${JSON.stringify(p)}, which is no tab`);

  // What a page's or a section's render receives: the same helpers, and the pieces of the kit's
  // pages bound to where the page sits, so a link written `c.href('rota/')` works at any depth.
  reg.context = ({ data: d, today: day, path }) => {
    const depth = path.split('/').length - 1;
    const base = '../'.repeat(depth);
    return {
      ...repo,
      ...html,
      html,
      data: d,
      today: day,
      local: localReader,
      path,
      base,
      LOCALE,
      t,
      href: (to = '') => `${base}${to}`,
      tile,
      todoRow: (item, opts = {}) => todoRow(item, day, { base, ...opts }),
      projectCard: (p) => projectCard(p, base, day),
      feed: (entries) => feed(entries, base),
      withSide: (side, inner) => withSide({ current: path, ...side }, base, inner),
      shell: (o) => shell({ data: d, depth, tab: null, title: null, ...o }),
    };
  };
  return reg;
}

/**
 * Every internal link in a built intranet that points at no file of it, as [{ file, href }].
 * `also` lists paths served beside the built files (the packs page the build copies, for one).
 */
export function brokenLinks(files, { also = [] } = {}) {
  const have = new Set([...Object.keys(files), ...also]);
  const out = [];
  for (const [file, text] of Object.entries(files)) {
    if (!file.endsWith('.html')) continue;
    const dir = dirname(file) === '.' ? '' : `${dirname(file)}/`;
    for (const [, raw] of String(text).matchAll(/\bhref="([^"]*)"/g)) {
      const href = raw.replace(/&amp;/g, '&').split('#')[0].split('?')[0];
      if (!raw || raw.startsWith('#') || /^([a-z][a-z0-9+.-]*:|\/)/i.test(href)) continue;
      const target = join(dir, href || '.').replace(/^\.\/?/, '');
      const norm = target === '.' || target === '' ? 'index.html'
        : /\/$/.test(href) || href === '' || !/\.[a-z0-9]+$/i.test(target) ? `${target.replace(/\/$/, '')}/index.html` : target;
      if (!have.has(norm)) out.push({ file, href: raw });
    }
  }
  return out;
}
