# Seeding an instance for someone else

The usual install is the owner's: they run the paste, the setup session interviews them, and the
repository fills from what they bring. When a helper installs the kit for another organization (a
partner, a client, a team they coach), there is a better start: **seed the repository before the
day**, from what the organization already publishes and what the helper already holds for them, and
hand it over at the workshop. The setup session then confirms and corrects instead of starting from
an empty brief.

## Why seed

- **The first hour goes to their material, not to typing what is public.** Their site, their
  programmes, their published tools and their own AI policy are read once, by the helper, with a
  source per line. The owner corrects a draft, which takes minutes, rather than dictating it.
- **Their history comes over on day one.** Each document they already have is named with what it
  becomes in the repository, so the import is a step of the setup prompt rather than a project for
  later. An organization that starts empty keeps its real history in the tools it was supposed to
  leave.
- **The first use case is ready to run.** The seed holds the recipe for the task the owner will
  dictate, so the workshop ends on a result rather than on a structure.

## What goes in a seed, and what never does

| Goes in | Never goes in |
|---|---|
| Facts the organization publishes, each with its URL and the date read | Anything the helper learned in confidence, or from a third party |
| Their own published tools, verbatim, each file with its URL and the date read | Another organization's material, even reworded |
| Their workflows, as the repository's own recipes (skills, formats), drafted from what they publish | A recipe of yours with their name put on it |
| Proposed rows in `STACK.md` and `CONNECTORS.md`, each *Approved* cell left empty | An approval, even one they gave you in a call |
| A draft brief and a first `decisions.md` entry, marked *proposed* | A decision taken on their behalf |
| The history-takeover table: their documents, and what each becomes | Their documents themselves, unless they sent them for this |
| The first use cases as recipes, with leads drawn from what they publish | Secrets, tokens, or any account of theirs |

Every line the helper wrote carries `(seed, to confirm)` until the owner confirms it, and the
setup skill treats the seed as its interview notes, not as answers.

## Three things to infer before writing a line

A seed that only copies the "about" page leaves the workshop to guess the rest. Three inferences
make it useful, each drawn from public signals and from what the helper's own recipes already say
about this kind of organization, each marked *(seed, to confirm)*.

**1. Where their material probably lives.** Before proposing a connector, work out what they
actually use:

- **their DNS**: the MX names the mail provider (Google, Microsoft, Proton, OVH), and the TXT
  verification records name the services the domain is verified with (a CRM, a document signer, a
  chat tool);
- **their site**: who serves it, which forms it embeds (applications, newsletter, donations), and
  which tools its job posts name;
- **the kind of organization**: a funder runs on applications, grantee reports and a portfolio; an
  accelerator on cohorts, applications and mentors; a ministry on mail, notes, files and a registry.
  The helper's recipes for that kind of organization say which of these to expect.

Each likely source becomes a proposed row in `CONNECTORS.md` with the route that really works for
that provider, and a line in the history-takeover table. Some providers have no API. A Proton
mailbox goes through Proton Mail Bridge, a calendar with no API through a read-only sharing link,
and a site like LinkedIn through the browser, read-only. Name that route in the row, so the
workshop does not find out on the day.

**2. The intranet they need first.** List the tools to build, ranked, three at most. A tool makes
the list when its source will be there on the first day and the job it serves comes back every week.
The home page (who waits on what) comes first. Then comes the view for the first use case, then
the second. Each line names the files it reads and the recipe behind it. A page with no source on
the first day waits.

**3. Their design system, read from their site.** Never guess a brand.

- If they publish a design system or brand guide, it is the reference, kept verbatim and pinned.
  Your tokens summarize it, and theirs win when the two disagree.
- Otherwise read the site's stylesheet: its custom properties, and the colors and fonts of the body
  text, the headings, the links and the primary button. Each token in `tokens.css` names its page,
  its source variable and the date it was read.
- Take the logo as SVG from the site's header, or failing that its favicon or sharing image, and
  say which.
- **Check each font's license before you embed it.** Google Fonts can be embedded. A font from a
  commercial foundry or from Adobe cannot be embedded without a license, so the tokens fall back to
  a close system stack and `design.md` says what is missing.
- Check the contrast of text on the background and on the accent color.
- For a public administration, look for the state's official visual charter before the flag: flag
  colors carry states (done, to watch, late), never decoration.

What the site cannot say (a muted grey it never declares, a second accent) stays the kit's value,
marked as such.

## How

1. **Create it from the template, private, on the helper's account**:
   `gh repo create <org>-agents --template pyduan/agentic-organization --private --clone`, then
   record `.kit-sync` as the setup skill says. Private, because a draft about an organization is
   theirs to publish, not the helper's.
2. **Write `source/seed.md`**: who seeded it, when, from which sources, and the list of what the
   setup session must confirm. Its presence is what tells the setup skill to confirm rather than
   interview from scratch.
3. **Fill what is public**, with sources: `source/brief.md` (the parts that are not governance),
   `source/content/` and `source/facts/`, and their AI policy mapped onto the files that enforce it
   (`AGENTS.md`, `ORGANIGRAM.md`, `.gitignore`, a restricted repository).
4. **Their tools and their workflows.** What they already publish (a guide, a template, a
   calculator) goes in verbatim, each file naming its page and the day it was read. How they work
   becomes the repository's own recipes: a skill in `.claude/skills/` or a format in
   `source/formats/`, marked *(seed, to confirm)*. A pack under `packs/<slug>/`
   (`source/formats/pack.md`) is the layer meant for sharing between organizations; what is theirs
   alone stays in their recipes, where the setup confirms it and every correction lands.
5. **Propose their stack and connectors**: the rows of `STACK.md` and `CONNECTORS.md` you can
   infer (a zone already on Cloudflare, a Google mailbox, the likely sources above, each with the
   route that works for its provider), each with its *Approved* cell empty. Write the design system
   (`source/brand/tokens.css` and `design.md`) and the ranked intranet tools in the same pass. The
   setup walks them with the person who decides, before anything else.
6. **Hand it over at the workshop**: transfer the repository to their GitHub organization
   (Settings ▸ Transfer ownership, or `gh api repos/<you>/<repo>/transfer -f new_owner=<org>`), so
   the history and the seed's provenance come with it. Then remove yourself as a collaborator unless
   they ask otherwise. The repository is theirs from that minute. The prompts they paste are in
   `docs/helping-another-organization.md` ▸ *The prompts for a seeded repository*.
7. **Delete `source/seed.md`** once the setup session has confirmed or corrected every line in it,
   and record that in `source/decisions.md`.

The seed is a starting point the owner can throw away. Say so when handing it over: an owner who
feels the structure was decided for them will not maintain it.
