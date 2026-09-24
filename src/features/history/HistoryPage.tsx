import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Lock, RotateCcw } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { Timeline } from '@/features/today/Timeline';
import { summariseDay } from '@/lib/summary';
import { toAppError } from '@/lib/errors';
import { getMonth, markMonthComplete, reopenMonth } from '@/services/monthService';
import { loadRangeDetails } from '@/services/workdayService';
import { datesInMonth, formatDateLong, monthBounds, monthName, weekdayIndex, zonedNow } from '@/utils/date';
import { formatDuration } from '@/utils/duration';
import type { MonthRecord, WorkDayDetail } from '@/types';
import { cn } from '@/utils/cn';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HistoryPage() {
  const { user, profile, timezone } = useAuth();
  const toast = useToast();
  const today = useMemo(() => zonedNow(timezone), [timezone]);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [details, setDetails] = useState<WorkDayDetail[]>([]);
  const [monthRecord, setMonthRecord] = useState<MonthRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'complete' | 'reopen'>(null);
  const [busy, setBusy] = useState(false);

  const weekStartsOn = profile?.week_starts_on ?? 1;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [rows, record] = await Promise.all([
        loadRangeDetails(user.id, monthBounds(year, month)),
        getMonth(user.id, year, month),
      ]);
      setDetails(rows);
      setMonthRecord(record);
    } catch (caught) {
      setError(toAppError(caught, 'loadHistory').userMessage);
    } finally {
      setLoading(false);
    }
  }, [user, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = useMemo(() => {
    const map = new Map<string, WorkDayDetail>();
    for (const detail of details) map.set(detail.workDay.work_date, detail);
    return map;
  }, [details]);

  const incompleteDays = details.filter((detail) => detail.workDay.status !== 'completed').length;

  const changeMonth = (delta: number) => {
    const next = month + delta;
    if (next < 1) {
      setMonth(12);
      setYear(year - 1);
    } else if (next > 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(next);
    }
    setSelectedDate(null);
  };

  const handleMonthAction = async (action: 'complete' | 'reopen') => {
    if (!user) return;
    setBusy(true);
    try {
      const record =
        action === 'complete'
          ? await markMonthComplete(user.id, year, month)
          : await reopenMonth(user.id, year, month);
      setMonthRecord(record);
      toast.success(action === 'complete' ? 'Month marked as complete.' : 'Month reopened.');
      setConfirm(null);
    } catch (caught) {
      toast.error(toAppError(caught, 'generic').userMessage);
    } finally {
      setBusy(false);
    }
  };

  const dates = datesInMonth(year, month);
  const leadingBlanks = (weekdayIndex(dates[0] ?? `${year}-01-01`) - weekStartsOn + 7) % 7;
  const orderedWeekdays = Array.from({ length: 7 }, (_, index) => WEEKDAY_LABELS[(weekStartsOn + index) % 7]);

  const selectedDetail = selectedDate ? byDate.get(selectedDate) : undefined;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">History</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Browse recorded days by year and month.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => changeMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
            {monthName(month)} {year}
          </span>
          <Button variant="secondary" size="sm" onClick={() => changeMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <CardHeader
          title={`${monthName(month)} ${year}`}
          description={`${details.length} recorded ${details.length === 1 ? 'day' : 'days'} · ${incompleteDays} in progress`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <MonthStatusBadge record={monthRecord} />
              {monthRecord?.status === 'completed' || monthRecord?.status === 'exported' ? (
                <Button variant="secondary" size="sm" onClick={() => setConfirm('reopen')}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reopen month
                </Button>
              ) : (
                <Button variant="success" size="sm" onClick={() => setConfirm('complete')}>
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  Mark month complete
                </Button>
              )}
            </div>
          }
        />

        {loading ? (
          <LoadingState label="Loading history…" />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label={`${monthName(month)} ${year} calendar`}>
              {orderedWeekdays.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {label}
                </div>
              ))}
              {Array.from({ length: leadingBlanks }, (_, index) => (
                <div key={`blank-${index}`} aria-hidden="true" />
              ))}
              {dates.map((date) => {
                const detail = byDate.get(date);
                const summary = detail ? summariseDay(detail) : null;
                const completed = detail?.workDay.status === 'completed';
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={!detail}
                    onClick={() => setSelectedDate(date)}
                    aria-label={
                      detail
                        ? `${formatDateLong(date)}: ${completed ? 'completed' : 'in progress'}, ${summary?.activityCount ?? 0} entries, ${formatDuration(summary?.workSeconds ?? 0)} worked`
                        : `${formatDateLong(date)}: no data`
                    }
                    className={cn(
                      'min-h-[74px] rounded-lg border p-1.5 text-left text-xs transition-colors',
                      !detail &&
                        'cursor-not-allowed border-dashed border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600',
                      detail &&
                        completed &&
                        'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40',
                      detail &&
                        !completed &&
                        'border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40',
                    )}
                  >
                    <span className="block font-semibold text-slate-700 dark:text-slate-200">
                      {Number(date.slice(-2))}
                    </span>
                    {detail && summary ? (
                      <span className="mt-0.5 block space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="block font-medium">
                          {completed ? 'Completed' : 'In progress'}
                        </span>
                        <span className="block">{summary.activityCount} entries</span>
                        <span className="block tabular-nums">{formatDuration(summary.workSeconds)}</span>
                        <span className="block tabular-nums">
                          Lunch {formatDuration(summary.breakSeconds)}
                        </span>
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-[11px]">No data</span>
                    )}
                  </button>
                );
              })}
            </div>

            {details.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No data available for this month"
                  description="Days appear here once you start recording activities."
                  icon={<CalendarDays className="h-7 w-7" />}
                />
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Dialog
        open={selectedDetail !== undefined && selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatDateLong(selectedDate) : 'Day'}
        description="Read-only timeline for this day."
        size="lg"
      >
        {selectedDetail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Status" value={selectedDetail.workDay.status === 'completed' ? 'Completed' : 'In progress'} />
              <Stat label="Entries" value={String(selectedDetail.activities.length)} />
              <Stat label="Working time" value={formatDuration(summariseDay(selectedDetail).workSeconds)} />
              <Stat label="Lunch" value={formatDuration(summariseDay(selectedDetail).breakSeconds)} />
            </div>
            <Timeline
              activities={selectedDetail.activities}
              breaks={selectedDetail.breaks}
              timezone={timezone}
              now={new Date()}
              readOnly
            />
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'complete' ? 'Mark this month as complete?' : 'Reopen this month?'}
        description={
          confirm === 'complete'
            ? 'Month status is explicit and never changes automatically. No data is deleted.'
            : 'The month returns to in progress. No data is deleted.'
        }
        confirmLabel={confirm === 'complete' ? 'Mark complete' : 'Reopen month'}
        tone={confirm === 'complete' ? 'success' : 'primary'}
        loading={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => void handleMonthAction(confirm === 'complete' ? 'complete' : 'reopen')}
      >
        {confirm === 'complete' && incompleteDays > 0 ? (
          <Alert tone="warning" title="Some days are still in progress">
            {incompleteDays} {incompleteDays === 1 ? 'day has' : 'days have'} not been finished. You
            can still mark the month complete and reopen it later.
          </Alert>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function MonthStatusBadge({ record }: { record: MonthRecord | null }) {
  if (!record || record.status === 'in_progress') {
    return <Badge>In progress</Badge>;
  }
  if (record.status === 'completed') {
    return (
      <Badge
        className="bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900"
        icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
      >
        Completed
      </Badge>
    );
  }
  return (
    <Badge className="bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300">
      Exported
    </Badge>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
