// The workspace files (docs/workspace/, written by scripts/install-workspace.mjs) and the
// hooks they run from the parent folder.
//
// install-workspace must write what is missing, refresh only what it wrote before, never
// overwrite someone's file without --replace (and then move it aside), and refuse the home
// folder. The rendered settings must run the router's own hooks with the router's own
// tuning. session-end must check every repo of a workspace, and workspace-start must name
// a repo it could not update and a machine with no git identity.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, apply, render, Stop } from './install-workspace.mjs';

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
  return { ws, router };
}
const home = () => mkdtempSync(join(tmpdir(), 'home-'));

// ------------------------------------------------------------------ install-workspace

test('a fresh workspace gets both files, with the router named in them', () => {
  const { ws, router } = workspace();
  const steps = plan({ routerDir: router, home: home() });
  assert.deepEqual(steps.map((s) => s.state), ['missing', 'missing']);
  apply(steps);
  const md = readFileSync(join(ws, 'CLAUDE.md'), 'utf8');
  assert.match(md, /^@acme-ops\/CLAUDE\.md$/m);
  assert.doesNotMatch(md, /\{\{ROUTER\}\}/);
  const settings = JSON.parse(readFileSync(join(ws, '.claude/settings.json'), 'utf8'));
  const commands = Object.values(settings.hooks).flat().flatMap((h) => h.hooks.map((x) => x.command));
  assert.ok(commands.length >= 4);
  for (const c of commands) {
    const hook = c.match(/\/acme-ops\/(\.claude\/hooks\/[\w.-]+)/);
    assert.ok(hook, `names a hook of the router: ${c}`);
    assert.ok(existsSync(join(KIT, hook[1])), `the kit ships ${hook[1]}`);
  }
  assert.deepEqual(plan({ routerDir: router, home: home() }).map((s) => s.state), ['current', 'current'], 'a second run changes nothing');
});

test('a file someone wrote is left alone, and --replace moves it aside rather than deleting it', () => {
  const { ws, router } = workspace();
  writeFileSync(join(ws, 'CLAUDE.md'), '# my own notes\n');
  const steps = plan({ routerDir: router, home: home() });
  assert.equal(steps[0].state, 'different');
  apply(steps);
  assert.equal(readFileSync(join(ws, 'CLAUDE.md'), 'utf8'), '# my own notes\n');
  apply(plan({ routerDir: router, home: home() }), { replace: true });
  assert.equal(readFileSync(join(ws, 'CLAUDE.md.before-workspace'), 'utf8'), '# my own notes\n');
  assert.match(readFileSync(join(ws, 'CLAUDE.md'), 'utf8'), /@acme-ops\/CLAUDE\.md/);
});

test('a file an earlier template produced is refreshed without --replace', () => {
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
  const settings = JSON.parse(readFileSync(join(ws, '.claude/settings.json'), 'utf8'));
  const command = settings.hooks.PreToolUse[0].hooks[0].command;
  const run = (cmd) => execFileSync('bash', ['-c', command], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: cmd }, cwd: ws }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: ws }, encoding: 'utf8',
  });
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
const stop = (ws) => execFileSync('bash', [join(ws, 'acme-ops/.claude/hooks/session-end.sh')], {
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
  assert.match(out.reason, /git commit --only/);
});

test('workspace-start pulls what it can, names what it cannot, and flags a missing git identity', () => {
  const { ws } = workspace();
  const notes = cloneInto(ws, 'notes');
  const sales = cloneInto(ws, 'sales');
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

  const start = (env) => execFileSync('bash', [join(ws, 'acme-ops/.claude/hooks/workspace-start.sh')], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: ws, GIT_CONFIG_NOSYSTEM: '1', ...env }, encoding: 'utf8',
  });
  const noIdentity = join(ws, '..', `gitconfig-empty-${Date.now()}`);
  writeFileSync(noIdentity, '');
  const out = start({ GIT_CONFIG_GLOBAL: noIdentity });
  assert.match(out, /Workspace: 1 repo\(s\) up to date\./);
  assert.ok(existsSync(join(notes.dir, 'news.md')), 'notes was fast-forwarded');
  assert.match(out, /• sales: NOT updated/);
  assert.match(out, /Git has no identity on this machine/);

  const withIdentity = join(ws, '..', `gitconfig-${Date.now()}`);
  writeFileSync(withIdentity, '[user]\n\tname = Sam\n\temail = sam@example.com\n');
  assert.doesNotMatch(start({ GIT_CONFIG_GLOBAL: withIdentity }), /no identity/);
});
