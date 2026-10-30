#!/usr/bin/env node
//
// Validates the markdown files the site is built from, before the build hides the problem.
//
// The bug that produced this check: a key_facts bullet containing ": " is read by YAML as a map,
// not a string, and renders as "[object Object]" on the card. It builds cleanly and looks fine
// until someone reads that card. Every rule below is a failure that a build would not catch.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { company, model, repos, centralPaths } from "../config.mjs";

const ROOT = path.resolve(process.cwd(), "..");

// The vocabulary comes from config.mjs, not from this file. A check that carries its own copy of
// the statuses is a check that passes on a company whose pipeline it does not describe.
const STATUS = model.statuses.map((x) => x.key);
const ACCOUNT_STATUS = (model.accountStatuses ?? model.statuses).map((x) => x.key);
const STAGE = model.stages.map((x) => x.key);
const FAMILY = model.families.map((x) => x.key);
const KIND = ["intro", "call", "meeting", "workshop", "decision", "delivery", "seminar", "deadline"];

/**
 * YAML turns an unquoted 2026-09-16 into a Date. src/lib/content.mjs normalises those back to the
 * calendar day before anything reads them, so this check has to do the same or it validates
 * something the site never sees and reports two dozen failures on files that render correctly.
 */
function plainDates(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(plainDates);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainDates(x)]));
  return v;
}

/** Milestones feed a shared time axis, so a bad date silently drops the dot rather than failing. */
function milestones(name, list) {
  if (list === undefined) return;
  if (!Array.isArray(list)) return fail(name, "milestones must be a list");
  for (const m of list) {
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(String(m?.date ?? "")))
      fail(name, `milestone date "${m?.date}" is not YYYY-MM-DD or YYYY-MM`);
    if (m?.kind && !KIND.includes(m.kind))
      fail(name, `milestone kind "${m.kind}" is not one of ${KIND.join(", ")}`);
    if (!String(m?.text ?? "").trim()) fail(name, "a milestone has no text");
  }
}

/** A next step with no owner is a next step nobody takes. */
function steps(name, list) {
  if (list === undefined) return;
  if (!Array.isArray(list)) return fail(name, "next_steps must be a list");
  for (const n of list) {
    if (!String(n?.text ?? "").trim()) fail(name, "a next step has no text");
    if (!String(n?.owner ?? "").trim()) fail(name, `next step "${n?.text}" has no owner`);
  }
}
// Closed on purpose: the pipeline chart has one validated colour per sector and does not invent
// hues. A new sector is a colour added to src/styles/tokens.css in the same change.
const problems = [];
const fail = (file, msg) => problems.push(`${file}: ${msg}`);

function read(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("TEMPLATE"))
    .map((f) => path.join(dir, f));
}

function strings(file, key, v) {
  if (v === undefined) return;
  if (!Array.isArray(v)) return fail(file, `${key} must be a list`);
  v.forEach((x, i) => {
    if (typeof x === "string") return;
    fail(
      file,
      `${key}[${i}] is ${Array.isArray(x) ? "a list" : typeof x}, not a string. ` +
        `A bullet containing ": " must be quoted, or YAML reads it as a map.`
    );
  });
}

// Both the pipeline entities and the named accounts, which are the same folder in B2B and two
// different ones in B2C. A project points at either.
// [folder, which status vocabulary applies, what `type` must say]. In B2B this is one entry; in
// B2C it is two, and they do not validate the same way — a segment is not an account.
const entityDirs = [
  [model.entityPlural, STATUS, model.entityPlural === model.accounts ? "company" : "segment"],
  ...(model.accounts === model.entityPlural ? [] : [[model.accounts, ACCOUNT_STATUS, "company"]]),
].map(([d, st, kind]) => [path.join(ROOT, repos.customers, d), st, kind]);
const projectDir = path.join(ROOT, repos.customers, "projects");
const peopleDir = path.join(ROOT, repos.administrative, "people");

const companySlugs = new Set();
const milestoneIndex = [];  // [file, companySlug, date, "company"|"project"]

for (const [dir, statuses, kind] of entityDirs) {
 for (const f of read(dir)) {
  const name = path.relative(ROOT, f);
  const { data: rawData } = matter(fs.readFileSync(f, "utf8"));
  const data = plainDates(rawData);
  const slug = data.slug || path.basename(f, ".md");
  companySlugs.add(slug);

  if (data.type !== kind) fail(name, `type must be "${kind}"`);
  if (data.slug && data.slug !== path.basename(f, ".md"))
    fail(name, `slug "${data.slug}" does not match the filename`);
  if (!statuses.includes(data.status))
    fail(name, `status "${data.status}" is not one of ${statuses.join(", ")}`);
  if (!FAMILY.includes(data[model.family]))
    fail(name, `${model.family} "${data[model.family]}" is not one of ${FAMILY.join(", ")}`);
  for (const k of ["name", "owner", "updated"]) if (!data[k]) fail(name, `${k} is required`);
  strings(name, "key_facts", data.key_facts);
  strings(name, "tags", data.tags);
  milestones(name, data.milestones);
  for (const m of data.milestones ?? []) milestoneIndex.push([name, slug, String(m.date), "company"]);
 }
}

for (const f of read(projectDir)) {
  const name = path.relative(ROOT, f);
  const { data: rawData } = matter(fs.readFileSync(f, "utf8"));
  const data = plainDates(rawData);

  if (data.type !== "project") fail(name, `type must be "project"`);
  if (!ACCOUNT_STATUS.includes(data.status))
    fail(name, `status "${data.status}" is not one of ${ACCOUNT_STATUS.join(", ")}`);
  if (!STAGE.includes(data.stage))
    fail(name, `stage "${data.stage}" is not one of ${STAGE.join(", ")}`);
  if (!companySlugs.has(data.company))
    fail(name, `company "${data.company}" has no file in ${entityDirs.map(([d]) => path.relative(ROOT, d)).join(" or ")}/`);
  for (const k of ["name", "owner", "updated"]) if (!data[k]) fail(name, `${k} is required`);
  strings(name, "key_facts", data.key_facts);
  strings(name, "tags", data.tags);
  milestones(name, data.milestones);
  steps(name, data.next_steps);
  for (const m of data.milestones ?? []) milestoneIndex.push([name, data.company, String(m.date), "project"]);
}

for (const f of read(peopleDir)) {
  const name = path.relative(ROOT, f);
  const { data: rawData } = matter(fs.readFileSync(f, "utf8"));
  const data = plainDates(rawData);
  if (data.type !== "person") continue;
  for (const k of ["name", "role", "group"]) if (!data[k]) fail(name, `${k} is required`);
}

// The note bubble writes into company.central (worker.js). A config.mjs written before that field
// existed is the file a company edits most, so a kit update keeps it as theirs and never adds the
// line: without this, the bubble would answer every note with a GitHub 404.
if (!company.central) {
  fail("config.mjs", "company.central is missing: the name of the central repo, where the note bubble drops notes (intranet/README.md, \"The note bubble\")");
}

// Every markdown file with frontmatter, in every repo the site reads.
//
// The check used to name four files by hand, so each new one shipped unvalidated. thesis.md failed
// to parse on the exact trap this script was written for, a bare ": " inside an unquoted value, and
// `npm run check` said Content OK because it had never heard of the file.
//
// gray-matter throws rather than returning a broken object, so simply reading each file is the test.
// The central repo is the kit instance: only what the intranet reads from it is walked.
for (const repo of [repos.strategy, repos.customers, repos.administrative, path.join(repos.central, "source")]) {
  const dir = path.join(ROOT, repo);
  if (!fs.existsSync(dir)) continue;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "kit") continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith(".md")) continue;
      const raw = fs.readFileSync(full, "utf8");
      if (!raw.startsWith("---")) continue;
      try {
        matter(raw);
      } catch (err) {
        fail(path.relative(ROOT, full), `frontmatter YAML does not parse: ${String(err.message).split("\n")[0]}`);
      }
    }
  };
  walk(dir);
}

const posFile = path.join(ROOT, repos.strategy, "product", "positioning.md");
if (fs.existsSync(posFile)) {
  const name = path.relative(ROOT, posFile);
  const { data: rawData } = matter(fs.readFileSync(posFile, "utf8"));
  const data = plainDates(rawData);
  for (const k of ["usp", "icp_signals", "icp_disqualifiers"]) strings(name, k, data[k]);
  if (!data.one_liner) fail(name, "one_liner is required: the dashboard and the About page show it");
}

// A milestone recorded on a company AND on one of its own projects appears twice on every timeline
// that merges the two, in two slightly different wordings. It is a copy, not two events.
//
// Only that pairing is flagged. Two sibling projects of the same customer sharing a date is normal
// and common: one workshop day can move three units. The first version of this check compared every
// pair and reported four such days as problems, which is a check that would have been switched off
// within a week.
const companyDates = new Map();
for (const [file, company, date, level] of milestoneIndex) {
  if (level === "company") companyDates.set(`${company}|${date}`, file);
}
for (const [file, company, date, level] of milestoneIndex) {
  if (level !== "project") continue;
  const owner = companyDates.get(`${company}|${date}`);
  if (owner) {
    fail(file, `milestone ${date} is also on its company file, ${owner}. Keep it at one level: a company milestone is a relationship event, a project milestone is a delivery event.`);
  }
}

// The same decision written in two DECISIONS.md files renders twice in the journal, under two
// slightly different titles, and a reader cannot tell which one is current. Four of them had
// accumulated before anyone noticed, all org-wide choices also copied into the repo they touched.
//
// Titles are compared as a set of words, lowercased and stripped of accents and punctuation, so
// "The target is mid-size manufacturers" and "Mid-size manufacturers are the target" are caught. The
// rule from the company-decisions skill: a decision that binds the whole company lives in the central file, and the repo it
// touches links to it rather than restating it.
const DECISION_FILES = [
  [repos.central, path.join(ROOT, repos.central, centralPaths.decisions)],
  [repos.customers, path.join(ROOT, repos.customers, "DECISIONS.md")],
  [repos.strategy, path.join(ROOT, repos.strategy, "DECISIONS.md")],
  [repos.administrative, path.join(ROOT, repos.administrative, "DECISIONS.md")],
  ["intranet", path.join(process.cwd(), "DECISIONS.md")],
];

const titleKey = (t) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

const seenDecisions = new Map();
for (const [repo, file] of DECISION_FILES) {
  if (!fs.existsSync(file)) continue;
  for (const raw of fs.readFileSync(file, "utf8").split(/^##\s+(?!#)/m).slice(1)) {
    const head = raw.split("\n")[0].trim();
    const m = head.match(/^(.*?)\s*\((\d{4}-\d{2}-\d{2})\)/);
    if (!m) continue;
    const key = titleKey(m[1]);
    if (!key) continue;
    const before = seenDecisions.get(key);
    if (before) {
      fail(
        path.relative(ROOT, file),
        `decision "${m[1]}" is the same decision as "${before.title}" in ${before.repo}. ` +
          `It renders twice in the journal. One home: the central file when it binds the whole company, ` +
          `and the other file links to it.`
      );
    } else {
      seenDecisions.set(key, { repo: path.relative(ROOT, file), title: m[1] });
    }
  }
}

// A dated journal heading is `## date · tag · title`. Written with only two parts, the parser puts
// the title in the tag slot, and the page renders a whole sentence as a nowrap chip — which reads
// fine on a laptop and pushes the page 250px sideways on a phone. Caught here rather than by eye.
for (const [repo, file] of [
  ["strategy", path.join(ROOT, repos.strategy, "product", "journal.md")],
]) {
  if (!fs.existsSync(file)) continue;
  const name = path.relative(ROOT, file);
  for (const raw of fs.readFileSync(file, "utf8").split(/^##\s+(?!#)/m).slice(1)) {
    const head = raw.split("\n")[0].trim();
    const bits = head.split("·").map((x) => x.trim());
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(bits[0])) continue;
    if (bits.length < 3 || !bits.slice(2).join("").trim())
      fail(name, `journal heading "${head}" needs three parts: date · tag · title. With two, the title is read as the tag.`);
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error("");
  process.exit(1);
}

console.log("Content OK.");
