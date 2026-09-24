/**
 * Report data preparation.
 *
 * All report maths happens here (and in lib/summary.ts), never inside React
 * components. The output of these functions is plain data, which makes it easy
 * to unit test and to hand straight to the Excel writer.
 */

import {
  ACTIVITY_RULE_LIST,
  ACTIVITY_RULES,
  ACTIVITY_TYPES,
  PRIORITIES,
  PRIORITISED_TYPES,
  BREAK_LABELS,
  type ActivityType,
} from '@/lib/activityRules';
import { buildTimeline } from '@/lib/timeline';
import { summarisePeriod, type PeriodSummary } from '@/lib/summary';
import { loadRangeDetails } from '@/services/workdayService';
import {
  formatDateShort,
  formatTime,
  monthBounds,
  monthName,
  weekdayName,
} from '@/utils/date';
import { formatDuration, toDecimalHours } from '@/utils/duration';
import type { DateRange, IsoDate, WorkDayDetail } from '@/types';

export interface ReportMeta {
  title: string;
  subtitle: string;
  range: DateRange;
  /** Inclusive end date, shown to the user. */
  endInclusive: IsoDate;
  timezone: string;
  generatedAt: string;
}

export interface DailyRow {
  date: IsoDate;
  dateLabel: string;
  day: string;
  status: string;
  categories: Record<ActivityType, number>;
  priorityByType: Record<string, number>;
  workDuration: string;
  workHours: number;
  lunchDuration: string;
  lunchHours: number;
  /** All notes recorded that day, combined for at-a-glance reference. */
  notes: string;
}

export interface ActivityRow {
  date: IsoDate;
  dateLabel: string;
  start: string;
  end: string;
  duration: string;
  durationHours: number;
  type: string;
  priority: string;
  quantity: number;
  notes: string;
}

export interface BreakRow {
  date: IsoDate;
  dateLabel: string;
  type: string;
  start: string;
  end: string;
  duration: string;
  durationHours: number;
}

export interface ReportData {
  meta: ReportMeta;
  summary: PeriodSummary;
  dailyRows: DailyRow[];
  activityRows: ActivityRow[];
  breakRows: BreakRow[];
}

/** Column keys such as "P1 Case", "P4 Peer Review" used by the daily sheet. */
export const PRIORITY_COLUMN_KEYS: readonly string[] = PRIORITISED_TYPES.flatMap((type) =>
  PRIORITIES.map((priority) => priorityColumnKey(type, priority)),
);

export function priorityColumnKey(type: ActivityType, priority: string): string {
  return `${priority} ${ACTIVITY_RULES[type].label}`;
}

export function buildReportData(
  details: WorkDayDetail[],
  range: DateRange,
  options: { title: string; subtitle: string; endInclusive: IsoDate; timezone: string },
  now: Date = new Date(),
): ReportData {
  const summary = summarisePeriod(details, range, now);
  const inRange = details
    .filter(
      (detail) =>
        detail.workDay.work_date >= range.start && detail.workDay.work_date < range.endExclusive,
    )
    .sort((a, b) => a.workDay.work_date.localeCompare(b.workDay.work_date));

  const timezone = options.timezone;

  // Notes per day, prefixed with their category so a case number stays in
  // context - e.g. "Case P1: INC-12345; AR P2: CX replied".
  const notesByDate = new Map<IsoDate, string>();
  for (const detail of inRange) {
    const parts = detail.activities
      .filter((activity) => activity.notes && activity.notes.trim().length > 0)
      .sort((a, b) => a.started_at.localeCompare(b.started_at))
      .map((activity) => {
        const label = ACTIVITY_RULES[activity.type].label;
        const priority = activity.priority ? ` ${activity.priority}` : '';
        return `${label}${priority}: ${activity.notes!.trim()}`;
      });
    notesByDate.set(detail.workDay.work_date, parts.join('; '));
  }

  const dailyRows: DailyRow[] = summary.days.map((day) => {
    const priorityByType: Record<string, number> = {};
    for (const type of PRIORITISED_TYPES) {
      for (const priority of PRIORITIES) {
        priorityByType[priorityColumnKey(type, priority)] =
          day.categoryPriorityTotals[type][priority];
      }
    }
    return {
      date: day.workDate,
      dateLabel: formatDateShort(day.workDate),
      day: weekdayName(day.workDate),
      status: day.status === 'completed' ? 'Completed' : 'In progress',
      categories: { ...day.categoryTotals },
      priorityByType,
      workDuration: formatDuration(day.workSeconds),
      workHours: toDecimalHours(day.workSeconds),
      lunchDuration: formatDuration(day.breakSeconds),
      lunchHours: toDecimalHours(day.breakSeconds),
      notes: notesByDate.get(day.workDate) ?? '',
    };
  });

  const activityRows: ActivityRow[] = [];
  const breakRows: BreakRow[] = [];

  for (const detail of inRange) {
    const date = detail.workDay.work_date;
    const dateLabel = formatDateShort(date);
    for (const entry of buildTimeline(detail.activities, detail.breaks)) {
      if (entry.kind === 'activity') {
        const activity = entry.activity;
        activityRows.push({
          date,
          dateLabel,
          start: formatTime(activity.started_at, timezone),
          end: activity.ended_at ? formatTime(activity.ended_at, timezone) : '—',
          duration: formatDuration(activity.duration_seconds),
          durationHours: toDecimalHours(activity.duration_seconds),
          type: ACTIVITY_RULES[activity.type].label,
          priority: activity.priority ?? '—',
          quantity: activity.quantity,
          notes: activity.notes ?? '',
        });
      } else {
        const breakEntry = entry.break;
        breakRows.push({
          date,
          dateLabel,
          type: BREAK_LABELS[breakEntry.type],
          start: formatTime(breakEntry.started_at, timezone),
          end: breakEntry.ended_at ? formatTime(breakEntry.ended_at, timezone) : '—',
          duration: formatDuration(breakEntry.duration_seconds),
          durationHours: toDecimalHours(breakEntry.duration_seconds),
        });
      }
    }
  }

  return {
    meta: {
      title: options.title,
      subtitle: options.subtitle,
      range,
      endInclusive: options.endInclusive,
      timezone,
      generatedAt: now.toISOString(),
    },
    summary,
    dailyRows,
    activityRows,
    breakRows,
  };
}

/** Fetches and prepares a month report using half-open month boundaries. */
export async function buildMonthReport(
  userId: string,
  year: number,
  month: number,
  timezone: string,
): Promise<ReportData> {
  const range = monthBounds(year, month);
  const details = await loadRangeDetails(userId, range);
  return buildReportData(details, range, {
    title: `${monthName(month)} ${year}`,
    subtitle: 'Monthly work summary',
    endInclusive: previousDate(range.endExclusive),
    timezone,
  });
}

export async function buildRangeReport(
  userId: string,
  range: DateRange,
  timezone: string,
  title = 'Custom range',
): Promise<ReportData> {
  const details = await loadRangeDetails(userId, range);
  return buildReportData(details, range, {
    title,
    subtitle: `${formatDateShort(range.start)} to ${formatDateShort(previousDate(range.endExclusive))}`,
    endInclusive: previousDate(range.endExclusive),
    timezone,
  });
}

export function categoryColumns(): { key: ActivityType; label: string }[] {
  return ACTIVITY_RULE_LIST.map((rule) => ({ key: rule.type, label: rule.label }));
}

export function allCategoryTypes(): readonly ActivityType[] {
  return ACTIVITY_TYPES;
}

function previousDate(date: IsoDate): IsoDate {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}
