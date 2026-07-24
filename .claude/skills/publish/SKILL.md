---
name: publish
description: "Save and publish the current state: verify, commit, push, confirm the live site updated. Use when finishing any change, or when the owner says publish, save, put it online, or similar."
---

# Publish

Publishing is pushing; Cloudflare Workers does the rest. The job here is to do it cleanly and confirm it landed.

1. **Verify first.** If the change is visual and hasn't been checked yet, run the site locally and look at it (mobile and desktop) before publishing. A deck: open it and click through.
2. **Stage explicitly.** `git status`, then `git add` the files you touched, by name. Other sessions or machines may have left unrelated files around; a blind `git add -A` has shipped accidents before.
3. **Commit** with a message that says what changed in plain words (`add two paintings to gallery, mark Nocturne sold`).
4. **Push.** If the push is rejected because the remote moved, pull with rebase, re-verify, push again.
5. **Confirm live.** After about a minute, fetch the live URL and check the change actually appears. If it doesn't, check the Cloudflare build (the owner can open Deployments in their dashboard; the usual causes are a build error, which you should fix immediately, or DNS still propagating on a fresh setup).
6. **Report in plain words**: "saved and published, live at <URL>". No git vocabulary unless the owner uses it first.
