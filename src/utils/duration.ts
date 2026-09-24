/** Duration helpers. All durations are stored and handled in whole seconds. */

export function secondsBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 1000));
}

/** "1h 11m" / "49m" / "0m". Never truncates long durations. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** "01:11:09" - used for live stopwatches. */
export function formatStopwatch(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, '0')).join(':');
}

/** Decimal hours, rounded to 2 places - used in Excel numeric columns. */
export function toDecimalHours(totalSeconds: number | null | undefined): number {
  if (!totalSeconds || totalSeconds <= 0) return 0;
  return Math.round((totalSeconds / 3600) * 100) / 100;
}

/** "1h 11m" for Excel text columns, or an em dash when there is no value. */
export function formatDurationOrDash(totalSeconds: number | null | undefined): string {
  return totalSeconds && totalSeconds > 0 ? formatDuration(totalSeconds) : '—';
}
