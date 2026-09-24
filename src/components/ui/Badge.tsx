import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Colour is never the only signal - every badge carries a text label. */
export function Badge({
  children,
  className,
  icon,
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
