import { useState } from 'react';
import { CheckCircle2, Lock, Play, Plus, RotateCcw, UtensilsCrossed } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { ActivityFormDialog } from '@/features/today/ActivityFormDialog';
import { FinishDayDialog } from '@/features/today/FinishDayDialog';
import { PrivacyNotice } from '@/features/today/PrivacyNotice';
import { SummaryCards } from '@/features/today/SummaryCards';
import { Timeline } from '@/features/today/Timeline';
import { useNow } from '@/hooks/useNow';
import { useWorkday } from '@/hooks/useWorkday';
import { toAppError } from '@/lib/errors';
import { formatDateLong, formatTime, weekdayName } from '@/utils/date';
import { formatDuration, formatStopwatch, secondsBetween } from '@/utils/duration';
import type { Activity, ActivityInput } from '@/types';

export default function TodayPage() {
  const { timezone } = useAuth();
  const toast = useToast();
  const now = useNow(1000);
  const workday = useWorkday(now);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'lunch' | 'finish' | 'reopen' | 'delete'>(null);

  if (workday.loading && !workday.workDay) {
    return <LoadingState label="Loading workspace…" />;
  }

  if (workday.error) {
    return (
      <Alert tone="error" title="Unable to load your workday">
        {workday.error}
      </Alert>
    );
  }

  const { workDay, summary } = workday;
  if (!workDay || !summary) return <LoadingState label="Loading workspace…" />;

  const lunchSeconds = workday.currentBreak
    ? secondsBetween(workday.currentBreak.started_at, now.toISOString())
    : 0;

  const run = async (key: typeof busy, action: () => Promise<void>, success: string, fallback: Parameters<typeof toAppError>[1]) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(toAppError(error, fallback).userMessage);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            {weekdayName(workday.workDate)}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDateLong(workday.workDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {workday.isCompleted ? (
            <Badge
              className="bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900"
              icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Day completed
            </Badge>
          ) : workday.onLunch ? (
            <Badge
              className="bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900"
              icon={<UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              On lunch
            </Badge>
          ) : (
            <Badge
              className="bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300"
              icon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Working
            </Badge>
          )}
        </div>
      </header>

      {workday.isCompleted ? (
        <Alert tone="info" title="This day is completed">
          Reopen the day if you need to correct an entry. Nothing is deleted when you reopen.
        </Alert>
      ) : null}

      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Started" value={formatTime(workDay.started_at, timezone)} />
          <Metric
            label={workday.isCompleted ? 'Working time' : 'Working time (live)'}
            value={formatDuration(summary.workSeconds)}
          />
          <Metric
            label={workday.onLunch ? 'Lunch (running)' : 'Lunch total'}
            value={workday.onLunch ? formatStopwatch(lunchSeconds) : formatDuration(summary.breakSeconds)}
            tone={workday.onLunch ? 'warning' : 'default'}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={workday.isCompleted}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add activity
          </Button>

          {workday.onLunch ? (
            <Button
              variant="warning"
              loading={busy === 'lunch'}
              loadingLabel="Resuming…"
              disabled={workday.isCompleted}
              onClick={() =>
                run('lunch', workday.resumeWork, 'Welcome back. Lunch has been recorded.', 'endLunch')
              }
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Resume work
            </Button>
          ) : (
            <Button
              variant="warning"
              loading={busy === 'lunch'}
              loadingLabel="Starting…"
              disabled={workday.isCompleted}
              onClick={() => run('lunch', workday.beginLunch, 'Lunch started.', 'startLunch')}
            >
              <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
              Start lunch
            </Button>
          )}

          {workday.isCompleted ? (
            <Button
              variant="secondary"
              loading={busy === 'reopen'}
              loadingLabel="Reopening…"
              onClick={() => run('reopen', workday.reopenDay, 'The day is open for edits.', 'reopenDay')}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reopen day
            </Button>
          ) : (
            <Button variant="success" onClick={() => setFinishOpen(true)}>
              <Lock className="h-4 w-4" aria-hidden="true" />
              Finish day
            </Button>
          )}
        </div>
      </Card>

      <PrivacyNotice />

      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Today’s work
        </h2>
        <SummaryCards summary={summary} />
      </section>

      <Card>
        <CardHeader
          title="Timeline"
          description={`${summary.activityCount} ${summary.activityCount === 1 ? 'entry' : 'entries'} · ${summary.totalQuantity} items recorded`}
        />
        <Timeline
          activities={workday.activities}
          breaks={workday.breaks}
          timezone={timezone}
          now={now}
          readOnly={workday.isCompleted}
          onEdit={(activity) => {
            setEditing(activity);
            setFormOpen(true);
          }}
          onDelete={(activity) => setDeleting(activity)}
        />
      </Card>

      <ActivityFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        workDate={workday.workDate}
        timezone={timezone}
        activity={editing}
        onSubmit={async (input: ActivityInput) => {
          if (editing) {
            await workday.editActivity(editing.id, input);
            toast.success('Activity updated.');
          } else {
            await workday.addActivity(input);
            toast.success('Activity added.');
          }
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this activity?"
        description="This removes the entry from the timeline and from all reports."
        confirmLabel="Delete activity"
        tone="danger"
        loading={busy === 'delete'}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          if (!target) return;
          void run(
            'delete',
            async () => {
              await workday.removeActivity(target.id);
              setDeleting(null);
            },
            'Activity deleted.',
            'deleteActivity',
          );
        }}
      />

      <FinishDayDialog
        open={finishOpen}
        summary={summary}
        loading={busy === 'finish'}
        onClose={() => setFinishOpen(false)}
        onConfirm={() =>
          void run(
            'finish',
            async () => {
              await workday.finishDay();
              setFinishOpen(false);
            },
            'Workday finished.',
            'finishDay',
          )
        }
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={
          tone === 'warning'
            ? 'mt-0.5 text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400'
            : 'mt-0.5 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50'
        }
      >
        {value}
      </p>
    </div>
  );
}
