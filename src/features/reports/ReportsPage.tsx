import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { toAppError } from '@/lib/errors';
import { customRangeSchema } from '@/lib/schemas';
import { markMonthExported, getMonth } from '@/services/monthService';
import { buildMonthReport, buildRangeReport } from '@/services/reportService';
import { DEFAULT_REPORT_PREFIX } from '@/lib/supabase';
import {
  inclusiveRangeToHalfOpen,
  monthName,
  workDateFor,
  zonedNow,
} from '@/utils/date';

type ExportKind = 'today' | 'currentMonth' | 'selectedMonth' | 'custom';

export default function ReportsPage() {
  const { user, profile, timezone } = useAuth();
  const toast = useToast();
  const today = useMemo(() => zonedNow(timezone), [timezone]);
  const todayDate = useMemo(() => workDateFor(timezone), [timezone]);

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [rangeStart, setRangeStart] = useState(todayDate);
  const [rangeEnd, setRangeEnd] = useState(todayDate);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ExportKind | null>(null);

  const prefix = profile?.report_prefix || DEFAULT_REPORT_PREFIX;

  const years = useMemo(() => {
    const current = today.getFullYear();
    return [current + 1, current, current - 1, current - 2];
  }, [today]);

  const exportMonth = async (kind: ExportKind, year: number, month: number) => {
    if (!user) return;
    setBusy(kind);
    try {
      // ExcelJS and the workbook writer are loaded on demand.
      const [{ generateWorkbook, downloadBlob, monthFilename }, report] = await Promise.all([
        import('@/services/excelService'),
        buildMonthReport(user.id, year, month, timezone),
      ]);
      const blob = await generateWorkbook(report);
      downloadBlob(blob, monthFilename(prefix, year, month));

      const existing = await getMonth(user.id, year, month);
      await markMonthExported(user.id, year, month, existing?.status);
      toast.success(`Exported ${monthName(month)} ${year}.`);
    } catch (error) {
      toast.error(toAppError(error, 'generateReport').userMessage);
    } finally {
      setBusy(null);
    }
  };

  const exportRange = async (kind: ExportKind, start: string, endInclusive: string, title: string) => {
    if (!user) return;
    setBusy(kind);
    try {
      const [{ generateWorkbook, downloadBlob, rangeFilename }, report] = await Promise.all([
        import('@/services/excelService'),
        buildRangeReport(user.id, inclusiveRangeToHalfOpen(start, endInclusive), timezone, title),
      ]);
      const blob = await generateWorkbook(report);
      downloadBlob(blob, rangeFilename(prefix, start, endInclusive));
      toast.success('Export ready.');
    } catch (error) {
      toast.error(toAppError(error, 'generateReport').userMessage);
    } finally {
      setBusy(null);
    }
  };

  const handleCustomExport = () => {
    const parsed = customRangeSchema.safeParse({ start: rangeStart, end: rangeEnd });
    if (!parsed.success) {
      setRangeError(parsed.error.issues[0]?.message ?? 'Select a valid range.');
      return;
    }
    setRangeError(null);
    void exportRange('custom', parsed.data.start, parsed.data.end, 'Custom range');
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Export professionally formatted Excel workbooks for sharing.
        </p>
      </header>

      <Alert tone="info" title="What each workbook contains">
        Four sheets: Monthly Summary, Daily Summary, Detailed Activity Log and Break Log. Month
        exports use half-open date boundaries, so September never contains October data.
      </Alert>

      <Card>
        <CardHeader
          title="Quick exports"
          description={`Files are named using your report prefix: ${prefix}.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={busy === 'today'}
            loadingLabel="Generating Excel…"
            onClick={() => void exportRange('today', todayDate, todayDate, 'Today')}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Today
          </Button>
          <Button
            loading={busy === 'currentMonth'}
            loadingLabel="Generating Excel…"
            onClick={() => void exportMonth('currentMonth', today.getFullYear(), today.getMonth() + 1)}
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            {monthName(today.getMonth() + 1)} {today.getFullYear()}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Selected month" description="Export any previous month." />
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <Field label="Month">
            {({ id }) => (
              <SelectInput
                id={id}
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(Number(event.target.value))}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>
                    {monthName(month)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label="Year">
            {({ id }) => (
              <SelectInput
                id={id}
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Button
            loading={busy === 'selectedMonth'}
            loadingLabel="Generating Excel…"
            onClick={() => void exportMonth('selectedMonth', selectedYear, selectedMonth)}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export month
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Saves as <code>{`${prefix} ${monthName(selectedMonth)} ${selectedYear}.xlsx`}</code>
        </p>
      </Card>

      <Card>
        <CardHeader title="Custom date range" description="Any inclusive start and end date." />
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <Field label="From">
            {({ id }) => (
              <TextInput id={id} type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
            )}
          </Field>
          <Field label="To" error={rangeError ?? undefined}>
            {({ id }) => (
              <TextInput id={id} type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
            )}
          </Field>
          <Button loading={busy === 'custom'} loadingLabel="Generating Excel…" onClick={handleCustomExport}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export range
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Saves as <code>{`${prefix} ${rangeStart} - ${rangeEnd}.xlsx`}</code>
        </p>
      </Card>
    </div>
  );
}
