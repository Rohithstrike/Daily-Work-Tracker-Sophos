import type { ActivityType, BreakType, Priority } from '@/lib/activityRules';

export type { ActivityType, BreakType, Priority };

export type WorkDayStatus = 'active' | 'completed';
export type MonthStatus = 'in_progress' | 'completed' | 'exported';
export type ThemePreference = 'light' | 'dark' | 'system';

/** ISO date string in the user's timezone, e.g. "2026-09-24". */
export type IsoDate = string;
/** ISO 8601 UTC timestamp, e.g. "2026-09-24T09:30:00.000Z". */
export type IsoTimestamp = string;

export interface Profile {
  id: string;
  name: string | null;
  email: string;
  timezone: string;
  week_starts_on: number; // 0 = Sunday ... 6 = Saturday
  report_prefix: string;
  theme: ThemePreference;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface WorkDay {
  id: string;
  user_id: string;
  work_date: IsoDate;
  started_at: IsoTimestamp;
  finished_at: IsoTimestamp | null;
  status: WorkDayStatus;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface Activity {
  id: string;
  work_day_id: string;
  type: ActivityType;
  priority: Priority | null;
  quantity: number;
  started_at: IsoTimestamp;
  ended_at: IsoTimestamp | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface BreakEntry {
  id: string;
  work_day_id: string;
  type: BreakType;
  started_at: IsoTimestamp;
  ended_at: IsoTimestamp | null;
  duration_seconds: number | null;
  created_at: IsoTimestamp;
}

export interface MonthRecord {
  id: string;
  user_id: string;
  year: number;
  month: number; // 1-12
  status: MonthStatus;
  completed_at: IsoTimestamp | null;
  exported_at: IsoTimestamp | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

/** A workday with its children, as loaded for Today / History / Reports. */
export interface WorkDayDetail {
  workDay: WorkDay;
  activities: Activity[];
  breaks: BreakEntry[];
}

export type TimelineEntry =
  | { kind: 'activity'; id: string; startedAt: IsoTimestamp; activity: Activity }
  | { kind: 'break'; id: string; startedAt: IsoTimestamp; break: BreakEntry };

export interface ActivityInput {
  type: ActivityType;
  priority: Priority | null;
  quantity: number;
  started_at: IsoTimestamp;
  ended_at: IsoTimestamp | null;
  notes: string | null;
}

export interface DateRange {
  /** Inclusive lower bound (work_date >= start). */
  start: IsoDate;
  /** Exclusive upper bound (work_date < endExclusive). */
  endExclusive: IsoDate;
}
