// The workspace files (docs/workspace/, written by scripts/install-workspace.mjs) and the
// hooks they run from the parent folder.
//
// install-workspace must write what is missing, refresh only what it wrote before, leave a
// CLAUDE.md someone wrote alone, give a settings file someone wrote the hooks it lacks and
// nothing else, and refuse the home folder. The rendered settings must run the router's own
// hooks in exec form (node and its arguments, no shell, so Windows runs them too) with the
// router's own tuning. At session start they must name a repo they could not update and a
// machine with no git identity; at the end, session-end must check every repo of a workspace.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, apply, render, Stop, kitHooks, lacking } from './install-workspace.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = ['-c', 'user.name=Sam', '-c', 'user.email=sam@example.com'];
const git = (cwd, ...a) => execFileSync('git', [...ID, ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** A workspace folder holding a router called `acme-ops` with the kit's templates and hooks. */
function workspace() {
  const ws = realpathSync(mkdtempSync(join(tmpdir(), 'ws-')));
  const router = join(ws, 'acme-ops');
  mkdirSync(join(router, 'docs'), { recursive: true });
  cpSync(join(KIT, 'docs/workspace'), join(router, 'docs/workspace'), { recursive: true });
  cpSync(join(KIT, '.claude/hooks'), join(router, '.claude/hooks'), { recursive: true });
  // The start runs the router's sync, which reads the map through lib/workspace.mjs.
  for (const f of ['scripts/workspace-sync.mjs', 'lib/workspace.mjs']) cpSync(join(KIT, f), join(router, f));
  return { ws, router };
}
const home = () => mkdtempSync(join(tmpdir(), 'home-'));

/** Run the hooks the workspace settings wire for one event, as Claude Code does in exec form. */
function runHooks(ws, event, input = {}, env = {}) {
  const settings = JSON.parse(readFileSync(join(ws, '.claude/settings.json'), 'utf8'));
  let out = '';
  for (const g of settings.hooks[event]) {
    for (const h of g.hooks) {
      const args = h.args.map((a) => a.split('${CLAUDE_PROJECT_DIR}').join(ws));
      const r = spawnSync(h.command === 'node' ? process.execPath : h.command, args, {
        input: JSON.stringify({ cwd: ws, ...input }), env: { ...process.env, CLAUDE_PROJECT_DIR: ws, ...env }, encoding: 'utf8',
      });
      // Claude Code hands a hook's output to the agent only when it exits 0.
      if (r.status === 0) out += r.stdout;
    }
  }
  return out;
}

// ------------------------------------------------------------------ install-workspace

test('a fresh workspace gets both files, with the router named in them and every hook in exec form', () => {
  const { ws, router } = workspace();
  const steps = plan({ routerDir: router, home: home() });
  assert.deepEqual(steps.map((s) => s.state), ['missing', 'missing']);
  apply(steps);
  const md = readFileSync(join(ws, 'CLAUDE.md'), 'utf8');
  assert.match(md, /^@acme-ops\/CLAUDE\.md$/m);
  assert.doesNotMatch(md, /\{\{ROUTER\}\}/);
  const settings = JSON.parse(readFileSync(join(ws, '.claude/settings.json'), 'utf8'));
  const hooks = Object.values(settings.hooks).flat().flatMap((g) => g.hooks);
  assert.ok(hooks.length >= 7);
  for (const h of hooks) {
    assert.equal(h.command, 'node', 'node itself, with no shell around it');
    const file = h.args[0].match(/^\$\{CLAUDE_PROJECT_DIR\}\/acme-ops\/(.+)$/);
    assert.ok(file, `runs a file of the router: ${h.args[0]}`);
    assert.ok(existsSync(join(KIT, file[1])), `the kit ships ${file[1]}`);
  }
  assert.deepEqual(plan({ routerDir: router, home: home() }).map((s) => s.state), ['current', 'current'], 'a second run changes nothing');
});

test('a CLAUDE.md someone wrote is left alone, and one that imports the router counts as in place', () => {
  const { ws, router } = workspace();
  writeFileSync(join(ws, 'CLAUDE.md'), '# my own notes\n');
  const steps = plan({ routerDir: router, home: home() });
  assert.equal(steps[0].state, 'different');
  assert.match(steps[0].lacks, /@acme-ops\/CLAUDE\.md/);
  apply(steps);
  assert.equal(readFileSync(join(ws, 'CLAUDE.md'), 'utf8'), '# my own notes\n');
  writeFileSync(join(ws, 'CLAUDE.md'), '# my own notes\n\n@acme-ops/CLAUDE.md\n');
  assert.equal(plan({ routerDir: router, home: home() })[0].state, 'current');
});

test('a settings file someone wrote gets the hooks it lacks, loses only dead ones, and keeps the rest', () => {
  const { ws, router } = workspace();
  apply(plan({ routerDir: router, home: home() }));
  const file = join(ws, '.claude/settings.json');
  const kit = kitHooks(JSON.parse(readFileSync(file, 'utf8')));
  const own = {
    permissions: { allow: ['Bash(ls)'] },
    hooks: {
      SessionStart: [{ hooks: [
        { type: 'command', command: 'bash "$CLAUDE_PROJECT_DIR/acme-ops/.claude/hooks/workspace-start.sh" 2>/dev/null || true' },
        { type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/acme-ops/scripts/workspace-sync.mjs', 'sync', '--siblings'] },
      ] }],
      PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo mine' }] }],
    },
  };
  writeFileSync(file, JSON.stringify(own));
  const steps = plan({ routerDir: router, home: home() });
  assert.equal(steps[1].state, 'partial');
  assert.match(steps[1].lacks, /PreToolUse send-guard\.mjs/);
  assert.match(steps[1].lacks, /drop SessionStart workspace-start\.sh/);
  apply(steps);
  const after = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(lacking(after, kit), []);
  assert.deepEqual(after.permissions, own.permissions);
  assert.ok(after.hooks.PreToolUse.some((g) => g.matcher === 'Edit' && g.hooks[0].command === 'echo mine'));
  const start = after.hooks.SessionStart.flatMap((g) => g.hooks).map((h) => JSON.stringify(h));
  assert.equal(start.filter((h) => h.includes('workspace-sync')).length, 1, 'a hook already there is not added twice');
  assert.ok(!start.some((h) => h.includes('workspace-start.sh')), 'a hook pointing at a retired file is dropped');
  assert.equal(plan({ routerDir: router, home: home() })[1].state, 'current');

  writeFileSync(file, '{ not json');
  const broken = plan({ routerDir: router, home: home() });
  assert.equal(broken[1].state, 'different');
  apply(broken);
  assert.equal(readFileSync(file, 'utf8'), '{ not json', 'a file it cannot read is never rewritten');
});

test('a file an earlier template produced is refreshed', () => {
  const { ws, router } = workspace();
  const tpl = join(router, 'docs/workspace/CLAUDE.md');
  const current = readFileSync(tpl, 'utf8');
  git(router, 'init', '-q');
  writeFileSync(tpl, 'Old wording.\n\n@{{ROUTER}}/CLAUDE.md\n');
  git(router, 'add', '-A'); git(router, 'commit', '-q', '-m', 'old');
  writeFileSync(join(ws, 'CLAUDE.md'), render('Old wording.\n\n@{{ROUTER}}/CLAUDE.md\n', 'acme-ops'));
  writeFileSync(tpl, current);
  git(router, 'add', '-A'); git(router, 'commit', '-q', '-m', 'new');
  const steps = plan({ routerDir: router, home: home() });
  assert.equal(steps[0].state, 'stale');
  apply(steps);
  assert.equal(readFileSync(join(ws, 'CLAUDE.md'), 'utf8'), render(current, 'acme-ops'));
});

test('the home folder, a parent inside a repo and an awkward folder name are refused', () => {
  const { ws, router } = workspace();
  assert.throws(() => plan({ routerDir: router, home: ws }), Stop);
  git(ws, 'init', '-q');
  assert.throws(() => plan({ routerDir: router, home: home() }), /inside a git repo/);
  const odd = join(realpathSync(mkdtempSync(join(tmpdir(), 'ws-'))), 'my ops');
  mkdirSync(odd);
  assert.throws(() => plan({ routerDir: odd, home: home() }), /letters, digits/);
});

test('from the parent folder, the send guard reads the router\'s own exemptions', () => {
  const { ws, router } = workspace();
  apply(plan({ routerDir: router, home: home() }));
  writeFileSync(join(router, '.claude/send-guard.json'), JSON.stringify({ allow: ['send-owner-alert'] }));
  const run = (cmd) => runHooks(ws, 'PreToolUse', { tool_name: 'Bash', tool_input: { command: cmd } });
  assert.equal(run('bash scripts/send-owner-alert.sh'), '', 'exempted by the router\'s send-guard.json');
  assert.equal(JSON.parse(run('bash scripts/send-newsletter.sh')).hookSpecificOutput.permissionDecision, 'ask');
});

// ------------------------------------------------------------------ hooks from the parent folder

/** A bare remote and a clone of it, inside the workspace. */
function cloneInto(ws, name) {
  const remote = join(ws, '..', `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.git`);
  git(ws, 'init', '-q', '--bare', remote);
  git(ws, 'clone', '-q', remote, name);
  const dir = join(ws, name);
  writeFileSync(join(dir, 'README.md'), `# ${name}\n`);
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'first'); git(dir, 'push', '-q', '-u', 'origin', 'HEAD');
  return { dir, remote };
}
const stop = (ws) => execFileSync(process.execPath, [join(ws, 'acme-ops/.claude/hooks/session-end.mjs')], {
  input: '{}', env: { ...process.env, CLAUDE_PROJECT_DIR: ws }, encoding: 'utf8',
});

test('session-end checks every repo of a workspace and names the ones left unsaved', () => {
  const { ws } = workspace();
  cloneInto(ws, 'notes');
  const sales = cloneInto(ws, 'sales');
  assert.equal(stop(ws), '', 'everything saved and pushed: nothing to say');
  writeFileSync(join(sales.dir, 'lead.md'), 'draft\n');
  const out = JSON.parse(stop(ws));
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /changes in: sales\./);
  assert.doesNotMatch(out.reason, /notes/);
  assert.match(out.reason, /git diff --cached/);
});

test('the session start pulls what it can, names what it cannot, and flags a missing git identity', () => {
  const { ws, router } = workspace();
  apply(plan({ routerDir: router, home: home() }));
  const notes = cloneInto(ws, 'notes');
  const sales = cloneInto(ws, 'sales');
  // gone's origin has disappeared: a sync that cannot reach it must still be read.
  const gone = cloneInto(ws, 'gone');
  rmSync(gone.remote, { recursive: true, force: true });
  // Someone pushes to notes from elsewhere: a plain fast-forward for this clone.
  const other = join(ws, '..', `other-${Date.now()}`);
  git(ws, 'clone', '-q', notes.remote, other);
  writeFileSync(join(other, 'news.md'), 'new\n');
  git(other, 'add', '-A'); git(other, 'commit', '-q', '-m', 'news'); git(other, 'push', '-q');
  // sales has diverged: a local commit and a remote one.
  const other2 = join(ws, '..', `other2-${Date.now()}`);
  git(ws, 'clone', '-q', sales.remote, other2);
  writeFileSync(join(other2, 'README.md'), 'theirs\n');
  git(other2, 'add', '-A'); git(other2, 'commit', '-q', '-m', 'theirs'); git(other2, 'push', '-q');
  writeFileSync(join(sales.dir, 'README.md'), 'mine\n');
  git(sales.dir, 'add', '-A'); git(sales.dir, 'commit', '-q', '-m', 'mine');

  const start = (env) => runHooks(ws, 'SessionStart', { session_id: 's-1', source: 'startup' }, { GIT_CONFIG_NOSYSTEM: '1', ...env });
  const noIdentity = join(ws, '..', `gitconfig-empty-${Date.now()}`);
  writeFileSync(noIdentity, '');
  const out = start({ GIT_CONFIG_GLOBAL: noIdentity });
  assert.match(out, /Workspace: some clones need a look/);
  assert.doesNotMatch(out, /• notes/, 'a clone brought up to date needs nobody');
  assert.ok(existsSync(join(notes.dir, 'news.md')), 'notes was fast-forwarded');
  assert.match(out, /• sales: NOT updated/);
  assert.match(out, /• gone: NOT updated, could not reach origin/);
  assert.match(out, /Git has no identity on this machine/);

  const withIdentity = join(ws, '..', `gitconfig-${Date.now()}`);
  writeFileSync(withIdentity, '[user]\n\tname = Sam\n\temail = sam@example.com\n');
  assert.doesNotMatch(start({ GIT_CONFIG_GLOBAL: withIdentity }), /no identity/);
});
