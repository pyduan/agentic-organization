---
name: publish
description: "Save and publish the current state: verify, commit, push, confirm the live site updated. Use when finishing any change, or when the owner says publish, save, put it online, or similar."
---

# Publish

Publishing is pushing; Cloudflare Pages does the rest. The job here is to do it cleanly and confirm it landed.

0. **Check what you are publishing *to*.** Pushing publishes the site. An **app** has three
   destinations and only one of them is right for it (`source/formats/webapp.md`): with the site,
   its own Pages project, or — if it is private, personal, financial, or client-related — the
   organization's protected Worker, behind Access. If the thing you are about to push is private
   and would land on a public URL, stop and reroute it; that mistake is not fixable by deleting it
   later.
1. **Verify first.** If the change is visual and hasn't been checked yet, run the site locally and look at it (mobile and desktop) before publishing. A deck: open it and click through. If words changed, reread them once against the voice guide, check any figure or name against `source/content/` and `source/facts/`, and click the links. Nothing invented ever ships.
2. **Stage explicitly.** `git status`, then `git add` the files you touched, by name. Other sessions or machines may have left unrelated files around; a blind `git add -A` has shipped accidents before.
3. **Commit** with a message that says what changed in plain words (`add two paintings to gallery, mark Nocturne sold`).
4. **Push.** If the push is rejected because the remote moved, pull with rebase, re-verify, push again.
5. **Confirm live.** After about a minute, fetch the live URL and check the change actually appears. If it doesn't, check the Cloudflare build (the owner can open Deployments in their dashboard; the usual causes are a build error, which you should fix immediately, or DNS still propagating on a fresh setup).
6. **If it was a private app**, publishing means deploying the toolbox Worker, then requesting the
   app from a browser you are not signed into. A login redirect or `403` is right; a `200` is an
   incident.
7. **Report in plain words**: "saved and published, live at <URL>". No git vocabulary unless the owner uses it first.
