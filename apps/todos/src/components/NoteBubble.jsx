import { useState } from 'react';
import { PencilLine } from 'lucide-react';
import { cn } from '../lib/utils.js';

/**
 * Capture anything, from wherever the person already is.
 *
 * A to-do app only accepts to-do edits, and most of what someone wants to say
 * from a phone is not one: a number heard in a call, a piece of news, an idea.
 * The bubble takes it as it comes and commits it — dated, signed with the
 * verified author — into `source/inbox/notes/` of the notes target, where the
 * inbox protocol files it on the agent's next pass. The alternative is that
 * the thought waits for a keyboard, and mostly it does not survive the wait.
 */
export function NoteBubble() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState(null);

  const post = async () => {
    const t = text.trim();
    if (!t) return;
    setState('saving');
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setText('');
      setState('saved');
      setTimeout(() => { setState('idle'); setOpen(false); }, 2500);
    } catch (e) {
      setState('error');
      setError(String(e.message));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Note anything"
        aria-label="Note anything"
        className="fixed bottom-4 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-ink text-paper shadow-lg transition-transform hover:scale-105"
      >
        <PencilLine className="size-5" />
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-paper p-4 shadow-xl">
          <h2 className="text-sm font-semibold">Note anything</h2>
          <p className="mt-1 mb-2 text-xs text-muted">
            News, a number, an idea — as it comes. Dated, signed, filed in the
            inbox for the agent&rsquo;s next pass.
          </p>
          <textarea
            autoFocus
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
            className="w-full resize-y rounded-lg border border-line bg-transparent px-2.5 py-1.5 text-sm leading-5"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={post}
              disabled={state === 'saving'}
              className="rounded-full border border-line px-3 py-1 text-xs transition-colors hover:border-ink disabled:opacity-50"
            >
              {state === 'saving' ? 'saving…' : 'Note it'}
            </button>
            <span className={cn('text-xs', state === 'error' ? 'text-late' : 'text-muted')}>
              {state === 'saved' && 'noted ✓'}
              {state === 'error' && error}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
