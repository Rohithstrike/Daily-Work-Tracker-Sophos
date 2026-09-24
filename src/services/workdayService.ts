import { supabase } from '@/lib/supabase';
import { toAppError, AppError, ERROR_MESSAGES } from '@/lib/errors';
import type { Activity, BreakEntry, DateRange, IsoDate, WorkDay, WorkDayDetail } from '@/types';

const WORK_DAY_COLUMNS = 'id,user_id,work_date,started_at,finished_at,status,created_at,updated_at';
const ACTIVITY_COLUMNS =
  'id,work_day_id,type,priority,quantity,started_at,ended_at,duration_seconds,notes,created_at,updated_at';
const BREAK_COLUMNS =
  'id,work_day_id,type,started_at,ended_at,duration_seconds,created_at';

export async function getWorkDay(userId: string, workDate: IsoDate): Promise<WorkDay | null> {
  const { data, error } = await supabase
    .from('work_days')
    .select(WORK_DAY_COLUMNS)
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .maybeSingle();

  if (error) throw toAppError(error, 'loadWorkspace');
  return (data as WorkDay | null) ?? null;
}

/**
 * Loads the workday for the given local date, creating it when absent.
 * The UNIQUE(user_id, work_date) constraint makes this safe against races:
 * if a parallel tab wins, we simply read the existing row.
 */
export async function getOrCreateWorkDay(userId: string, workDate: IsoDate): Promise<WorkDay> {
  const existing = await getWorkDay(userId, workDate);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('work_days')
    .insert({ user_id: userId, work_date: workDate, started_at: new Date().toISOString() })
    .select(WORK_DAY_COLUMNS)
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const raced = await getWorkDay(userId, workDate);
      if (raced) return raced;
    }
    throw toAppError(error, 'loadWorkspace');
  }
  return data as WorkDay;
}

export async function loadWorkDayDetail(workDay: WorkDay): Promise<WorkDayDetail> {
  const [activities, breaks] = await Promise.all([
    listActivities(workDay.id),
    listBreaks(workDay.id),
  ]);
  return { workDay, activities, breaks };
}

export async function listActivities(workDayId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select(ACTIVITY_COLUMNS)
    .eq('work_day_id', workDayId)
    .order('started_at', { ascending: true });

  if (error) throw toAppError(error, 'loadWorkspace');
  return (data ?? []) as Activity[];
}

export async function listBreaks(workDayId: string): Promise<BreakEntry[]> {
  const { data, error } = await supabase
    .from('breaks')
    .select(BREAK_COLUMNS)
    .eq('work_day_id', workDayId)
    .order('started_at', { ascending: true });

  if (error) throw toAppError(error, 'loadWorkspace');
  return (data ?? []) as BreakEntry[];
}

/**
 * Batch-loads every workday in a half-open range together with its children.
 * Three queries total, regardless of how many days the range covers.
 */
export async function loadRangeDetails(
  userId: string,
  range: DateRange,
): Promise<WorkDayDetail[]> {
  const { data: dayRows, error: dayError } = await supabase
    .from('work_days')
    .select(WORK_DAY_COLUMNS)
    .eq('user_id', userId)
    .gte('work_date', range.start)
    .lt('work_date', range.endExclusive)
    .order('work_date', { ascending: true });

  if (dayError) throw toAppError(dayError, 'loadHistory');

  const days = (dayRows ?? []) as WorkDay[];
  if (days.length === 0) return [];

  const dayIds = days.map((day) => day.id);

  const [{ data: activityRows, error: activityError }, { data: breakRows, error: breakError }] =
    await Promise.all([
      supabase
        .from('activities')
        .select(ACTIVITY_COLUMNS)
        .in('work_day_id', dayIds)
        .order('started_at', { ascending: true }),
      supabase
        .from('breaks')
        .select(BREAK_COLUMNS)
        .in('work_day_id', dayIds)
        .order('started_at', { ascending: true }),
    ]);

  if (activityError) throw toAppError(activityError, 'loadHistory');
  if (breakError) throw toAppError(breakError, 'loadHistory');

  const activitiesByDay = groupBy((activityRows ?? []) as Activity[], (row) => row.work_day_id);
  const breaksByDay = groupBy((breakRows ?? []) as BreakEntry[], (row) => row.work_day_id);

  return days.map((workDay) => ({
    workDay,
    activities: activitiesByDay.get(workDay.id) ?? [],
    breaks: breaksByDay.get(workDay.id) ?? [],
  }));
}

/** Finishes the day. Open activities and breaks are closed by a DB trigger. */
export async function finishWorkDay(workDayId: string): Promise<WorkDay> {
  const finishedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('work_days')
    .update({ status: 'completed', finished_at: finishedAt })
    .eq('id', workDayId)
    .select(WORK_DAY_COLUMNS)
    .single();

  if (error) throw toAppError(error, 'finishDay');
  return data as WorkDay;
}

/** Reopens a completed day for corrections. No data is deleted. */
export async function reopenWorkDay(workDayId: string): Promise<WorkDay> {
  const { data, error } = await supabase
    .from('work_days')
    .update({ status: 'active' })
    .eq('id', workDayId)
    .select(WORK_DAY_COLUMNS)
    .single();

  if (error) throw toAppError(error, 'reopenDay');
  return data as WorkDay;
}

export function assertDayEditable(workDay: WorkDay): void {
  if (workDay.status === 'completed') {
    throw new AppError(ERROR_MESSAGES.dayLocked);
  }
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const bucket = map.get(id);
    if (bucket) bucket.push(row);
    else map.set(id, [row]);
  }
  return map;
}
