import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

type Tone = 'info' | 'success' | 'warning' | 'error';

const TONES: Record<Tone, { class: string; icon: ReactNode; label: string }> = {
  info: {
    class: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
    icon: <Info className="h-4 w-4" aria-hidden="true" />,
    label: 'Information',
  },
  success: {
    class: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    label: 'Success',
  },
  warning: {
    class: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
    label: 'Warning',
  },
  error: {
    class: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
    icon: <XCircle className="h-4 w-4" aria-hidden="true" />,
    label: 'Error',
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const config = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm', config.class, className)}
    >
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <div>
        <span className="sr-only">{config.label}: </span>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
