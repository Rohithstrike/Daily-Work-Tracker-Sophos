/**
 * Workday feature surface: loading, creating, finishing and reopening a day,
 * plus the pure summary helpers used by Today, History, Dashboard and Reports.
 */
export { useWorkday } from '@/hooks/useWorkday';
export {
  getWorkDay,
  getOrCreateWorkDay,
  loadWorkDayDetail,
  loadRangeDetails,
  finishWorkDay,
  reopenWorkDay,
  assertDayEditable,
} from '@/services/workdayService';
export { summariseDay, summarisePeriod, workSecondsFor, totalBreakSeconds } from '@/lib/summary';
export { buildTimeline, buildTimelineForDay, openActivity, openBreak } from '@/lib/timeline';
