import { Check } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export function Checkbox({ checked, onCheckedChange, className, label, ...props }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-[5px] border border-line',
        'transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2',
        checked && 'border-ink bg-ink text-paper',
        className,
      )}
      {...props}
    >
      {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
    </button>
  );
}
