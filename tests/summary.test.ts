import { describe, expect, it } from 'vitest';
import {
  summariseDay,
  summarisePeriod,
  totalBreakSeconds,
  workSecondsFor,
} from '../src/lib/summary';
import { buildTimeline } from '../src/lib/timeline';
import { formatDuration, secondsBetween } from '../src/utils/duration';
import { inclusiveRangeToHalfOpen, monthBounds } from '../src/utils/date';
import type { Activity, BreakEntry, WorkDay, WorkDayDetail } from '../src/types';

const NOW = new Date('2026-09-24T12:00:00.000Z');

function workDay(date: string, overrides: Partial<WorkDay> = {}): WorkDay {
  return {
    id: `day-${date}`,
    user_id: 'user-1',
    work_date: date,
    started_at: `${date}T03:00:00.000Z`,
    finished_at: `${date}T12:00:00.000Z`,
    status: 'completed',
    created_at: `${date}T03:00:00.000Z`,
    updated_at: `${date}T12:00:00.000Z`,
    ...overrides,
  };
}

let activitySeq = 0;
function activity(
  date: string,
  type: Activity['type'],
  priority: Activity['priority'],
  quantity: number,
  start = '04:00',
  end: string | null = '05:00',
): Activity {
  activitySeq += 1;
  const startedAt = `${date}T${start}:00.000Z`;
  const endedAt = end ? `${date}T${end}:00.000Z` : null;
  return {
    id: `activity-${activitySeq}`,
    work_day_id: `day-${date}`,
    type,
    priority,
    quantity,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: endedAt ? secondsBetween(startedAt, endedAt) : null,
    notes: null,
    created_at: startedAt,
    updated_at: startedAt,
  };
}

function lunch(date: string, start: string, end: string | null): BreakEntry {
  const startedAt = `${date}T${start}:00.000Z`;
  const endedAt = end ? `${date}T${end}:00.000Z` : null;
  return {
    id: `break-${date}-${start}`,
    work_day_id: `day-${date}`,
    type: 'LUNCH',
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: endedAt ? secondsBetween(startedAt, endedAt) : null,
    created_at: startedAt,
  };
}

describe('lunch duration', () => {
  it('14. records the actual lunch duration (49 minutes)', () => {
    const entry = lunch('2026-09-24', '12:25', '13:14');
    expect(entry.duration_seconds).toBe(49 * 60);
    expect(formatDuration(entry.duration_seconds)).toBe('49m');
  });

  it('15. does not truncate a lunch longer than one hour', () => {
    const entry = lunch('2026-09-24', '13:05', '14:16');
    expect(entry.duration_seconds).toBe(71 * 60);
    expect(formatDuration(entry.duration_seconds)).toBe('1h 11m');
    expect(totalBreakSeconds([entry], NOW)).toBe(4260);
  });
});

describe('daily summary', () => {
  const detail: WorkDayDetail = {
    workDay: workDay('2026-09-24'),
    activities: [
      activity('2026-09-24', 'CASE', 'P1', 3),
      activity('2026-09-24', 'CASE', 'P2', 2),
      activity('2026-09-24', 'AR', 'P2', 4),
      activity('2026-09-24', 'DUPE', 'P3', 1),
      activity('2026-09-24', 'IR', null, 2),
      activity('2026-09-24', 'PEER_REVIEW', 'P4', 1),
      activity('2026-09-24', 'MISC_HELP', null, 1),
      activity('2026-09-24', 'THREAT_HUNT', null, 2),
    ],
    breaks: [lunch('2026-09-24', '07:25', '08:14')],
  };

  const summary = summariseDay(detail, NOW);

  it('16. calculates daily category totals correctly', () => {
    expect(summary.categoryTotals).toEqual({
      CASE: 5,
      AR: 4,
      DUPE: 1,
      IR: 2,
      PEER_REVIEW: 1,
      MISC_HELP: 1,
      THREAT_HUNT: 2,
    });
    expect(summary.totalQuantity).toBe(16);
  });

  it('17. calculates daily priority totals correctly and excludes non-prioritised types', () => {
    expect(summary.priorityTotals).toEqual({ P1: 3, P2: 6, P3: 1, P4: 1 });
    expect(summary.categoryPriorityTotals.CASE).toEqual({ P1: 3, P2: 2, P3: 0, P4: 0 });
    expect(summary.categoryPriorityTotals.IR).toEqual({ P1: 0, P2: 0, P3: 0, P4: 0 });
    expect(summary.categoryPriorityTotals.THREAT_HUNT).toEqual({ P1: 0, P2: 0, P3: 0, P4: 0 });
  });

  it('18. subtracts break time from working time', () => {
    // 03:00 to 12:00 = 9h elapsed, minus 49m lunch = 8h 11m.
    expect(summary.elapsedSeconds).toBe(9 * 3600);
    expect(summary.breakSeconds).toBe(49 * 60);
    expect(summary.workSeconds).toBe(9 * 3600 - 49 * 60);
    expect(formatDuration(summary.workSeconds)).toBe('8h 11m');
  });

  it('counts an unfinished day and an open lunch up to now', () => {
    const openDay: WorkDayDetail = {
      workDay: workDay('2026-09-24', { finished_at: null, status: 'active' }),
      activities: [],
      breaks: [lunch('2026-09-24', '11:30', null)],
    };
    const openSummary = summariseDay(openDay, NOW);
    expect(openSummary.elapsedSeconds).toBe(9 * 3600);
    expect(openSummary.breakSeconds).toBe(30 * 60);
    expect(workSecondsFor(openDay.workDay, openDay.breaks, NOW)).toBe(9 * 3600 - 30 * 60);
  });

  it('25. sorts timeline entries chronologically', () => {
    const entries = buildTimeline(
      [
        activity('2026-09-24', 'IR', null, 1, '09:00', '09:30'),
        activity('2026-09-24', 'CASE', 'P1', 1, '04:00', '05:00'),
      ],
      [lunch('2026-09-24', '07:25', '08:14')],
    );
    expect(entries.map((entry) => entry.startedAt)).toEqual([
      '2026-09-24T04:00:00.000Z',
      '2026-09-24T07:25:00.000Z',
      '2026-09-24T09:00:00.000Z',
    ]);
    expect(entries[1]?.kind).toBe('break');
  });
});

describe('period summaries and month isolation', () => {
  const september: WorkDayDetail[] = [
    {
      workDay: workDay('2026-09-01'),
      activities: [activity('2026-09-01', 'CASE', 'P1', 3), activity('2026-09-01', 'IR', null, 1)],
      breaks: [lunch('2026-09-01', '07:00', '07:45')],
    },
    {
      workDay: workDay('2026-09-30'),
      activities: [activity('2026-09-30', 'AR', 'P2', 4)],
      breaks: [],
    },
  ];

  const october: WorkDayDetail[] = [
    {
      workDay: workDay('2026-10-01'),
      activities: [activity('2026-10-01', 'THREAT_HUNT', null, 5)],
      breaks: [lunch('2026-10-01', '07:00', '08:11')],
    },
    {
      workDay: workDay('2026-10-31'),
      activities: [activity('2026-10-31', 'DUPE', 'P3', 2)],
      breaks: [],
    },
  ];

  const all = [...september, ...october];

  it('19. calculates monthly totals correctly', () => {
    const summary = summarisePeriod(september, monthBounds(2026, 9), NOW);
    expect(summary.workingDays).toBe(2);
    expect(summary.completedDays).toBe(2);
    expect(summary.incompleteDays).toBe(0);
    expect(summary.categoryTotals.CASE).toBe(3);
    expect(summary.categoryTotals.AR).toBe(4);
    expect(summary.categoryTotals.IR).toBe(1);
    expect(summary.totalQuantity).toBe(8);
    expect(summary.priorityTotals).toEqual({ P1: 3, P2: 4, P3: 0, P4: 0 });
    expect(summary.totalBreakSeconds).toBe(45 * 60);
    expect(summary.totalWorkSeconds).toBe(2 * 9 * 3600 - 45 * 60);
  });

  it('20. a September export excludes October data', () => {
    const summary = summarisePeriod(all, monthBounds(2026, 9), NOW);
    expect(summary.days.map((day) => day.workDate)).toEqual(['2026-09-01', '2026-09-30']);
    expect(summary.categoryTotals.THREAT_HUNT).toBe(0);
    expect(summary.categoryTotals.DUPE).toBe(0);
  });

  it('21. an October export excludes September data', () => {
    const summary = summarisePeriod(all, monthBounds(2026, 10), NOW);
    expect(summary.days.map((day) => day.workDate)).toEqual(['2026-10-01', '2026-10-31']);
    expect(summary.categoryTotals.CASE).toBe(0);
    expect(summary.categoryTotals.AR).toBe(0);
    expect(summary.categoryTotals.THREAT_HUNT).toBe(5);
  });

  it('uses half-open month boundaries', () => {
    expect(monthBounds(2026, 9)).toEqual({ start: '2026-09-01', endExclusive: '2026-10-01' });
    expect(monthBounds(2026, 10)).toEqual({ start: '2026-10-01', endExclusive: '2026-11-01' });
    expect(monthBounds(2026, 12)).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' });
    expect(() => monthBounds(2026, 13)).toThrow(RangeError);
  });

  it('converts an inclusive custom range into a half-open range', () => {
    expect(inclusiveRangeToHalfOpen('2026-09-01', '2026-09-30')).toEqual({
      start: '2026-09-01',
      endExclusive: '2026-10-01',
    });
  });
});
