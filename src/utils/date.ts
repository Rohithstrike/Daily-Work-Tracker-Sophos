import { format, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { DateRange, IsoDate, IsoTimestamp } from '@/types';

export const FALLBACK_TIMEZONE = 'UTC';

/** The browser timezone, used as the default for new profiles. */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function safeTimezone(timezone: string | null | undefined): string {
  if (timezone && isValidTimezone(timezone)) return timezone;
  return detectBrowserTimezone();
}

/** Today's work date (yyyy-MM-dd) in the user's configured timezone. */
export function workDateFor(timezone: string, instant: Date = new Date()): IsoDate {
  return formatInTimeZone(instant, safeTimezone(timezone), 'yyyy-MM-dd');
}

/** Formats a UTC timestamp as local wall-clock time, e.g. "13:14". */
export function formatTime(iso: IsoTimestamp, timezone: string): string {
  return formatInTimeZone(parseISO(iso), safeTimezone(timezone), 'HH:mm');
}

export function formatTimeWithSeconds(iso: IsoTimestamp, timezone: string): string {
  return formatInTimeZone(parseISO(iso), safeTimezone(timezone), 'HH:mm:ss');
}

export function formatDateLong(date: IsoDate): string {
  return format(parseISO(`${date}T00:00:00`), 'EEEE, d MMMM yyyy');
}

export function formatDateShort(date: IsoDate): string {
  return format(parseISO(`${date}T00:00:00`), 'dd MMM yyyy');
}

export function weekdayName(date: IsoDate): string {
  return format(parseISO(`${date}T00:00:00`), 'EEEE');
}

export function monthName(month: number): string {
  return format(new Date(2000, month - 1, 1), 'MMMM');
}

/**
 * Converts a wall-clock "HH:mm" on a given work date, in the user's timezone,
 * into a UTC ISO timestamp for storage.
 */
export function zonedTimeToUtcIso(
  workDate: IsoDate,
  timeHHmm: string,
  timezone: string,
): IsoTimestamp {
  const normalised = timeHHmm.length === 5 ? `${timeHHmm}:00` : timeHHmm;
  return fromZonedTime(`${workDate}T${normalised}`, safeTimezone(timezone)).toISOString();
}

/** Extracts "HH:mm" in the user's timezone, for pre-filling time inputs. */
export function utcIsoToZonedHHmm(iso: IsoTimestamp, timezone: string): string {
  return formatInTimeZone(parseISO(iso), safeTimezone(timezone), 'HH:mm');
}

export function nowHHmm(timezone: string): string {
  return formatInTimeZone(new Date(), safeTimezone(timezone), 'HH:mm');
}

/** The user's current local date/time as a Date object (for calendar maths). */
export function zonedNow(timezone: string): Date {
  return toZonedTime(new Date(), safeTimezone(timezone));
}

/**
 * Half-open month boundaries. September 2026 => 2026-09-01 <= d < 2026-10-01.
 * Used by history, summaries, reports, exports and tests so that a month can
 * never accidentally include a neighbouring month.
 */
export function monthBounds(year: number, month: number): DateRange {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid month: ${year}-${month}`);
  }
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: `${pad4(year)}-${pad2(month)}-01`,
    endExclusive: `${pad4(nextYear)}-${pad2(nextMonth)}-01`,
  };
}

/** Converts an inclusive user-facing range into a half-open range. */
export function inclusiveRangeToHalfOpen(start: IsoDate, endInclusive: IsoDate): DateRange {
  const end = parseISO(`${endInclusive}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { start, endExclusive: format(end, 'yyyy-MM-dd') };
}

export function isWithinRange(date: IsoDate, range: DateRange): boolean {
  return date >= range.start && date < range.endExclusive;
}

/** Every calendar date in a month, as yyyy-MM-dd strings. */
export function datesInMonth(year: number, month: number): IsoDate[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dates: IsoDate[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    dates.push(`${pad4(year)}-${pad2(month)}-${pad2(day)}`);
  }
  return dates;
}

/** 0 = Sunday ... 6 = Saturday, for calendar grid offsets. */
export function weekdayIndex(date: IsoDate): number {
  return parseISO(`${date}T00:00:00`).getDay();
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseISO(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}

/** Monday-based or Sunday-based week containing the given date. */
export function weekRange(date: IsoDate, weekStartsOn: number): DateRange {
  const current = weekdayIndex(date);
  const diff = (current - weekStartsOn + 7) % 7;
  const start = addDays(date, -diff);
  return { start, endExclusive: addDays(start, 7) };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function pad4(value: number): string {
  return String(value).padStart(4, '0');
}
