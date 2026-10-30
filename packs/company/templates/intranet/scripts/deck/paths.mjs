// Where the company keeps what a deck is built from. The only file of the deck engine that knows
// the layout of the repos around it; the rest is the kit's engine, copied from the central repo and
// kept identical by vendor-sync (vendor/<central>.json).
//
//   <central>/source/brand/tokens.css   the company's colours and fonts, read by the kit theme
//   <central>/source/brand/voice.md     the company's voice: its words to avoid are read over every deck
//   <central>/source/brand/deck/        the company's deck layer: theme.css, components.mjs, assets/,
//                                       deck.md (its own deck rules)
//   strategy/decks/<slug>/deck.mdx  the company's own decks: pitch, offer, a talk
//   customers/decks/<slug>/deck.mdx the decks made for one customer (frontmatter `company:`)
//   intranet/public/decks/<slug>/   where they are built, served behind the intranet's access
//   lang                            a deck's language when its frontmatter names none: the
//                                   intranet's own (src/lib/i18n.mjs)

import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const INTRANET = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = resolve(INTRANET, '..');
const OUT = join(INTRANET, 'public', 'decks');

// The config is read when asked for, not when this file loads: in the kit itself config.mjs still
// holds its placeholders, and the engine's tests must run there before any company exists.
export async function locate() {
  const { repos, centralPaths } = await import('../../config.mjs');
  const brand = join(ROOT, repos.central, centralPaths?.brand ?? 'source/brand');
  return {
    root: INTRANET,
    tokens: [join(brand, 'tokens.css')].filter(existsSync),
    voice: [join(brand, 'voice.md')].filter(existsSync),
    brand: join(brand, 'deck'),
    decks: [join(ROOT, repos.strategy, 'decks'), join(ROOT, repos.customers, 'decks')],
    out: OUT,
    outFor: (deckDir, slug) => join(OUT, slug, 'index.html'),
    publish: null,
    assetMode: 'copy',
    lang: 'en',
  };
}
