import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route, body, mail, title } from './suggestion.mjs';

test('the route follows the rights, and forking only when both settings allow it', () => {
  assert.equal(route({ permissions: { push: true, pull: true } }), 'direct');
  assert.equal(route({ permissions: { pull: true }, orgForks: true, repoForks: true }), 'pr-fork');
  assert.equal(route({ permissions: { pull: true }, orgForks: false, repoForks: true }), 'issue');
  assert.equal(route({ permissions: { pull: true }, issues: false }), 'none');
  assert.equal(route({ permissions: {} }), 'none');
});

test('the request says who, what, why and impact; the mail carries no git words', () => {
  const s = { who: 'Lee', what: 'the rota template', why: 'two shifts were missing on bank holidays', impact: 'the rota covers them', link: 'https://example.org/x' };
  assert.match(title(s), /^Suggestion from Lee: the rota template$/);
  const b = body(s);
  for (const k of ['Who suggests', 'What would change', 'Why', 'What it changes']) assert.match(b, new RegExp(k));
  const m = mail({ ...s, head: 'sam@example.org' });
  assert.equal(m.to, 'sam@example.org');
  assert.match(m.text, /https:\/\/example\.org\/x/);
  assert.doesNotMatch(m.text, /\b(pull request|fork|branch|commit|merge|repo)\b/i);
});
