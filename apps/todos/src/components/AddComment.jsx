import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { cn } from '../lib/utils.js';

/**
 * Post an update on an item.
 *
 * This is the only way information travels back INTO the repo without an agent
 * session. Not "from a phone": the app and the agent are both used from a desk
 * too, and what separates them is form versus conversation.
 * Ticking a box records that something ended; it loses why, and why is usually
 * the part worth keeping — "found her on rue de l'Arbre Sec, poster no longer
 * needed" is worth more later than a checked box.
 */
export function AddComment({ item, onPost }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!item.id) return null;

  const post = () => {
    const t = text.trim();
    if (!t) return setOpen(false);
    onPost(t);
    setText('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Post an update on this item"
        className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-line px-2 py-px text-xs text-muted transition-colors hover:border-ink hover:text-ink"
      >
        <MessageSquarePlus className="size-3" />
        update
      </button>
    );
  }

  return (
    <div className="col-start-3 sm:col-span-3 sm:col-start-3">
      <textarea
        autoFocus
        rows={2}
        value={text}
        placeholder="What happened?"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter posts, because this is one sentence typed with a thumb.
          // Shift+Enter keeps a line break for the rare longer update.
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); }
          if (e.key === 'Escape') { setText(''); setOpen(false); }
        }}
        onBlur={post}
        className={cn(
          'w-full resize-none rounded-lg border border-line bg-transparent px-2.5 py-1.5',
          'text-sm leading-5 focus-visible:outline-2 focus-visible:outline-offset-1',
        )}
      />
      <p className="mt-0.5 text-[10px] text-muted">Enter to post · Esc to cancel</p>
    </div>
  );
}
