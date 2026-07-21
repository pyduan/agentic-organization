# Demos playbook (phone / chat / platform)

How to show a product in action inside a deck, a page, or an app: a demo that reads as *the real
thing*, not a drawing. Read this before hand-rolling a phone mockup or a conversation.

## Phone / messaging demos

A messaging demo (SMS, WhatsApp, chat) follows one visual grammar so it reads as a real phone, not
as branded decoration:

- **Phone frame**: dark body (`#0c0c0c`), large corner radius (`~42px`), a small centred notch,
  a crisp drop shadow. The screen has rounded corners (`~32px`) and `overflow: hidden`. Screen
  height is a fixed pixel value, never viewport-relative.
- **Status bar + header**: light chrome, clock left (`9:41`), signal right; a header with a back
  chevron, a round avatar (~30px), a name (13px/700) and a quiet subtitle.
- **Bubbles**: `max-width: ~82%`, `border-radius: ~9px`, `font-size: 14px`, a faint shadow.
  - **Incoming** (the assistant / the other party): **left**, **white** background, top-left corner squared to ~2px.
  - **Outgoing** (the user): **right**, a solid **accent** background (a real messaging blue like `#1067FE` reads most credibly) with white text, top-right corner squared to ~2px.
  The single squared corner is the detail that makes it read as real.
- **Never brand-colour the bubbles.** A real phone doesn't show bubbles in your brand colour. Use
  the neutral messaging look; keep the brand for the rest of the slide (title, text, the platform card).

## An action is a platform card, not a bubble

When the assistant **does something** (books a provider, fills a form, starts a payment), it does
**not** appear as a chat bubble — it appears as a **platform card**, full width in the thread:

- a header: the small brand mark + the platform name + a state on the right that goes from
  in-progress to a green `✓` done;
- a result line (what was done), on a white surface.

Never invent an ad-hoc action chip per demo: an action must read as the same platform everywhere.

## Reuse, don't re-implement

If a design system provides a shared demo component (data-driven: a JS/JSON object describes the
conversation, an engine renders it), **use it — never hand-roll the phone HTML.** (This kit was
genericized from the Bayes design system, whose `WhatsAppDemo` component with an `sms` skin and a
single shared platform tool-call card is the reference for the look above.) When decks are
self-contained single HTML files that can't import a component, **replicate the look** with the same
values, inline. If a family of demos recurs, build one small shared component rather than copying.
