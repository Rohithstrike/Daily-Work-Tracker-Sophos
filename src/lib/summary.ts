/**
 * Pure summary logic.
 *
 * Everything in this file is a pure function over plain data so that daily and
 * monthly figures can be unit tested without rendering React and reused by the
 * dashboard, the history pages and the Excel report services.
 */

import {
  ACTIVITY_TYPES,
  PRIORITIES,
  ACTIVITY_RULES,
  type ActivityType,
  type Priority,
} from '@/lib/activityRules';
import { secondsBetween } from '@/utils/duration';
import { isWithinRange } from '@/utils/date';
import type {
  Activity,
  BreakEntry,
  DateRange,
  IsoDate,
  IsoTimestamp,
  WorkDay,
  WorkDayDetail,
} from '@/types';

export type CategoryTotals = Record<ActivityType, number>;
export type PriorityTotals = Record<Priority, number>;
export type CategoryPriorityTotals = Record<ActivityType, PriorityTotals>;

export interface DaySummary {
  workDate: IsoDate;
  status: WorkDay['status'];
  startedAt: IsoTimestamp;
  finishedAt: IsoTimestamp | null;
  /** Quantities per activity type. */
  categoryTotals: CategoryTotals;
  /** Quantities per priority, across all prioritised types. */
  priorityTotals: PriorityTotals;
  /** Quantities per type, broken down by priority. */
  categoryPriorityTotals: CategoryPriorityTotals;
  /** Total quantity of all activities. */
  totalQuantity: number;
  /** Number of activity records. */
  activityCount: number;
  /** Elapsed time on the clock, minus break time. Never negative. */
  workSeconds: number;
  /** Total break time (currently lunch only). */
  breakSeconds: number;
  /** Elapsed time between start and finish, including breaks. */
  elapsedSeconds: number;
}

export function emptyCategoryTotals(): CategoryTotals {
  return ACTIVITY_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {} as CategoryTotals);
}

export function emptyPriorityTotals(): PriorityTotals {
  return PRIORITIES.reduce((acc, priority) => {
    acc[priority] = 0;
    return acc;
  }, {} as PriorityTotals);
}

export function emptyCategoryPriorityTotals(): CategoryPriorityTotals {
  return ACTIVITY_TYPES.reduce((acc, type) => {
    acc[type] = emptyPriorityTotals();
    return acc;
  }, {} as CategoryPriorityTotals);
}

/** Duration of one record; falls back to computing it from the timestamps. */
export function entryDurationSeconds(
  entry: Pick<Activity, 'started_at' | 'ended_at' | 'duration_seconds'>,
  now: Date = new Date(),
): number {
  if (typeof entry.duration_seconds === 'number' && entry.duration_seconds >= 0) {
    return entry.duration_seconds;
  }
  const end = entry.ended_at ?? now.toISOString();
  return secondsBetween(entry.started_at, end);
}

/** Total break seconds, counting an open break up to `now`. */
export function totalBreakSeconds(breaks: BreakEntry[], now: Date = new Date()): number {
  return breaks.reduce((total, entry) => total + entryDurationSeconds(entry, now), 0);
}

/**
 * Working time = elapsed time on the clock minus break time.
 * An unfinished day counts up to `now`.
 */
export function workSecondsFor(
  workDay: Pick<WorkDay, 'started_at' | 'finished_at'>,
  breaks: BreakEntry[],
  now: Date = new Date(),
): number {
  const elapsed = elapsedSecondsFor(workDay, now);
  return Math.max(0, elapsed - totalBreakSeconds(breaks, now));
}

export function elapsedSecondsFor(
  workDay: Pick<WorkDay, 'started_at' | 'finished_at'>,
  now: Date = new Date(),
): number {
  const end = workDay.finished_at ?? now.toISOString();
  return secondsBetween(workDay.started_at, end);
}

export function summariseActivities(activities: Activity[]): {
  categoryTotals: CategoryTotals;
  priorityTotals: PriorityTotals;
  categoryPriorityTotals: CategoryPriorityTotals;
  totalQuantity: number;
} {
  const categoryTotals = emptyCategoryTotals();
  const priorityTotals = emptyPriorityTotals();
  const categoryPriorityTotals = emptyCategoryPriorityTotals();
  let totalQuantity = 0;

  for (const activity of activities) {
    const quantity = Number.isFinite(activity.quantity) ? activity.quantity : 0;
    categoryTotals[activity.type] += quantity;
    totalQuantity += quantity;

    const priority = activity.priority;
    if (priority && ACTIVITY_RULES[activity.type].usesPriority) {
      priorityTotals[priority] += quantity;
      categoryPriorityTotals[activity.type][priority] += quantity;
    }
  }

  return { categoryTotals, priorityTotals, categoryPriorityTotals, totalQuantity };
}

export function summariseDay(detail: WorkDayDetail, now: Date = new Date()): DaySummary {
  const { workDay, activities, breaks } = detail;
  const { categoryTotals, priorityTotals, categoryPriorityTotals, totalQuantity } =
    summariseActivities(activities);
  const breakSeconds = totalBreakSeconds(breaks, now);
  const elapsedSeconds = elapsedSecondsFor(workDay, now);

  return {
    workDate: workDay.work_date,
    status: workDay.status,
    startedAt: workDay.started_at,
    finishedAt: workDay.finished_at,
    categoryTotals,
    priorityTotals,
    categoryPriorityTotals,
    totalQuantity,
    activityCount: activities.length,
    workSeconds: Math.max(0, elapsedSeconds - breakSeconds),
    breakSeconds,
    elapsedSeconds,
  };
}

export interface PeriodSummary {
  range: DateRange;
  workingDays: number;
  completedDays: number;
  incompleteDays: number;
  categoryTotals: CategoryTotals;
  priorityTotals: PriorityTotals;
  categoryPriorityTotals: CategoryPriorityTotals;
  totalQuantity: number;
  totalWorkSeconds: number;
  totalBreakSeconds: number;
  days: DaySummary[];
}

/**
 * Aggregates a set of workdays over a half-open range. Days outside the range
 * are ignored, which is what keeps September exports free of October data.
 */
export function summarisePeriod(
  details: WorkDayDetail[],
  range: DateRange,
  now: Date = new Date(),
): PeriodSummary {
  const inRange = details
    .filter((detail) => isWithinRange(detail.workDay.work_date, range))
    .sort((a, b) => a.workDay.work_date.localeCompare(b.workDay.work_date));

  const categoryTotals = emptyCategoryTotals();
  const priorityTotals = emptyPriorityTotals();
  const categoryPriorityTotals = emptyCategoryPriorityTotals();
  const days: DaySummary[] = [];

  let totalQuantity = 0;
  let totalWorkSeconds = 0;
  let totalBreakSecondsValue = 0;
  let completedDays = 0;

  for (const detail of inRange) {
    const day = summariseDay(detail, now);
    days.push(day);

    for (const type of ACTIVITY_TYPES) {
      categoryTotals[type] += day.categoryTotals[type];
      for (const priority of PRIORITIES) {
        categoryPriorityTotals[type][priority] += day.categoryPriorityTotals[type][priority];
      }
    }
    for (const priority of PRIORITIES) {
      priorityTotals[priority] += day.priorityTotals[priority];
    }

    totalQuantity += day.totalQuantity;
    totalWorkSeconds += day.workSeconds;
    totalBreakSecondsValue += day.breakSeconds;
    if (day.status === 'completed') completedDays += 1;
  }

  return {
    range,
    workingDays: days.length,
    completedDays,
    incompleteDays: days.length - completedDays,
    categoryTotals,
    priorityTotals,
    categoryPriorityTotals,
    totalQuantity,
    totalWorkSeconds,
    totalBreakSeconds: totalBreakSecondsValue,
    days,
  };
}
