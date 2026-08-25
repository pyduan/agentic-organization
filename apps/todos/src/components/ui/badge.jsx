import { cn } from '../../lib/utils.js';

export function Badge({ className, tone = 'quiet', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-px text-xs whitespace-nowrap',
        tone === 'quiet' && 'border-line text-muted',
        tone === 'loud' && 'border-current font-semibold',
        tone === 'late' && 'border-current font-semibold text-late',
        className,
      )}
      {...props}
    />
  );
}
