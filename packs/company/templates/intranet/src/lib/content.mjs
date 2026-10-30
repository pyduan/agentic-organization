// Reads the sibling repos at build time. This is the only place that touches the filesystem.
//
// The repos are the source of truth and this file is a reader. Nothing here corrects, completes or
// infers: a field that is missing stays missing and renders as "unknown", because a site that
// quietly fills a gap makes the gap unfindable.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { repos, company, model, centralPaths } from "../../config.mjs";

const ROOT = path.resolve(process.cwd(), "..");

const REPOS = Object.fromEntries(
  Object.entries(repos).map(([key, dir]) => [key, path.join(ROOT, dir)])
);

/** A repo that is not cloned side by side is a build that silently loses a tab. Say so instead. */
function requireRepo(key) {
  const dir = REPOS[key];
  if (!fs.existsSync(dir)) {
    throw new Error(
      `Missing repo: ${dir}\n` +
        `Clone the repos side by side in one parent folder:\n` +
        `  cd ${ROOT} && gh repo clone ${company.org}/${repos[key]}`
    );
  }
  return dir;
}

function readDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("TEMPLATE"))
    .map((f) => path.join(dir, f));
}

/**
 * Split a markdown body into { "Heading": html } so a page can place sections deliberately.
 *
 * The heading is the author's, rendered as written, in whatever language the company writes in.
 * `## Journal` is the one heading this file matches on by name.
 */
function sections(body) {
  const out = {};
  const parts = body.split(/^##\s+(?!#)/m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    const heading = part.slice(0, nl < 0 ? part.length : nl).trim();
    const content = nl < 0 ? "" : part.slice(nl + 1).trim();
    if (content) out[heading] = marked.parse(content);
  }
  return out;
}

/** Journal entries are "### YYYY-MM-DD · type · title" under the Journal heading. */
function journal(body) {
  const block = body.split(/^##\s+Journal\s*$/m)[1];
  if (!block) return [];
  const upTo = block.split(/^##\s+/m)[0];
  const entries = upTo.split(/^###\s+/m).slice(1);
  return entries
    .map((raw) => {
      const nl = raw.indexOf("\n");
      const head = (nl < 0 ? raw : raw.slice(0, nl)).trim();
      const rest = nl < 0 ? "" : raw.slice(nl + 1).trim();
      const bits = head.split("·").map((s) => s.trim());
      return {
        date: bits[0] || "",
        kind: bits[1] || "",
        title: bits.slice(2).join(" · ") || bits[1] || "",
        html: marked.parse(rest),
      };
    })
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));
}

/**
 * YAML turns an unquoted 2026-09-16 into a Date, which renders as
 * "Wed Sep 16 2026 02:00:00 GMT+0200". Dates in these files are calendar days, not instants, so
 * they go back to the string that was written. Done here rather than at each call site, because
 * the next field somebody adds would otherwise ship the same bug.
 */
function plainDates(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(plainDates);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainDates(x)]));
  }
  return v;
}

/**
 * A file names the image it should have, whether or not anyone has supplied it yet. Rendering an
 * <img> for a path that is not in public/ gives a broken-image icon, which reads as a bug rather
 * than as a missing photo. Drop the path here and the monogram takes over, which is the designed
 * empty state. The field stays in the markdown, so it still says where the image belongs.
 */
function presentImage(src) {
  if (!src) return undefined;
  const onDisk = path.join(process.cwd(), "public", String(src).replace(/^\//, ""));
  return fs.existsSync(onDisk) ? src : undefined;
}

function load(file) {
  const { data: raw, content } = matter(fs.readFileSync(file, "utf8"));
  const data = plainDates(raw);
  return {
    ...data,
    image: presentImage(data.image),
    slug: data.slug || path.basename(file, ".md"),
    sections: sections(content),
    journal: journal(content),
    // The file's own H1 is its title in a text editor. The page that renders it has already written
    // a heading, so keeping it prints the word twice.
    bodyHtml: marked.parse(content.trim()).replace(/^\s*<h1[^>]*>.*?<\/h1>\s*/is, ""),
  };
}

const byDateDesc = (a, b) => String(b.updated || "").localeCompare(String(a.updated || ""));

/**
 * The pipeline entities. Companies for a B2B company, segments for a B2C one: `model.entity` in
 * config.mjs decides which, and it is the folder name under customers/ as well as the word the
 * interface uses. Everything downstream treats them the same, because a chart does not care whether
 * a bar is an account or an audience.
 */
export function companies() {
  return readDir(path.join(requireRepo("customers"), model.entityPlural))
    .map((f) => ({ ...load(f), dir: model.entityPlural }))
    .sort(byDateDesc);
}

/**
 * The named accounts: the entities you have a conversation with, one file per organisation.
 *
 * For a B2B company these are the same files as companies() — one folder, read twice, because an
 * account and a pipeline entity are the same thing when you sell to organisations. For a B2C
 * company they are different folders and genuinely different things: the pipeline is segments of a
 * population, the accounts are the installers, clubs and shops that carry the product to them.
 */
export function accounts() {
  return readDir(path.join(requireRepo("customers"), model.accounts))
    .map((f) => ({ ...load(f), dir: model.accounts }))
    .sort(byDateDesc);
}

export function projects() {
  return readDir(path.join(requireRepo("customers"), "projects")).map(load).sort(byDateDesc);
}

export function people() {
  return readDir(path.join(requireRepo("administrative"), "people"))
    .map(load)
    .filter((p) => p.type === "person");
}

export function positioning() {
  return loadIfPresent(path.join(requireRepo("strategy"), "product", "positioning.md"));
}

export function vision() {
  return loadIfPresent(path.join(requireRepo("strategy"), "product", "vision.md"));
}

export function swot() {
  return loadIfPresent(path.join(requireRepo("strategy"), "product", "swot.md"));
}

function loadIfPresent(file) {
  return fs.existsSync(file) ? load(file) : null;
}

/** Product insights: what we noticed about the offer. What we did about it is in a DECISIONS.md. */
export function productJournal() {
  return datedSections(path.join(requireRepo("strategy"), "product", "journal.md"));
}

/**
 * What happened to the company with no customer and no product angle. Source: the central repo's
 * journal, the kit's table of `| Date | What happened | Where it came from |`, newest first. A
 * `## YYYY-MM-DD · tag · title` section, the older shape, is read too.
 */
export function companyJournal() {
  const file = path.join(requireRepo("central"), centralPaths.journal);
  return [...journalTable(file), ...datedSections(file)].sort((a, b) => b.date.localeCompare(a.date));
}

/** Rows of a markdown table whose first cell is a date: [date, what happened, where it came from]. */
function journalTable(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2 || !/^\d{4}-\d{2}(-\d{2})?$/.test(cells[0])) continue;
    out.push({ date: cells[0], tag: "", title: marked.parseInline(cells[1]).replace(/<[^>]+>/g, ""), html: cells[2] ? marked.parse(cells[2]) : "" });
  }
  return out;
}

/** "## YYYY-MM-DD · tag · title" sections, newest first. */
function datedSections(file) {
  if (!fs.existsSync(file)) return [];
  const { content } = matter(fs.readFileSync(file, "utf8"));
  return content
    .split(/^##\s+(?!#)/m)
    .slice(1)
    .map((raw) => {
      const nl = raw.indexOf("\n");
      const head = (nl < 0 ? raw : raw.slice(0, nl)).trim();
      const body = nl < 0 ? "" : raw.slice(nl + 1).trim();
      const bits = head.split("·").map((x) => x.trim());
      return { date: bits[0] || "", tag: bits[1] || "", title: bits.slice(2).join(" · "), html: marked.parse(body) };
    })
    .filter((e) => /^\d{4}-\d{2}(-\d{2})?$/.test(e.date))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Org-wide todos, aggregated from the "Open questions" list of every repo's INDEX.md.
 *
 * Deliberately derived rather than maintained here. A todo list on the site would be a second
 * source of truth over the one in the files, and the files are where the context lives.
 */
export function openQuestions() {
  const out = [];
  const sources = [
    ["Central", "central", repos.central],
    ["Customers", "customers", repos.customers],
    ["Strategy", "strategy", repos.strategy],
    ["Administrative", "administrative", repos.administrative],
    // This repo, which is not in REPOS: it is the one the build runs inside.
    ["Intranet", "intranet", "intranet"],
  ];
  for (const [label, key, repo] of sources) {
    const file = path.join(key === "intranet" ? process.cwd() : REPOS[key], "INDEX.md");
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const block = text.split(/^##\s+Open questions\s*$/m)[1];
    if (!block) continue;
    const upTo = block.split(/^##\s+/m)[0];

    // A bullet is its first line plus every indented line under it. Taking only the first line
    // silently dropped the second half of most of these, which is why they read as truncated: the
    // convention in these files is a bold lead then the detail, wrapped.
    let current = null;
    const flush = () => {
      if (!current) return;
      const raw = current.join("\n");
      const html = marked.parseInline(raw.replace(/\s*\n\s+/g, " ").trim());
      const text = html.replace(/<[^>]+>/g, "");
      out.push({ source: label, repo, html, text, id: hash(`${repo}:${text}`) });
      current = null;
    };
    for (const line of upTo.split("\n")) {
      const bullet = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
      if (bullet) { flush(); current = [bullet[1]]; continue; }
      if (current && /^\s+\S/.test(line)) { current.push(line); continue; }
      if (!line.trim()) continue;
      flush();
    }
    flush();
  }
  return out;
}

/**
 * A stable id for a todo, so a tick survives a rebuild. Derived from the repo and the text, which
 * means editing the wording of a question clears its tick. That is the right trade: an edited
 * question is a different question, and inheriting a tick from the old one would be worse than
 * asking again.
 */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export { hash as todoId };

/**
 * Colour families for the pipeline chart, in the fixed order they take palette slots in. Never
 * cycled: a sixth family means adding a validated step to tokens.css, not generating a hue. The
 * colours live in src/styles/tokens.css and were validated for colour-vision
 * separation and contrast in both themes.
 */
export const SECTORS = model.families;

/** An unrecognised or absent family is its own grey slot, never quietly folded into a real one. */
export function sectorOf(entity) {
  const key = String(entity?.[model.family] ?? "").trim();
  return SECTORS.some((s) => s.key === key) ? key : "unknown";
}

/** Slot N of the categorical palette, or the reserved grey. Colour is position, never name. */
export function sectorColor(key) {
  const i = SECTORS.findIndex((s) => s.key === key);
  return `var(--cat-${i < 0 ? 0 : i + 1})`;
}

export function sectorLabel(key) {
  return SECTORS.find((s) => s.key === key)?.label ?? "Not set";
}

/** The number that sets bar height: headcount for a company, population for a segment. */
export function sizeOf(entity) {
  const n = Number(entity?.[model.size]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Every dated milestone across companies and projects, on one axis.
 *
 * A date can be a month (2026-01) as well as a day. Months are kept rather than dropped, because
 * "production since early 2026" is true and "2026-01-15" would not be. They sort as their first day
 * and are labelled without one.
 */
export function milestones() {
  const out = [];
  const push = (item, kindOfFile) => {
    for (const m of item.milestones ?? []) {
      if (!/^\d{4}-\d{2}(-\d{2})?$/.test(String(m.date ?? ""))) continue;
      out.push({
        ...m,
        date: String(m.date),
        day: String(m.date).length === 7 ? `${m.date}-01` : String(m.date),
        vague: String(m.date).length === 7,
        from: kindOfFile,
        company: kindOfFile === "company" ? item.slug : item.company,
        sourceName: item.name,
        href: kindOfFile === "company" ? `/customers/${item.slug}` : `/customers/${item.company}/${item.slug}`,
      });
    }
  };
  for (const c of companies()) push(c, "company");
  for (const p of projects()) push(p, "project");
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/** Next steps across every project, so one list answers "what is actually on us". */
export function nextSteps() {
  return projects().flatMap((p) =>
    (p.next_steps ?? []).map((n) => ({
      ...n,
      project: p.name,
      projectSlug: p.slug,
      company: p.company,
      href: `/customers/${p.company}/${p.slug}`,
      id: hash(`${p.slug}:${n.text}`),
      html: marked.parseInline(String(n.text ?? "")),
      source: p.name,
    }))
  );
}

/**
 * Every decision across every repo, newest first, typed.
 *
 * Heading format: "## Sentence case title (YYYY-MM-DD) · type", where type is strategy, technology
 * or business. The type is in the heading rather than in a separate field because the heading is
 * what someone reads when scanning the file itself, and a taxonomy nobody sees while writing is a
 * taxonomy that goes stale.
 */
export const DECISION_TYPES = ["strategy", "technology", "business"];

/**
 * The DECISIONS.md of every repo, as [label, file]. The central repo is the kit instance, whose
 * decisions live in source/decisions.md in the kit's own format.
 */
export function decisionFiles() {
  return [
    ["Central", path.join(REPOS.central, centralPaths.decisions)],
    ["Customers", path.join(REPOS.customers, "DECISIONS.md")],
    ["Strategy", path.join(REPOS.strategy, "DECISIONS.md")],
    ["Administrative", path.join(REPOS.administrative, "DECISIONS.md")],
    ["Intranet", path.join(process.cwd(), "DECISIONS.md")],
  ];
}

/**
 * One decision heading, in either shape: this pack's "Title (YYYY-MM-DD) · type", or the kit's
 * "YYYY-MM-DD · where it came from — title", which carries no type.
 */
export function parseDecisionHeading(head) {
  const typed = head.match(/^(.*?)\s*\((\d{4}-\d{2}-\d{2})\)\s*(?:·\s*(\S+))?\s*$/);
  if (typed) return { title: typed[1], date: typed[2], type: DECISION_TYPES.includes(typed[3]) ? typed[3] : "untyped" };
  const kit = head.match(/^(\d{4}-\d{2}-\d{2})\s*·\s*(.*?)\s+[—–-]\s+(.+)$/);
  if (kit) return { title: kit[3], date: kit[1], type: "untyped" };
  return null;
}

export function decisions() {
  const out = [];
  for (const [label, file] of decisionFiles()) {
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, "utf8").split(/^##\s+(?!#)/m).slice(1)) {
      const nl = raw.indexOf("\n");
      const head = (nl < 0 ? raw : raw.slice(0, nl)).trim();
      const body = nl < 0 ? "" : raw.slice(nl + 1).trim();
      const d = parseDecisionHeading(head);
      if (!d) continue;
      out.push({ ...d, source: label, html: marked.parse(body) });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/** The market study. Its own section on Strategy, because it is the longest thing anyone reads. */
export function market() {
  return loadIfPresent(path.join(requireRepo("strategy"), "market.md"));
}

export function thesis() {
  return loadIfPresent(path.join(requireRepo("strategy"), "thesis.md"));
}

export function competition() {
  return loadIfPresent(path.join(requireRepo("strategy"), "competition.md"));
}

export function businessModel() {
  return loadIfPresent(path.join(requireRepo("strategy"), "business-model.md"));
}

/**
 * The functional parts of the product, one file each, ordered by the `order` field.
 *
 * One file per part rather than a list in one file, because each one carries a real spec and a list
 * of what is not decided. A spec that has to fit in a frontmatter array stops being a spec.
 */
export function features() {
  return readDir(path.join(requireRepo("strategy"), "product", "features"))
    .map(load)
    .filter((f) => f.type === "feature")
    .sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
}

/** The plan for supporting more than one model of the thing the product plugs into. */
export function governance() {
  return loadIfPresent(path.join(requireRepo("strategy"), "product", "governance.md"));
}

export function openCore() {
  return loadIfPresent(path.join(requireRepo("strategy"), "product", "open-core.md"));
}

export function naming() {
  return loadIfPresent(path.join(requireRepo("strategy"), "marketing", "naming.md"));
}

/**
 * The arbitrations: choices somebody has to make, from the "## To decide" section of each
 * DECISIONS.md. Distinct from open questions, which are things nobody knows yet.
 *
 * They sit in DECISIONS.md rather than in their own file because a decision taken should be able to
 * move from one section to another in the same edit, and a reader of that file should see both.
 */
export function openDecisions() {
  const out = [];
  for (const [label, file] of decisionFiles()) {
    if (!fs.existsSync(file)) continue;
    const block = fs.readFileSync(file, "utf8").split(/^##\s+To decide\s*$/m)[1];
    if (!block) continue;
    const upTo = block.split(/^##\s+/m)[0];

    let current = null;
    const flush = () => {
      if (!current) return;
      const raw = current.join("\n").replace(/\s*\n\s+/g, " ").trim();
      const html = marked.parseInline(raw);
      const text = html.replace(/<[^>]+>/g, "");
      out.push({ source: label, html, text, id: hash(`open:${label}:${text}`) });
      current = null;
    };
    for (const line of upTo.split("\n")) {
      const bullet = line.match(/^(?:[-*])\s+(.*)$/);
      if (bullet) { flush(); current = [bullet[1]]; continue; }
      if (current && /^\s+\S/.test(line)) { current.push(line); continue; }
      if (!line.trim()) continue;
      flush();
    }
    flush();
  }
  return out;
}

/**
 * The decks, as scripts/deck/intranet.mjs left them before the build: built ones with their URL,
 * refused ones with their reasons. No file means the step did not run, which is said, not hidden.
 */
export function decks() {
  const file = path.join(process.cwd(), "src", "data", "decks.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** What we send out. Source: the central repo's source/content/resources.md (config.mjs). */
export function resources() {
  const file = path.join(requireRepo("central"), centralPaths.resources);
  if (!fs.existsSync(file)) return [];
  const { data } = matter(fs.readFileSync(file, "utf8"));
  return plainDates(data).resources ?? [];
}

/** One person or several. A step can be carried by two, and the file says so as a list. */
export const OWNERS = model.owners.map((o) => o.key);

/** Slot N of the person palette, or the reserved grey. */
export function ownerColor(key) {
  const i = OWNERS.indexOf(key);
  return `var(--who-${i < 0 ? 0 : i + 1})`;
}

export function ownerLabel(key) {
  return model.owners.find((o) => o.key === key)?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function ownersOf(value) {
  const list = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  return list.map((o) => String(o).trim().toLowerCase()).filter(Boolean);
}

/** Today, resolved once at build time so every page agrees on where "now" is. */
export const TODAY = new Date().toISOString().slice(0, 10);

/**
 * The pipeline statuses and the palette slot each one owns, keyed for lookup. Order comes from
 * model.statuses and it is what assigns the colours, so reordering that list recolours the chart.
 */
export const STATUS_ORDER = model.statuses.map((s) => s.key);

// Both vocabularies in one lookup, each taking palette slots by its own position. They never share
// a page — a segment chart and a partner list are different views — so reusing the slots reads the
// way a reader expects: the first stage is green in both. A key present in both resolves to the
// pipeline one, which is the same entry in B2B anyway.
const statusEntry = (s, i) => [s.key, { token: `--stage-${i + 1}`, label: s.label, note: s.note }];

export const STATUS = Object.fromEntries([
  ...(model.accountStatuses ?? model.statuses).map(statusEntry),
  ...model.statuses.map(statusEntry),
]);

export const ACCOUNT_STATUS_ORDER = (model.accountStatuses ?? model.statuses).map((s) => s.key);

export function statusLabel(key) {
  return STATUS[key]?.label ?? key;
}

/** Project lifecycle, in order. Sorts projects inside a customer and labels the stage field. */
export const STAGE = model.stages.map((s) => s.key);

export function stageLabel(key) {
  return model.stages.find((s) => s.key === key)?.label ?? key;
}

/** Cards and detail pages ask for fields that may not exist. One word, one style, everywhere. */
export function value(v) {
  if (v === undefined || v === null || v === "" || v === "unknown") return null;
  return String(v);
}

export function companyOf(list, slug) {
  return list.find((c) => c.slug === slug) || null;
}
