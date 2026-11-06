// The tab badges: what the build writes (apps/dashboard/intranet.mjs ▸ newsItems) and how the
// browser counts it (apps/dashboard/badges.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newsItems, renderIntranet } from '../apps/dashboard/intranet.mjs';

await import('../apps/dashboard/badges.js');
const { count, visit, tabOf } = globalThis.intranetBadges;

const PATHS = ['', 'projects/', 'rota/'];
const items = [
  { key: 'a', href: 'projects/brochure/', date: '2026-01-14' },
  { key: 'b', href: 'projects/brochure/', date: '2026-01-02' },
  { key: 'c', href: 'rota/week/', date: '2026-01-14' },
  { key: 'd', href: 'elsewhere/', date: '2026-01-14' },
];

test('an item counts on the tab with the longest matching path, never on Home', () => {
  assert.equal(tabOf('projects/brochure/', PATHS), 'projects/');
  assert.equal(tabOf('elsewhere/', PATHS), null);
});

test('a tab never visited counts only the last week; a visit clears it; a new item counts again', () => {
  const today = '2026-01-15';
  assert.deepEqual(count(items, PATHS, {}, { today }), { '': 0, 'projects/': 1, 'rota/': 1 });
  const seen = visit({}, 'projects/', items, PATHS, '2026-01-15T09:00:00Z');
  assert.equal(count(items, PATHS, seen, { today })['projects/'], 0);
  const more = [...items, { key: 'e', href: 'projects/rota-app/', date: '2026-01-15' }];
  assert.equal(count(more, PATHS, seen, { today })['projects/'], 1);
});

test('the build writes news.json and badges.js only when there is news', () => {
  const data = { org: 'Acme', generated: '2026-01-15T08:00:00Z', projects: [], private: [], recap: [] };
  const quiet = renderIntranet({ data, home: null, tools: [], css: '', today: '2026-01-15' });
  assert.equal('news.json' in quiet, false);
  assert.doesNotMatch(quiet['index.html'], /badges\.js/);
  const recap = [{ date: '2026-01-14', page: 'projects/brochure/', project: 'Brochure', text: 'Proof sent to the printer' }];
  const busy = renderIntranet({ data: { ...data, recap }, home: null, tools: [], css: '', today: '2026-01-15' });
  const news = JSON.parse(busy['news.json']);
  assert.equal(news.items.length, 1);
  assert.doesNotMatch(busy['news.json'], /printer/, 'keys, never the text');
  assert.match(busy['index.html'], /<script src="badges\.js" data-base=""/);
  assert.ok(busy['badges.js'].includes('intranet.tabs.seen'));
  assert.deepEqual(newsItems({ recap: [{ date: '2026-01-14', text: 'no page' }] }), []);
});
