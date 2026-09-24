import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, TextInput } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import { ACTIVITY_RULE_LIST, PRIORITIES } from '@/lib/activityRules';
import { summarisePeriod } from '@/lib/summary';
import { toAppError } from '@/lib/errors';
import { loadRangeDetails } from '@/services/workdayService';
import {
  formatDateShort,
  inclusiveRangeToHalfOpen,
  monthBounds,
  weekRange,
  workDateFor,
} from '@/utils/date';
import { formatDuration, toDecimalHours } from '@/utils/duration';
import type { DateRange, WorkDayDetail } from '@/types';

// Recharts is only fetched when this page renders.
const ChartsPanel = lazy(() => import('@/features/dashboard/ChartsPanel'));

type PresetKey = 'today' | 'week' | 'month' | 'custom';

export default function DashboardPage() {
  const { user, profile, timezone } = useAuth();
  const todayDate = useMemo(() => workDateFor(timezone), [timezone]);

  const [preset, setPreset] = useState<PresetKey>('month');
  const [customStart, setCustomStart] = useState(todayDate);
  const [customEnd, setCustomEnd] = useState(todayDate);
  const [details, setDetails] = useState<WorkDayDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo<DateRange>(() => {
    const [year, month] = todayDate.split('-').map(Number) as [number, number];
    switch (preset) {
      case 'today':
        return inclusiveRangeToHalfOpen(todayDate, todayDate);
      case 'week':
        return weekRange(todayDate, profile?.week_starts_on ?? 1);
      case 'custom':
        return inclusiveRangeToHalfOpen(customStart, customEnd < customStart ? customStart : customEnd);
      case 'month':
      default:
        return monthBounds(year, month);
    }
  }, [preset, todayDate, profile?.week_starts_on, customStart, customEnd]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setDetails(await loadRangeDetails(user.id, range));
    } catch (caught) {
      setError(toAppError(caught, 'loadHistory').userMessage);
    } finally {
      setLoading(false);
    }
  }, [user, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarisePeriod(details, range), [details, range]);

  const dailyPoints = summary.days.map((day) => ({
    date: day.workDate,
    label: formatDateShort(day.workDate).slice(0, 6),
    items: day.totalQuantity,
    workHours: toDecimalHours(day.workSeconds),
    lunchHours: toDecimalHours(day.breakSeconds),
  }));

  const categoryPoints = ACTIVITY_RULE_LIST.map((rule) => ({
    type: rule.type,
    label: rule.label,
    value: summary.categoryTotals[rule.type],
  }));

  const priorityPoints = PRIORITIES.map((priority) => ({
    priority,
    value: summary.priorityTotals[priority],
  }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Workload and time analysis for the selected period.
        </p>
      </header>

      <Card>
        <div className="flex flex-wrap items-end gap-2">
          {(['today', 'week', 'month', 'custom'] as PresetKey[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={preset === key ? 'primary' : 'secondary'}
              aria-pressed={preset === key}
              onClick={() => setPreset(key)}
            >
              {key === 'today' ? 'Today' : key === 'week' ? 'This week' : key === 'month' ? 'This month' : 'Custom range'}
            </Button>
          ))}
        </div>

        {preset === 'custom' ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:max-w-md">
            <Field label="From">
              {({ id }) => (
                <TextInput id={id} type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              )}
            </Field>
            <Field label="To">
              {({ id }) => (
                <TextInput id={id} type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              )}
            </Field>
          </div>
        ) : null}
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <LoadingState label="Loading dashboard…" />
      ) : summary.workingDays === 0 ? (
        <EmptyState
          title="No data available for the selected range"
          description="Record some activities and they will appear here."
          icon={<BarChart3 className="h-7 w-7" />}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Working days" value={String(summary.workingDays)} />
            <Metric label="Items recorded" value={String(summary.totalQuantity)} />
            <Metric label="Total work time" value={formatDuration(summary.totalWorkSeconds)} />
            <Metric label="Total lunch time" value={formatDuration(summary.totalBreakSeconds)} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {categoryPoints.map((point) => (
              <Metric key={point.type} label={point.label} value={String(point.value)} compact />
            ))}
          </div>

          <Suspense fallback={<LoadingState label="Loading charts…" />}>
            <ChartsPanel
              dailyPoints={dailyPoints}
              categoryPoints={categoryPoints}
              priorityPoints={priorityPoints}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="card p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={
          compact
            ? 'mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50'
            : 'mt-0.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50'
        }
      >
        {value}
      </p>
    </div>
  );
}
