// The only file that knows which company this is.
//
// Everything company-specific lives here: the name, the GitHub org, who can sign in, which tabs
// exist. The rest of the intranet reads it. Changing company means changing this file and the
// markdown in the sibling repos, and nothing else.
//
// bootstrap-company.mjs (packs/company in the central repo) writes this file. After that it is yours
// to edit.

export const company = {
  /** Shown in the header and in every page title. */
  name: "__COMPANY__",

  /** The GitHub organization holding the repos. */
  org: "__ORG__",

  /**
   * b2b-services | b2b-product | b2c-product. Written by the bootstrap, and the reason the rest of
   * this file looks the way it does.
   *
   * It is recorded here rather than inferred, because the parts it decided are all editable below
   * and will drift from it. Nothing reads it at build time.
   */
  profile: "__PROFILE__",

  /** Cloudflare Worker name. Becomes <name>.<subdomain>.workers.dev. */
  worker: "__WORKER__",

  /** The central repo: the agentic-organization kit instance this company runs from. The note bubble
   *  writes into its `source/inbox/notes/`, and nowhere else. */
  central: "__CENTRAL__",
};

/**
 * Who can sign in. Mirrored into access.txt, which scripts/protect-access.mjs applies.
 *
 * This copy exists so the list is visible to anyone reading the config, and it is not the one that
 * grants access. Changing it here changes nothing until the script is rerun.
 */
export const access = [
  // "someone@example.com",
];

/**
 * The tabs, in order, as [path, label]. Drop a line to remove a tab; the page still builds and is
 * still reachable by URL, it just stops being in the nav. Nine is what fits on a laptop before the
 * strip starts scrolling, so adding a tenth means deciding which one leaves.
 */
export const tabs = [
  ["/", "Dashboard"],
  ["/customers", "__TAB_ACCOUNTS__"],
  ["/prospects", "__TAB_PIPELINE__"],
  ["/product", "Product"],
  ["/strategy", "Strategy"],
  ["/marketing", "Marketing"],
  ["/journal", "Journal"],
  ["/resources", "Resources"],
  ["/about", "About"],
];

/** The label of a tab, so a page and its tab never disagree about what the section is called. */
export const tabLabel = (path) => tabs.find(([to]) => to === path)?.[1] ?? "";

/**
 * What the pipeline is made of.
 *
 * This is the one block that differs between a B2B company and a B2C one, and it differs because
 * the thing being tracked is genuinely different. A B2B pipeline is named accounts moving through
 * stages: five companies, each one a conversation with a person. A B2C pipeline is segments of a
 * population: a few thousand people who share a reason to buy, and no conversation with any of
 * them. Same chart, same components, different entity.
 *
 * `entity` is the folder under customers/ and the word used in the interface. `size` is the
 * frontmatter field whose number sets bar height, `family` the field whose value picks bar colour.
 * Two encodings, two questions: how big is this, and what kind of thing is it. Colour never carries
 * size and height never carries kind.
 *
 * Order is load-bearing in `families`, `statuses` and `owners`: position N takes palette slot N
 * (--cat-N, --stage-N, --who-N in brand/tokens.css). Reordering the list recolours the chart. A
 * sixth entry needs a validated colour added to tokens.css, never a generated one.
 */
export const model = {
  /** The word for one of them, and the folder under customers/ that holds them. */
  entity: "__ENTITY__",
  entityPlural: "__ENTITY_PLURAL__",

  /** The folder holding named accounts. Same folder as the entities for a B2B company. */
  accounts: "__ACCOUNTS__",

  /** Bar height, and how to say it. */
  size: "__SIZE_FIELD__",
  sizeLabel: "__SIZE_LABEL__",
  sizeUnit: "__SIZE_UNIT__",

  /** Bar colour, and the value shown next to it in the tooltip. */
  family: "__FAMILY_FIELD__",
  valueLabel: "__VALUE_LABEL__",

  /** Colour families. Five slots. `unknown` is the sixth, reserved, and always grey. */
  families: [
    __FAMILIES__
  ],

  /**
   * Named-account statuses: where a conversation with an organisation stands.
   *
   * Separate from `statuses` because in B2C they are genuinely different vocabularies — a segment
   * is "beachhead" or "later", an installer is "active" or "prospect", and forcing one list on both
   * makes one of them lie. In B2B set them to the same list; an account and a pipeline entity are
   * the same thing when you sell to organisations. Projects use this list too.
   */
  accountStatuses: [
    __ACCOUNT_STATUSES__
  ],

  /** Pipeline stages, in pipeline order. The note shows under the column head on the chart. */
  statuses: [
    __STATUSES__
  ],

  /** Project lifecycle, in order. Sorts projects inside a customer. */
  stages: [
    __STAGES__
  ],

  /**
   * Who can carry a next step. The key is what you write in frontmatter (`owner: alex`), the label
   * is what shows on the tag. Five slots; a sixth person needs a colour added to tokens.css.
   */
  owners: [
    __OWNERS__
  ],
};

/**
 * The sibling repos, relative to the parent folder. The keys are what content.mjs asks for; rename
 * the values if your repos are named differently.
 */
export const repos = {
  central: "__CENTRAL__",
  customers: "customers",
  strategy: "strategy",
  administrative: "administrative",
};

/**
 * Where the central repo keeps what the intranet reads, relative to its root. These are the kit's
 * own paths; change one here only if the central repo moved it.
 */
export const centralPaths = {
  /** The organization's decisions, in the kit's format. Shown on the Journal page with the others. */
  decisions: "source/decisions.md",
  /** What happened to the company with no customer and no product angle: the kit's journal table. */
  journal: "source/journal.md",
  /** Where the note bubble drops a note for the agent to file (source/inbox/README.md). */
  inbox: "source/inbox/notes",
  /** What we send out: a `resources:` list in the frontmatter, shown on the Resources page. */
  resources: "source/content/resources.md",
  /** The brand: tokens.css, voice.md and the deck layer in deck/. */
  brand: "source/brand",
};
