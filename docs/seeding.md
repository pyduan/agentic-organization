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
| Their own published tools, as a pack holding that content verbatim, each file with its URL and the date read | Another organization's material, even reworded |
| A draft brief and a first `decisions.md` entry, marked *proposed* | A decision taken on their behalf |
| The history-takeover table: their documents, and what each becomes | Their documents themselves, unless they sent them for this |
| The first use cases as recipes, with leads drawn from what they publish | Secrets, tokens, or any account of theirs |

Every line the helper wrote carries `(seed, to confirm)` until the owner confirms it, and the
setup skill treats the seed as its interview notes, not as answers.

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
4. **Their tools as a pack** under `packs/<slug>/` (`source/formats/pack.md`): the recipes around
   the tool, and an import step their own agent runs to bring the content in.
5. **Hand it over at the workshop**: transfer the repository to their GitHub organization
   (Settings ▸ Transfer ownership, or `gh api repos/<you>/<repo>/transfer -f new_owner=<org>`), so
   the history and the seed's provenance come with it. Then remove yourself as a collaborator unless
   they ask otherwise. The repository is theirs from that minute.
6. **Delete `source/seed.md`** once the setup session has confirmed or corrected every line in it,
   and record that in `source/decisions.md`.

The seed is a starting point the owner can throw away. Say so when handing it over: an owner who
feels the structure was decided for them will not maintain it.
