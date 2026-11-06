#!/usr/bin/env node
// Suggest an improvement to a repo you cannot write to: another unit's recipe, a template, a rule.
//
// Learned on an instance where people kept improving each other's recipes in conversation and the
// agent stopped at "you don't have write access". A suggestion is worth as much as one from the
// owner: it goes in as a change the owner accepts, never as a push to their `main`.
//
// The route, by the person's rights (read here, from GitHub, never guessed):
//   direct    they can write: commit and push, as for their own repo;
//   pr-fork   the organization and the repo allow forking private repos: a branch on their fork,
//             then a pull request to the repo (pushing a branch to the repo itself needs write
//             access, which already gives the direct route);
//   issue     they can read it: an issue labelled `suggestion` carrying the whole change;
//   none      they cannot read it: say so, and give the text to whoever can.
// Forking private repos is off by default on GitHub. Turning it on is an organization owner's
// setting (Settings ▸ Member privileges ▸ Allow forking of private repositories, then the repo's
// own Allow forking); this script never changes a setting.
//
// Every suggestion is doubled by a plain mail to the repo's head (source/organization-policy.json ▸
// heads), drafted here, reread and sent by the person who suggests: what they suggest, what triggered
// it, what it changes for the unit, and one link. No git words in it. It goes out under the send
// guard like any other message.
//
//   node scripts/suggestion.mjs route <owner/repo>     the route and the reviewer, as JSON
//   node scripts/suggestion.mjs log '<json>'           record a filed suggestion in source/suggestions.jsonl

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REGISTER = 'source/suggestions.jsonl';
export const LABEL = 'suggestion';

/** The route, from what GitHub says of the person's rights and of forking. */
export function route({ permissions = {}, orgForks = false, repoForks = false, issues = true } = {}) {
  if (permissions.push || permissions.maintain || permissions.admin) return 'direct';
  if (!permissions.pull) return 'none';
  if (orgForks && repoForks) return 'pr-fork';
  return issues ? 'issue' : 'none';
}

/** The title: who suggests what, short enough for a list. */
export const title = ({ who, what }) => `Suggestion from ${who}: ${what}`.slice(0, 120);

/** The body of the pull request or issue. */
export function body({ who, what, why, impact, file = '', diff = '' }) {
  return [
    `**Who suggests it:** ${who}`,
    `**What would change:** ${what}${file ? ` (\`${file}\`)` : ''}`,
    `**Why:** ${why}`,
    `**What it changes for you:** ${impact}`,
    diff ? `\nThe change:\n\n\`\`\`diff\n${diff.trim()}\n\`\`\`` : '',
    '\nNothing was pushed to `main`: accept it, edit it or close it.',
  ].filter(Boolean).join('\n');
}

/** The mail to the repo's head, in plain words, for the person to reread and send. */
export function mail({ who, head, what, why, impact, link }) {
  return {
    to: head,
    subject: `A suggestion for your ${what}`.slice(0, 120),
    text: [
      `Hello,`,
      ``,
      `I suggest a change to ${what}.`,
      `Why: ${why}`,
      `What it changes for you: ${impact}`,
      ``,
      `You can read it and accept it here: ${link}`,
      ``,
      who,
    ].join('\n'),
  };
}

/** The head of a repo, from source/organization-policy.json ▸ heads, or ''. */
export function headOf(repo, root = ROOT) {
  try {
    const heads = JSON.parse(readFileSync(join(root, 'source', 'organization-policy.json'), 'utf8')).heads || {};
    return heads[repo] || heads[repo.split('/')[1]] || '';
  } catch { return ''; }
}

const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));

/** Read-only: the signed-in person's rights on the repo, the forking settings, then the route. */
export function routeFor(repo, root = ROOT) {
  const r = gh(['api', `repos/${repo}`]);
  let orgForks = false;
  try { orgForks = Boolean(gh(['api', `orgs/${repo.split('/')[0]}`]).members_can_fork_private_repositories); } catch { /* a personal account: no org setting */ }
  const how = route({ permissions: r.permissions || {}, orgForks: orgForks || !r.private, repoForks: r.allow_forking !== false, issues: r.has_issues !== false });
  const head = headOf(repo, root);
  return { repo, route: how, head, note: head ? '' : 'No head declared for this repo (source/organization-policy.json ▸ heads): ask who should read it.' };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'route' && arg) console.log(JSON.stringify(routeFor(arg), null, 2));
  else if (cmd === 'log' && arg) {
    const s = JSON.parse(arg);
    for (const k of ['repo', 'route', 'url', 'who', 'what']) if (!s[k]) { console.error(`missing "${k}"`); process.exit(2); }
    appendFileSync(join(ROOT, REGISTER), `${JSON.stringify({ state: 'open', on: new Date().toISOString().slice(0, 10), ...s })}\n`);
    console.log(`recorded in ${REGISTER}: stage that file alone, commit, push.`);
  } else { console.error("Usage: node scripts/suggestion.mjs route <owner/repo> | log '<json>'"); process.exit(2); }
}
