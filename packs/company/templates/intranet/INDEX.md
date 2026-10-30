# Index

| Path | Holds |
|---|---|
| `worker.js` | The gate. Verifies the Cloudflare Access assertion, then serves the files. |
| `wrangler.jsonc` | Deploy target. Generic `workers.dev`, no domain of its own. |
| `src/lib/content.mjs` | The only file that reads the other repos. |
| `src/lib/i18n.mjs` | Every label the site shows, in one language. Change it here to change the site's language. |
| `src/components/` | One card for companies and projects, the pipeline chart, the two timelines, the to-do list, the shared file shell. |
| `src/components/ui/` | The primitives: card, badge, field, monogram, separator. |
| `src/pages/` | Dashboard, Projects, Prospects, Product, Strategy, Marketing, Journal, Resources, About, and the nested company and project routes. |
| `src/styles/tokens.css` | A copy of the central repo's `source/brand/tokens.css`. Not the source. |
| `scripts/check-content.mjs` | Validates the markdown the site is built from. Runs before every build. |
| `scripts/protect-access.mjs` | Creates the Access application and the access list, and writes `TEAM_DOMAIN` and `POLICY_AUD`. Idempotent. Shared with the kit. |
| `vendor/__CENTRAL__.json` | The files shared with the central repo (deck and document engines, checks), kept byte for byte by `npm run vendor:pull` and `vendor:verify`. |
| `worker.js` ▸ `/api/todos` | State of ticks and notes, in KV, attributed to the signed-in address. |

## Open questions

A **pending choice**, one that waits on someone, is in [`DECISIONS.md`](DECISIONS.md) ▸ *To decide*,
not here. Here goes what nobody knows yet.

- **Example to replace.** A useful open question says what we do not know, and how we would find
  out. "Does the live Worker carry the latest build" is a good open question, because
  `npx wrangler deployments list` answers it in ten seconds and nobody has run it.
