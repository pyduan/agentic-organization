// The session-start re-raise, tested on throwaway to-do files.
//
// Two properties are load-bearing and pull in opposite directions, which is why
// they are both here:
//
//   · it must FIRE on an open decision, because the failure it exists for is a
//     decision that sat correctly written in a file for eight days while several
//     sessions worked that dossier and none reopened it;
//   · it must stay SILENT on everything else, because a session-start notice that
//     lists every overdue to-do is one nobody reads by the third day, and then the
//     decision is invisible again for a new reason.
//
// The first version of this script could not fire at all: `parse()` returns the
// array of items and it read `.items`, so it found nothing and its silence looked
// exactly like a clean repo. Caught by calibrating on a fixture built to fail.
// That is the whole reason the "must fire" cases come first below.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, '..');

/** A throwaway kit with one next-steps.md, and the real lib and script in place. */
function workshop(body) {
  const dir = mkdtempSync(join(tmpdir(), 'decide-'));
  mkdirSync(join(dir, 'projects/x'), { recursive: true });
  writeFileSync(join(dir, 'projects/x/next-steps.md'), `# Next steps\n\n${body}\n`);
  cpSync(join(KIT, 'lib'), join(dir, 'lib'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  cpSync(join(KIT, 'scripts/open-decisions.mjs'), join(dir, 'scripts/open-decisions.mjs'));
  return dir;
}

const run = (dir) =>
  execFileSync('node', ['scripts/open-decisions.mjs'], { cwd: dir, encoding: 'utf8' });

const on = (body, fn) => {
  const dir = workshop(body);
  try { fn(run(dir)); } finally { rmSync(dir, { recursive: true, force: true }); }
};

// ------------------------------------------------------------ it must fire

test('an overdue decision is raised, with who owes it and how long it has waited', () => {
  on('- [ ] Trancher l’accès à l’archive #decide @brigitte due:2020-01-31 ^ab12', (out) => {
    assert.match(out, /1 decision\(s\) waiting on a person/);
    assert.match(out, /Trancher l’accès à l’archive/);
    assert.match(out, /@brigitte/);
    assert.match(out, /\d+d past 2020-01-31/, 'the age is the number that matters, not that it exists');
    assert.match(out, /Writing one down again is not raising it/);
  });
});

test('a decision with no date is raised and named as the one nobody faces', () => {
  on('- [ ] Décision sans date #decide @paul ^cd34', (out) => {
    assert.match(out, /1 decision\(s\)/);
    assert.match(out, /NO DATE — nobody has to face this one/);
  });
});

test('a constrained choice is raised once its date has passed', () => {
  on('- [ ] Serrure posée sous contrainte #revisit due:2020-06-30 ^ef56', (out) => {
    assert.match(out, /1 hypothes\(es\) or constrained choice\(s\)/);
    assert.match(out, /A constraint that has lifted/);
  });
});

// ------------------------------------------------------------ it must stay silent

test('silence is the default, and that is what keeps it worth reading', () => {
  on('- [ ] Écrire la page de dons @paul due:2020-01-01 ^zz99', (out) => {
    assert.equal(out.trim(), '', 'an ordinary overdue to-do is not a decision and must not appear');
  });
});

test('a revisit whose date has not come does not nag', () => {
  on('- [ ] Revoir l’hypothèse plus tard #revisit due:2099-01-01 ^gh78', (out) => {
    assert.equal(out.trim(), '');
  });
});

test('a decision that has been taken goes quiet by itself', () => {
  on('- [x] Trancher l’accès #decide @brigitte due:2020-01-31 done:2020-02-01 ^kl12', (out) => {
    assert.equal(out.trim(), '', 'ticking it is what stops it: no second gesture to remember');
  });
});

test('the two are reported apart, and an ordinary overdue beside them is still ignored', () => {
  on([
    '- [ ] Trancher l’accès #decide @brigitte due:2020-01-31 ^ab12',
    '- [ ] Serrure sous contrainte #revisit due:2020-06-30 ^ef56',
    '- [ ] Un todo ordinaire en retard due:2020-01-01 ^ij90',
  ].join('\n'), (out) => {
    assert.match(out, /1 decision\(s\)/);
    assert.match(out, /1 hypothes\(es\)/);
    assert.doesNotMatch(out, /todo ordinaire/);
  });
});
