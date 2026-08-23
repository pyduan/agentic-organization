---
name: publish
description: "Save and publish the current state: verify, commit, push, confirm the live site updated. Use when finishing any change, or when the owner says publish, save, put it online, or similar."
---

# Publish

Publishing is pushing; Cloudflare Workers does the rest. The job here is to do it cleanly and confirm it landed.

0. **Check what you are publishing *to*.** Pushing publishes the site. A private thing — the
   dashboard, anything with client or unreleased material — belongs on the Access-gated Worker
   (`npm run deploy:dashboard`), never on a public URL, and that mistake is not fixable by deleting
   the page afterwards. If it is private and about to become public, stop and reroute it.
1. **Verify first.** If the change is visual and hasn't been checked yet, run the site locally and look at it (mobile and desktop) before publishing. A deck: open it and click through. If words changed, reread them once against the voice guide, check any figure or name against `source/content/` and `source/facts/`, and click the links. Nothing invented ever ships.
2. **Stage explicitly.** `git status`, then `git add` the files you touched, by name. Other sessions or machines may have left unrelated files around; a blind `git add -A` has shipped accidents before.
3. **Commit** with a message that says what changed in plain words (`add two paintings to gallery, mark Nocturne sold`).
4. **Push.** If the push is rejected because the remote moved, pull with rebase, re-verify, push again.
5. **Confirm live.** After about a minute, fetch the live URL and check the change actually appears. If it doesn't, check the Cloudflare build (the owner can open Deployments in their dashboard; the usual causes are a build error, which you should fix immediately, or DNS still propagating on a fresh setup).
6. **The repo is not the app.** Having fixed a file proves nothing about what the live page shows.
   When you say something is up to date, you are talking about the deployed thing: fetch it and
   look, with a cache-buster on the URL (Cloudflare caches these answers, and a plain request has
   reported a change missing minutes after it landed, and present when it had not). For the private
   dashboard, also request it from a browser you are **not** signed into: a login redirect or a
   `403` is right, a `200` is an incident.
7. **Report in plain words**: "saved and published, live at <URL>". No git vocabulary unless the owner uses it first.
