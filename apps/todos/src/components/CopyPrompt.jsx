import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { promptFor } from '../lib/prompt.js';

/**
 * Copies the hand-off prompt, and shows it first. Nobody should paste a string
 * into an agent without having read it, and the preview is also how you notice
 * that an item's text is too vague to act on.
 */
export function CopyPrompt({ item, path }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  if (!item.id) return null;

  const text = promptFor(item, path);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard needs a secure context. The preview is still open, so the
      // text can be selected by hand rather than silently failing.
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={copy}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-describedby={open ? `prompt-${item.id}` : undefined}
        className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-line px-2 py-px text-xs text-muted transition-colors hover:border-ink hover:text-ink"
      >
        {copied ? <Check className="size-3" /> : <Sparkles className="size-3" />}
        {copied ? 'copied' : 'prompt'}
      </button>

      {open ? (
        <div
          id={`prompt-${item.id}`}
          role="tooltip"
          className="absolute right-0 bottom-full z-20 mb-1.5 w-max max-w-[min(28rem,70vw)] rounded-lg border border-line bg-paper p-2.5 shadow-lg"
        >
          <p className="font-mono text-[11px] leading-5 break-words select-text">{text}</p>
          <p className="mt-1.5 text-[10px] text-muted">Click to copy. Paste into an agent session.</p>
        </div>
      ) : null}
    </div>
  );
}
