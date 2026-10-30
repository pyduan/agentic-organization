// Where a repository stands in the setup, read from its files, and the one next step to say.
//
// The setup skill runs in a fixed order (.claude/skills/setup/SKILL.md): STACK.md and
// CONNECTORS.md walked with the owner row by row, then the intranet published behind a sign-in,
// then the interview and the rest. Every script that ends by telling someone what to do next (the
// bootstrap scripts, install-workspace, setup-status) asks this file, so they all say the same
// thing, and say it from the files rather than from what the script assumes.
//
// Zero dependencies, Node built-ins only.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const readText = (file) => { try { return readFileSync(file, 'utf8'); } catch { return null; } };

/** A date in an Approved cell, which is what makes a row a decision rather than a proposal. */
export const DATED = /\b\d{4}-\d{2}-\d{2}\b/;

/**
 * The first markdown table of a text, as { head, hasColumn, rows }, each row an object keyed by
 * the header's cells; null when there is no table. HTML comments are ignored.
 */
export function approvalTable(text, column = 'Approved') {
  const lines = String(text || '').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const cellsOf = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) continue;
    const head = cellsOf(lines[i]);
    const rows = [];
    for (let j = i + 2; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
      const c = cellsOf(lines[j]);
      rows.push(Object.fromEntries(head.map((h, k) => [h, c[k] ?? ''])));
    }
    return { head, hasColumn: head.includes(column), rows };
  }
  return null;
}

/** How many rows of a file's table have no dated approval; null when the file or its column is missing. */
export function unapproved(root, file) {
  const t = approvalTable(readText(join(root, file)) || '');
  if (!t || !t.hasColumn || !t.rows.length) return null;
  return t.rows.filter((r) => !DATED.test(r.Approved)).length;
}

export const SAY_SETUP = 'say "set up my organization": the setup starts by walking STACK.md and CONNECTORS.md with you, one row at a time, then publishes your intranet behind a sign-in';

/**
 * { setUp, stack, connectors, intranet, next }: whether the brief is still the template, the rows
 * left to approve in each file (null when it lacks the table or its column), whether the intranet
 * has been built here, and the sentence to end on.
 */
export function setupStage(root) {
  const brief = readText(join(root, 'source', 'brief.md'));
  const setUp = brief !== null && !/\bTODO\b/.test(brief);
  const stack = unapproved(root, 'STACK.md');
  const connectors = unapproved(root, 'CONNECTORS.md');
  const intranet = existsSync(join(root, 'apps', 'dashboard', 'dist', 'index.html'));
  let next;
  if (!setUp) next = SAY_SETUP;
  else if (stack !== 0) next = 'say "walk the stack with me": each row of STACK.md gets a yes or a change, with the date and who said it';
  else if (connectors !== 0) next = 'say "walk the connectors with me": each row of CONNECTORS.md gets a yes or a change, with the date and who said it';
  else if (!intranet) next = 'say "publish my intranet": it is built from the repository and put behind a sign-in';
  else next = 'say "check my setup" whenever something seems off';
  return { setUp, stack, connectors, intranet, next };
}
