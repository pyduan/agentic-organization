import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { isOverdue, createQueue, flushOnHide, localToday, createSentLog, sameText } from '@kit/todo-client.mjs';
import { DueControl } from './DueControl.jsx';
import { CopyPrompt } from './CopyPrompt.jsx';
import { AddComment } from './AddComment.jsx';
import { Checkbox } from './ui/checkbox.jsx';
import { Badge } from './ui/badge.jsx';
import { Card, CardHeader, CardBody } from './ui/card.jsx';
import { cn } from '../lib/utils.js';

function Row({ item, path, today, sent, onToggle, onDue, onComment }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id ?? `line-${item.lineNo}`,
    disabled: !item.id,
  });

  // What this device has posted on this item: the mark stays once the list has
  // caught up, `fromHere` only while it has not.
  const posted = sent?.for(item.id) ?? [];
  const fromHere = sent?.missing(item) ?? [];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        // A grid, not a flex row: the metadata sits in fixed columns so owner and
        // due line up down the list instead of drifting with the length of the text.
        'group grid items-start gap-x-3 gap-y-1.5 rounded-lg px-3 py-2',
        'grid-cols-[1rem_1.25rem_1fr]',
        'sm:grid-cols-[1rem_1.25rem_1fr_5rem_7rem_5.5rem]',
        isDragging && 'relative z-10 bg-paper shadow-lg',
        item.done && 'text-muted',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Reorder"
        disabled={!item.id}
        className="mt-1 cursor-grab text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed"
      >
        <GripVertical className="size-4" />
      </button>

      <Checkbox
        checked={item.done}
        onCheckedChange={(next) => onToggle(item, next)}
        label={item.text}
        className="mt-0.5"
      />

      <div className="min-w-0">
        <p className={cn('text-sm leading-6', item.done && 'line-through')}>{item.text}</p>
        {item.notes?.length ? (
          <p className="mt-0.5 text-xs leading-5 text-muted">{item.notes.join(' ')}</p>
        ) : null}
        {item.comments?.length || fromHere.length ? (
          <ul className="mt-1 space-y-0.5 border-l border-line pl-2.5">
            {item.comments?.map((c, i) => (
              <li key={i} className="text-xs leading-5 text-muted">
                <span className="tabular-nums">{c.on}</span>
                {c.by ? <span> {c.by.split('@')[0]}</span> : null} · {c.text}
              </li>
            ))}
            {/* Sent from here, and this view does not have it yet. Shown so the
                person who wrote it can see it went, instead of retyping it. */}
            {fromHere.map((e, i) => (
              <li key={`sent-${i}`} className="text-xs leading-5 text-muted italic">
                <span className="tabular-nums">{e.on}</span> · {e.text}{' '}
                <span className="not-italic">(sent — this list is a step behind)</span>
              </li>
            ))}
          </ul>
        ) : null}
        {item.tags.length || posted.length ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <Badge key={t}>#{t}</Badge>
            ))}
            {posted.length ? (
              <Badge title={`You posted ${posted.length} update${posted.length > 1 ? 's' : ''} on this from this device`}>
                ✓ sent
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="col-start-3 flex min-w-0 items-center sm:col-start-4">
        {item.owners.length ? (
          <Badge className="truncate">@{item.owners.join(', @')}</Badge>
        ) : null}
      </div>

      <div className="col-start-3 flex items-center sm:col-start-5">
        <DueControl
          due={item.due}
          late={!item.done && isOverdue(item.due, today)}
          onChange={(due) => onDue(item, due)}
        />
      </div>

      <div className="col-start-3 flex flex-col items-stretch gap-1 sm:col-start-6">
        <CopyPrompt item={item} path={path} />
        <AddComment item={item} onPost={(text) => onComment(item, text)} />
      </div>
    </li>
  );
}

export default function TodoApp() {
  const [sources, setSources] = useState([]);
  const [source, setSource] = useState(null);
  const [items, setItems] = useState([]);
  // Où vit le fichier ouvert, pour que le prompt puisse nommer un vrai chemin.
  // Ne PAS nommer ceci `location` : ça masque le global du même nom, et
  // `location.search` lit alors un état nul. Coûté un déploiement.
  const [fileAt, setFileAt] = useState(null);
  // The queue outlives a render, so the source it posts to is read through a ref.
  const sourceRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  // What the server refused to apply. Silence here was a real bug: an intent the
  // server rejected (an id that no longer exists, an empty comment) left the screen
  // showing the change as applied, and only a reload told the truth.
  const [rejected, setRejected] = useState([]);
  // The receipts this device keeps for what it posted, scoped to the open file:
  // a `^id` is unique inside one file, not across two.
  const sent = useMemo(() => createSentLog({ key: `todo.sent.v1:${source ?? ''}` }), [source]);
  // Read through a ref for the same reason as `sourceRef`: the queue is built
  // once and outlives the render that created it.
  const sentRef = useRef(null);


  const load = useCallback(async (id) => {
    setStatus('loading');
    const res = await fetch(`/api/todos?source=${encodeURIComponent(id)}`);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setStatus('error');
      return;
    }
    const body = await res.json();
    setItems(body.items);
    setFileAt({ repo: body.repo, path: body.path });
    setStatus('idle');
    setError(null);
  }, []);

  useEffect(() => {
    fetch('/api/todos/files')
      .then((r) => r.json())
      .then((b) => {
        setSources(b.sources || []);
        if (!b.sources?.length) return setStatus('idle');
        // A ?source= in the URL is how a dashboard sends someone straight to one
        // subject. One door per subject only works if the door can be aimed.
        const asked = new URLSearchParams(window.location.search).get('source');
        setSource(b.sources.some((s) => s.id === asked) ? asked : b.sources[0].id);
      })
      .catch((e) => {
        setError(String(e.message));
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    sourceRef.current = source;
    sentRef.current = sent;
    if (source) load(source);
  }, [source, sent, load]);

  // Batching, retry state and the "do not lose a queued edit" wiring all live in
  // lib/todo-client.mjs, shared with the hand-written front ends that have no build.
  const queue = useRef(null);
  if (!queue.current) {
    queue.current = createQueue({
      send: async (intents) => {
        const res = await fetch('/api/todos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ source: sourceRef.current, intents }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        // The server's version wins: it applied the intents to whatever the file
        // says now, which may include someone else's edits — including undoing an
        // optimistic change it refused, which is why `rejected` must be shown.
        setItems(body.items);
        setRejected(body.rejected || []);
        // Confirmed by the server, so it is in the file: keep the receipt. A
        // refused intent gets none — a trace saying the opposite of what
        // happened is worse than no trace.
        const refused = (i) => (body.rejected || []).some((r) => r.intent?.id === i.id
          && r.intent?.op === i.op && sameText(r.intent?.text ?? '', i.text ?? ''));
        for (const i of intents) if (i.op === 'comment' && !refused(i)) sentRef.current?.add(i.id, i.text, i.on);
        return body;
      },
      onState: (state, err) => {
        setStatus(state);
        setError(err ? String(err.message) : null);
      },
    });
  }
  const push = useCallback((intent) => queue.current.push(intent), []);

  useEffect(() => flushOnHide(queue.current, window), []);

  const onToggle = (item, done) => {
    // The date of the tick is the person's date at the moment of the tick —
    // never a constant from page load, never the UTC day. See localToday.
    const on = localToday();
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done, doneOn: done ? on : null } : i)));
    push({ op: 'toggle', id: item.id, done, on });
  };
  const onComment = (item, text) => {
    // Optimistic, like the rest: the server stamps the real date and the author.
    const on = localToday();
    setItems((prev) => prev.map((i) => (i.id === item.id
      ? { ...i, comments: [...(i.comments || []), { on, by: null, text }] } : i)));
    push({ op: 'comment', id: item.id, text, on });
  };
  const onDue = (item, due) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, due: due || null } : i)));
    push({ op: 'set', id: item.id, due: due || null });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Commit on drop, never during the drag.
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, from, to);
    setItems(next);
    push({ op: 'reorder', ids: next.map((i) => i.id).filter(Boolean) });
  };

  const ids = useMemo(() => items.map((i) => i.id ?? `line-${i.lineNo}`), [items]);
  // Recomputed on every render rather than frozen at module load, so a tab left
  // open overnight stops calling today's items overdue.
  const today = localToday();
  const sourceLabel = sources.find((s) => s.id === source)?.label ?? source;
  const openCount = items.filter((i) => !i.done).length;

  return (
    <Card>
      <CardHeader>
        {sources.length > 1 ? (
          <select
            value={source ?? ''}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Project"
            className="rounded-md border border-line bg-transparent px-2 py-1 text-sm font-semibold"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        ) : (
          <h2 className="text-sm font-semibold">
            {sources[0]?.label ?? 'No source configured'}
          </h2>
        )}

        <span className="ml-auto text-xs text-muted">
          {status === 'saving' && 'saving…'}
          {status === 'saved' && 'saved'}
          {status === 'dirty' && 'unsaved'}
          {status === 'loading' && 'loading…'}
          {status === 'idle' && `${openCount} open`}
          {status === 'error' && <span className="text-late">{error}</span>}
        </span>
      </CardHeader>

      <CardBody>
        {rejected.length ? (
          <ul className="mx-3 mt-3 space-y-1 rounded-lg border border-late/40 px-3 py-2 text-xs text-late">
            {rejected.map((r, i) => (
              <li key={i}>Not applied: {r.reason ?? 'refused'}</li>
            ))}
          </ul>
        ) : null}

        {items.length === 0 && status !== 'loading' ? (
          <p className="px-3 py-6 text-sm text-muted">Nothing in this file yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul>
                {items.map((item) => (
                  <Row
                    key={item.id ?? `line-${item.lineNo}`}
                    item={item}
                    path={fileAt?.path ?? sourceLabel}
                    today={today}
                    sent={sent}
                    onToggle={onToggle}
                    onDue={onDue}
                    onComment={onComment}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </CardBody>
    </Card>
  );
}
