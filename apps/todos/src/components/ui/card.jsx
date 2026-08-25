import { cn } from '../../lib/utils.js';

export const Card = ({ className, ...props }) => (
  <div className={cn('rounded-xl border border-line', className)} {...props} />
);
export const CardHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-wrap items-baseline gap-3 border-b border-line px-5 py-4', className)} {...props} />
);
export const CardBody = ({ className, ...props }) => (
  <div className={cn('px-2 py-2', className)} {...props} />
);
