import { ACTIVITY_RULE_LIST, PRIORITIES } from '@/lib/activityRules';
import { cn } from '@/utils/cn';
import type { DaySummary } from '@/lib/summary';

/**
 * One card per work category. Priority breakdowns are rendered only for the
 * categories that use priority - IR, Help and Threat Hunt never show P1-P4.
 */
export function SummaryCards({ summary }: { summary: DaySummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {ACTIVITY_RULE_LIST.map((rule) => {
        const total = summary.categoryTotals[rule.type];
        return (
          <article
            key={rule.type}
            className="card p-3.5"
            aria-label={`${rule.label}: ${total} recorded`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">{rule.label}</h3>
              <span
                className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', rule.accentClass)}
              >
                {rule.usesPriority ? 'P1–P4' : 'No priority'}
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {total}
            </p>
            {rule.usesPriority ? (
              <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
                {PRIORITIES.map((priority) => (
                  <div key={priority} className="rounded bg-slate-50 py-1 dark:bg-slate-800">
                    <dt className="text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                      {priority}
                    </dt>
                    <dd className="text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {summary.categoryPriorityTotals[rule.type][priority]}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Priority is not tracked for {rule.label}.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
