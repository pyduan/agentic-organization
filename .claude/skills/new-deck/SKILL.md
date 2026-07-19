---
name: new-deck
description: "Create a new presentation deck as a self-contained HTML file under site/public/decks/. Use when the owner asks for a deck, slides, a presentation, or a pitch."
---

# New deck

Read first: `source/brand/voice.md`, `source/brand/design.md`, `source/formats/deck.md`, and `source/brief.md` for context.

1. **Frame it**: audience, occasion, language, and the one thing the audience should remember. Ask only what you can't infer from the brief and recent conversation.
2. **Outline before designing.** Propose the slide list (title + one line each) and get a nod. Facts and numbers come from `source/content/` (the owner's own) or `source/facts/` (sourced third-party figures); anything missing, ask rather than invent.
3. **Build** from `source/formats/deck-template.html` into `site/public/decks/<slug>/index.html`. Copy the current values from `source/brand/tokens.css` into the template's token block. Design within the system: one idea per slide, type sized for the back of the room, recurring slide layouts.
4. **Review** by walking the owner through it locally, slide by slide. Iterate.
5. **Publish** (publish skill). Hand over the live URL plus the two presenting facts worth repeating: fullscreen in the browser, arrow keys to move. Print to PDF from the browser if they need an attachment.
6. Record the deck's existence and purpose in `source/brief.md` under derivatives.

If the deck is confidential, don't push it; the repo publishes on push. Build it outside the repo and present it locally, and say so to the owner.
