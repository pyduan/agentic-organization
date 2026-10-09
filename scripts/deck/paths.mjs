// Where this repo keeps what a deck is built from. The only file of the engine that knows the
// layout of the repo it lives in.
//
//   source/brand/tokens.css   the brand's colours and fonts, read by the kit theme
//   source/brand/deck/        the brand's deck layer: theme.css, components.mjs, assets/, and
//                             deck.md, the brand's own deck rules (owner files, never touched by
//                             a kit update)
//   decks/<slug>/deck.mdx     one folder per deck, with its images in assets/
//   site/public/decks/        what `publish` copies to, only when the owner asks for it

import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function locate() {
  return {
    root: ROOT,
    tokens: [join(ROOT, 'source', 'brand', 'tokens.css')].filter(existsSync),
    brand: join(ROOT, 'source', 'brand', 'deck'),
    decks: [join(ROOT, 'decks')],
    publish: join(ROOT, 'site', 'public', 'decks'),
    assetMode: 'link',
  };
}
