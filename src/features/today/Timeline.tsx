import { Pencil, Trash2, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ACTIVITY_RULES, BREAK_LABELS } from '@/lib/activityRules';
import { buildTimeline } from '@/lib/timeline';
import { formatDuration, formatStopwatch, secondsBetween } from '@/utils/duration';
import { formatTime } from '@/utils/date';
import { cn } from '@/utils/cn';
import type { Activity, BreakEntry } from '@/types';

interface Props {
  activities: Activity[];
  breaks: BreakEntry[];
  timezone: string;
  now: Date;
  readOnly?: boolean;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void;
}

/** Chronological merge of activities and breaks. Readable on small screens. */
export function Timeline({ activities, breaks, timezone, now, readOnly, onEdit, onDelete }: Props) {
  const entries = buildTimeline(activities, breaks);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No activities recorded yet"
        description="Add your first activity of the day to start building the timeline."
      />
    );
  }

  return (
    <ol className="space-y-2.5" aria-label="Daily timeline">
      {entries.map((entry) => {
        if (entry.kind === 'break') {
          const breakEntry = entry.break;
          const running = breakEntry.ended_at === null;
          const seconds = running
            ? secondsBetween(breakEntry.started_at, now.toISOString())
            : (breakEntry.duration_seconds ?? 0);
          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
                {BREAK_LABELS[breakEntry.type]}
              </span>
              <span className="text-sm tabular-nums text-amber-900/80 dark:text-amber-200/80">
                {formatTime(breakEntry.started_at, timezone)} –{' '}
                {breakEntry.ended_at ? formatTime(breakEntry.ended_at, timezone) : 'in progress'}
              </span>
              <span className="ml-auto text-sm font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                {running ? formatStopwatch(seconds) : formatDuration(seconds)}
              </span>
            </li>
          );
        }

        const activity = entry.activity;
        const rule = ACTIVITY_RULES[activity.type];
        return (
          <li
            key={entry.id}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <Badge className={cn('ring-inset', rule.accentClass)}>{rule.label}</Badge>
              {rule.usesPriority && activity.priority ? (
                <Badge className="bg-slate-900 text-white ring-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-100">
                  {activity.priority}
                </Badge>
              ) : null}
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {activity.quantity} {activity.quantity === 1 ? 'item' : 'items'}
              </span>
              <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                {formatTime(activity.started_at, timezone)} –{' '}
                {activity.ended_at ? formatTime(activity.ended_at, timezone) : 'in progress'}
              </span>
              <span className="text-sm font-medium tabular-nums text-slate-600 dark:text-slate-300">
                {activity.ended_at
                  ? formatDuration(activity.duration_seconds)
                  : formatDuration(secondsBetween(activity.started_at, now.toISOString()))}
              </span>

              {!readOnly ? (
                <span className="ml-auto flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit?.(activity)} aria-label={`Edit ${rule.label} activity`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                    onClick={() => onDelete?.(activity)}
                    aria-label={`Delete ${rule.label} activity`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </span>
              ) : null}
            </div>
            {activity.notes ? (
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{activity.notes}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
