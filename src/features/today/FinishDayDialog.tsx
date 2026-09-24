import { ACTIVITY_RULE_LIST } from '@/lib/activityRules';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDuration } from '@/utils/duration';
import type { DaySummary } from '@/lib/summary';

/** Confirmation with the full day's figures before the day is locked. */
export function FinishDayDialog({
  open,
  summary,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  summary: DaySummary;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="Finish the workday?"
      description="The day will be locked. You can reopen it later for corrections - nothing is deleted."
      confirmLabel="Finish day"
      tone="success"
      loading={loading}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <dl className="space-y-1.5 text-sm">
        {ACTIVITY_RULE_LIST.map((rule) => (
          <div key={rule.type} className="flex justify-between gap-4 border-b border-slate-100 pb-1 dark:border-slate-800">
            <dt className="text-slate-600 dark:text-slate-300">{rule.label}</dt>
            <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {summary.categoryTotals[rule.type]}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 pt-1">
          <dt className="text-slate-600 dark:text-slate-300">Working time</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatDuration(summary.workSeconds)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600 dark:text-slate-300">Lunch time</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatDuration(summary.breakSeconds)}
          </dd>
        </div>
      </dl>
    </ConfirmDialog>
  );
}
