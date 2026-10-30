// The site's words.
//
// One language, the company's, and every label lives here. The intranet was once built bilingual,
// with a second tree of routes and a switcher, and that was dropped: a second tree doubled the routes
// and the review surface to serve nobody. A company that works in another language translates the
// strings below and sets LOCALE, and nothing else changes. Its markdown is written in that language
// too, headings included.
//
// What stays English whatever the language is the machine vocabulary the files are typed with,
// `status: active`, `kind: workshop`, the `· technology` on a decision, because those are
// identifiers, not prose, and this file is where they get their label. The section headings the code
// matches on by name (`## Journal`, `## Open questions`, `## To decide`) are in src/lib/content.mjs.
//
// Keep every string here short. These are labels on a dense page, not explanations: if a note needs
// two sentences, the second one belongs in the markdown it describes.

/** Dates and numbers are formatted for this locale. */
export const LOCALE = "en-GB";

const STRINGS = {
  // Navigation and chrome
  "nav.dashboard": "Dashboard",
  "nav.customers": "Active customers",
  "nav.prospects": "Prospects",
  "nav.journal": "Journal",
  "nav.product": "Product",
  "nav.strategy": "Strategy",
  "nav.marketing": "Marketing",
  "nav.resources": "Resources",
  "nav.about": "About",
  "chrome.menu": "Menu",
  "chrome.signedIn": "Signed in as",
  "chrome.signOut": "Sign out",
  "chrome.footer": "Built from __COMPANY__'s repos. No fact is edited here: if a page is wrong, the file behind it is wrong.",

  // Shared
  "common.unknown": "unknown",
  "common.owner": "Owner",
  "common.updated": "Updated",
  "common.source": "Source",
  "common.noDate": "no date",
  "common.more": "More",
  "common.less": "Less",
  "common.waitingOn": "waiting on",
  "common.company": "Customer",
  "common.customers": "Customers",
  "common.projects": "Projects",
  "common.contacts": "Contacts",
  "common.within": "part of",

  // Statuses, stages and families get their labels from config.mjs, not from here.

  // Milestone kinds
  "kind.intro": "Introduction",
  "kind.call": "Call",
  "kind.meeting": "Meeting",
  "kind.workshop": "Workshop",
  "kind.decision": "Decision",
  "kind.delivery": "Delivery",
  "kind.seminar": "Seminar",
  "kind.deadline": "Deadline",
  "kind.mail": "Email",

  // Dashboard
  "dash.title": "Dashboard",
  "dash.liveProjects": "Live projects",
  "dash.timeline": "What lands when",
  "dash.todo": "To handle",
  "dash.todoNote": "Pending decisions and unanswered questions. The answer goes in the file; the tick only says someone is on it.",

  // Chart
  "chart.foot": "__CHART_FOOT__",
  "chart.introduced": "Via",

  // Customers
  "cust.title": "Active customers",
  "cust.whatLands": "What lands when",
  "cust.whatLandsNote": "Every dated milestone, on one axis. Hover a dot for the detail.",
  "cust.noProject": "No project file yet.",
  "tl.foot": "Filled dot: past. Hollow dot: ahead. The vertical line is today. A dot circled in dashes is dated to the month only.",
  "tl.ahead": "ahead",
  "tl.today": "Today",
  "tl.none": "No dated milestone in the file.",

  // Prospects
  "pros.title": "Prospects",  // replaced by the tab label in config.mjs
  "pros.lead": "__PIPELINE_LEAD__",
  "pros.status": "Status",
  "pros.sector": "__FAMILY_LABEL__",
  "pros.all": "All",
  "pros.count": "__ENTITY_PLURAL__",
  "pros.countOf": "of",
  "pros.empty": "Nothing matches these two filters.",

  // Decision types
  "dtype.strategy": "Strategy",
  "dtype.technology": "Technology",
  "dtype.business": "Business",
  "dtype.untyped": "Untyped",

  // Product
  "prod.title": "Product",
  "prod.lead": "What we sell, to whom, and where it is going.",
  "prod.vision": "Vision",
  "prod.positioning": "Positioning",
  "prod.usp": "Value proposition",
  "prod.icp": "Ideal customer",
  "prod.icpNot": "Disqualifiers",
  "prod.swot": "SWOT",
  "prod.strengths": "Strengths",
  "prod.weaknesses": "Weaknesses",
  "prod.opportunities": "Opportunities",
  "prod.threats": "Threats",
  "prod.insights": "Product insights",
  "prod.insightsNote": "What we noticed about the offer. What we did about it is in the Journal.",
  "prod.method": "The method",
  "prod.openCore": "Open core",

  // Journal
  "jour.title": "Journal",
  "jour.lead": "Every decision taken, newest first.",
  "jour.type": "Type",
  "jour.repo": "Repo",
  "jour.why": "Why",
  "jour.count": "decisions",
  "jour.none": "No entry.",
  "jour.toDecide": "To decide",
  "jour.toDecideNote": "Decisions waiting on someone, across every repo.",
  "jour.events": "What happened",

  // Prospect contact rail
  "rail.title": "Recent contacts",
  "rail.note": "Prospects only. A customer's history is on its file.",

  // About
  "about.title": "About",
  "about.lead": "Who we are, and who works around us.",
  "about.seeProduct": "What we sell is on the Product tab.",
  "about.usp": "What we sell on",
  "about.icp": "Who we are built for",
  "about.icpNot": "And who we are not built for",
  "about.argument": "The argument",
  "about.cofounders": "Cofounders",
  "about.cofoundersNote": "Who founded the company and what each one carries. The terms are in strategy/legal/.",
  "about.around": "Around the company",
  "about.aroundNote": "People who work with us without a settled agreement.",
  "about.decisions": "Decisions",
  "about.decisionsNote": "Newest first. The reasoning, including what was set aside, is in the file.",
  "about.why": "Why",
  "about.resources": "Key resources",

  // Resources
  "res.title": "Resources",
  "res.lead": "What we send out, and where its source lives.",
  "res.open": "Open",
  "res.decks": "Decks",
  "res.decksNone": "No deck yet. A deck is a folder in strategy/decks/ or customers/decks/.",
  "res.decksNotBuilt": "The decks were not built: npm run decks.",
  "res.deckRefused": "Refused at build",
  "res.deckUnchecked": "Not checked",
  "res.deckSlides": "slides",
  "res.links": "Links",
  "res.previewUnavailable": "This site refuses to be shown in a frame. The card shows its preview image.",

  // Detail pages
  "fiche.milestones": "Milestones",
  "fiche.nextSteps": "Next steps",
  "fiche.nextStepsNote": "From next_steps in the project file.",
  "fiche.revenue": "Revenue",
  "fiche.hq": "Headquarters",
  "fiche.erp": "Main system",
  "fiche.intro": "Introduced by",
  "fiche.since": "First contact",
  "fiche.website": "Website",
  "fiche.stage": "Stage",
  "fiche.started": "Started",
  "fiche.value": "Contracted value",
  "fiche.repo": "Rule base",
  "fiche.parent": "Group",
  "fiche.journal": "Journal",

  // Todos
  "todo.offline": "Ticks and notes need the deployed site. Here the list is read-only.",
  "todo.note": "Note",
  "todo.save": "Save",
  "todo.notePlaceholder": "What you found, or what is blocking.",
  "todo.done": "Done",
  "todo.saving": "Saving…",
  "todo.failed": "Not saved:",
  "todo.retry": "Retry",

  // Note bubble
  "note.title": "Note something",
  "note.help": "A piece of news, a figure, an idea: the agent files the note at its next session.",
  "note.send": "Drop it",
  "note.sending": "Sending…",
  "note.sent": "Dropped ✓",
  "note.failed": "Not dropped:",
  "todo.kind.decision": "Decision",
  "todo.kind.question": "Question",

  // Projects
  "proj.title": "Projects",
  "proj.lead": "__ACCOUNTS_LEAD__",
  "proj.steps": "Next steps",
  "proj.stepsNote": "From each project's next_steps.",
  "proj.filterProject": "Project",
  "proj.filterPriority": "Priority",
  "priority.high": "High",
  "priority.normal": "Normal",
  "priority.low": "Low",

  // Strategy
  "strat.title": "Strategy",
  "strat.lead": "What we understood of the market, where we stand in it, and what it is worth.",
  "strat.summary": "The thesis",
  "strat.landscape": "Competitive landscape",
  "strat.swot": "SWOT",
  "strat.model": "Business model",
  "strat.tam": "Market size",
  "strat.anchor": "What we position on",
  "strat.ladder": "The price ladder",
  "strat.segment": "Segment",
  "strat.total": "Total",
  "strat.reachable": "Reachable",
  "strat.stage": "Stage",
  "strat.price": "Price range",
  "strat.recurrence": "Kind",
  "strat.us": "Us",

  // Marketing
  "mkt.title": "Marketing",
  "mkt.lead": "The name, the lexical fields, and what the search for existing names found.",
  "mkt.themes": "Lexical fields",
  "mkt.theme": "Theme",
  "mkt.says": "What it says",
  "mkt.verdict": "Verdict",
  "mkt.taken": "Already taken by",
  "mkt.why": "Why",
};

export function t(key) {
  const s = STRINGS[key];
  if (s === undefined) throw new Error(`Missing UI string: ${key}`);
  return s;
}

/**
 * For words that come out of the markdown rather than out of this file: a journal entry's kind, a
 * section heading. An unknown one is shown as the author wrote it.
 *
 * Deliberately separate from `t`. A missing key for a string this file owns is a bug and should stop
 * the build; a word an author chose is not ours to validate.
 */
export function tOr(key, fallback) {
  return STRINGS[key] === undefined ? fallback : STRINGS[key];
}

export function formatDate(iso, { month = "long", day = true } = {}) {
  if (!iso) return "";
  const date = new Date(`${iso.length === 7 ? `${iso}-01` : iso}T00:00:00Z`);
  return date.toLocaleDateString(LOCALE, {
    day: day ? "numeric" : undefined,
    month,
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatNumber(n) {
  return new Intl.NumberFormat(LOCALE).format(n);
}

/** Every key, for the check that nothing is missing. */
export function allKeys() {
  return Object.entries(STRINGS);
}
