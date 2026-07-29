---
name: review
description: "Pre-publish review of a finished draft: facts, attribution, voice, links, language, before it reaches an audience. Use when a page, post, deck, email, or campaign copy is written and about to ship, or when the owner asks for a check, a proofread, or a second pass on something already live."
---

# Review

The last gate between a draft and a real audience. This skill does not write the draft (the format
playbooks do that) and it does not restate the rules: it **checks against the guides**, and every
check points at the file that owns the rule, so this skill never drifts from the source of truth.

Read `source/brand/voice.md` and `source/brand/design.md` first, plus the matching format playbook
(`source/formats/*.md`). They are the authority; this is the procedure.

## When to run it

On anything about to reach an audience: a page before publishing, a deck's copy, a post, a
newsletter, an outbound email, a one-pager. Also useful on a batch (several pieces in one pass) and
on something already live (fetch the URL and review what's actually there).

## How to run it

1. Gather the **draft** (pasted, a file path, or a URL), the **channel**, the **language(s)**, and
   the **audience**.
2. Load the guides above, and the person's own voice notes if the piece goes out in their name.
   Nothing ships in someone's name without their sign-off.
3. Walk the checklist. **Flag, don't silently fix**: for each issue give its severity, where it is,
   which rule it breaks, and a concrete before/after. Hand back a corrected draft only if asked.

## Severity

- **Blocker**: don't ship until fixed. Anything factual, legal, or a hard voice rule.
- **Warning**: ships weaker. Off-voice, an AI tic, a non-default language that reads translated.
- **Note**: optional polish.

## Checklist

**1. Facts and attribution** (highest stakes)

- No invented anything: no figure, date, price, quote, feature, or name that isn't in
  `source/content/`, `source/facts/`, or `projects/<slug>/`. If it can't be traced, it doesn't ship.
- Every third-party figure carries its real source; anything still marked `<!-- verify before use -->`
  is a blocker until confirmed.
- Names of people, partners, and organizations spelled and written exactly per `voice.md`'s notation
  section, and credited to the right party.
- Claims about what's live vs. planned are honest, without belittling the work.

**2. Voice**

- Tone matches `voice.md`, banned words absent, titles in sentence case, no buzzwords.
- Concrete beats abstract: a claim that could be shown is shown (see "demonstrate, don't describe").
- Non-default language reads native, not translated: do the dedicated native-reader pass.

**3. Links and mechanics**

- Every link resolves (200, not a 404 or a redirect chain), and none goes through a redirect wrapper
  (`google.com/url?q=…`).
- Email addresses obfuscated and shown as text, never a raw `mailto:` in a built page.
- Numbers, dates, and currency follow the language's conventions, consistently.
- Design and layout checks belong to the format playbook's own quality bar; run that too if the piece
  is a page, an app, or a deck.

**4. Fit for the channel and audience**

- The format's own rules (length, structure, where the link goes) per its playbook.
- Nothing confidential leaks: check against the sensitive-content rule in `CLAUDE.md`.

## Then

Report as a short list ordered by severity, ending with a plain verdict: ship, ship after these
fixes, or don't ship yet. If a recurring issue shows up twice, that's a guide update, not just a
fix: fold it into `voice.md` or the format playbook via the `reflect` skill.
