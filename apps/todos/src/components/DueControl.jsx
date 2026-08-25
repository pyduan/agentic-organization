import { useState } from 'react';
import { PRESETS, dueLabel, isExactDay } from '../lib/due.js';
import { cn } from '../lib/utils.js';

export function DueControl({ due, late, onChange }) {
  const [picking, setPicking] = useState(false);

  const choose = (key) => {
    if (key === 'exact') return setPicking(true);
    setPicking(false);
    const preset = PRESETS.find((p) => p.key === key);
    onChange(preset?.value ? preset.value() : null);
  };

  if (picking) {
    return (
      <input
        autoFocus
        type="date"
        value={isExactDay(due) ? due : ''}
        onBlur={() => setPicking(false)}
        onChange={(e) => {
          onChange(e.target.value || null);
          setPicking(false);
        }}
        className="rounded-full border border-line bg-transparent px-2 py-px text-xs"
      />
    );
  }

  return (
    <select
      value={isExactDay(due) ? 'exact-set' : due ? 'set' : ''}
      onChange={(e) => choose(e.target.value)}
      aria-label="Due"
      className={cn(
        'rounded-full border border-line bg-transparent px-2 py-px text-xs text-muted',
        late && 'border-current font-semibold text-late',
      )}
    >
      {due ? <option value={isExactDay(due) ? 'exact-set' : 'set'}>{dueLabel(due)}</option> : null}
      {PRESETS.map((p) => (
        <option key={p.key} value={p.key}>{p.label}</option>
      ))}
    </select>
  );
}
