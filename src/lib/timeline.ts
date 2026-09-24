import type { Activity, BreakEntry, TimelineEntry, WorkDayDetail } from '@/types';

/**
 * Merges activities and breaks into a single chronological timeline.
 * Sorting is stable: equal start times fall back to creation time, then id,
 * so the order never flickers between renders.
 */
export function buildTimeline(
  activities: Activity[],
  breaks: BreakEntry[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...activities.map<TimelineEntry>((activity) => ({
      kind: 'activity',
      id: activity.id,
      startedAt: activity.started_at,
      activity,
    })),
    ...breaks.map<TimelineEntry>((breakEntry) => ({
      kind: 'break',
      id: breakEntry.id,
      startedAt: breakEntry.started_at,
      break: breakEntry,
    })),
  ];

  return entries.sort((a, b) => {
    const byStart = a.startedAt.localeCompare(b.startedAt);
    if (byStart !== 0) return byStart;
    const aCreated = a.kind === 'activity' ? a.activity.created_at : a.break.created_at;
    const bCreated = b.kind === 'activity' ? b.activity.created_at : b.break.created_at;
    const byCreated = aCreated.localeCompare(bCreated);
    if (byCreated !== 0) return byCreated;
    return a.id.localeCompare(b.id);
  });
}

export function buildTimelineForDay(detail: WorkDayDetail): TimelineEntry[] {
  return buildTimeline(detail.activities, detail.breaks);
}

/** The activity that is still running, if any. */
export function openActivity(activities: Activity[]): Activity | null {
  const open = activities.filter((activity) => activity.ended_at === null);
  if (open.length === 0) return null;
  return open.sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
}

/** The break that is still running, if any. At most one may exist. */
export function openBreak(breaks: BreakEntry[]): BreakEntry | null {
  const open = breaks.filter((entry) => entry.ended_at === null);
  if (open.length === 0) return null;
  return open.sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
}
