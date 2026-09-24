import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  finishWorkDay,
  getOrCreateWorkDay,
  listActivities,
  listBreaks,
  loadWorkDayDetail,
  reopenWorkDay,
} from '@/services/workdayService';
import {
  closeOpenActivity,
  createActivity,
  deleteActivity as deleteActivityRecord,
  updateActivity as updateActivityRecord,
} from '@/services/activityService';
import { endBreak, startBreak } from '@/services/breakService';
import { openBreak } from '@/lib/timeline';
import { summariseDay, type DaySummary } from '@/lib/summary';
import { AppError, toAppError } from '@/lib/errors';
import { workDateFor } from '@/utils/date';
import type { Activity, ActivityInput, BreakEntry, IsoDate, WorkDay } from '@/types';

interface UseWorkdayResult {
  loading: boolean;
  error: string | null;
  workDate: IsoDate;
  workDay: WorkDay | null;
  activities: Activity[];
  breaks: BreakEntry[];
  currentBreak: BreakEntry | null;
  onLunch: boolean;
  isCompleted: boolean;
  summary: DaySummary | null;
  reload: () => Promise<void>;
  addActivity: (input: ActivityInput) => Promise<void>;
  editActivity: (activityId: string, input: ActivityInput) => Promise<void>;
  removeActivity: (activityId: string) => Promise<void>;
  beginLunch: () => Promise<void>;
  resumeWork: () => Promise<void>;
  finishDay: () => Promise<void>;
  reopenDay: () => Promise<void>;
}

/**
 * Orchestrates today's workday: it resolves the local work date from the
 * user's timezone, loads or creates the workday and exposes the mutations the
 * Today page needs. The database always remains the source of truth.
 */
export function useWorkday(now: Date): UseWorkdayResult {
  const { user, timezone } = useAuth();
  const [workDay, setWorkDay] = useState<WorkDay | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [breaks, setBreaks] = useState<BreakEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derived once per render from the user's configured timezone, so the app
  // rolls over to a fresh workday at local midnight - never a browser date.
  const workDate = useMemo(() => workDateFor(timezone, now), [timezone, now]);
  const loadedKey = useRef<string | null>(null);

  const load = useCallback(
    async (userId: string, date: IsoDate) => {
      setLoading(true);
      setError(null);
      try {
        const day = await getOrCreateWorkDay(userId, date);
        const detail = await loadWorkDayDetail(day);
        setWorkDay(detail.workDay);
        setActivities(detail.activities);
        setBreaks(detail.breaks);
        loadedKey.current = `${userId}:${date}`;
      } catch (caught) {
        setError(toAppError(caught, 'loadWorkspace').userMessage);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!user) return;
    const key = `${user.id}:${workDate}`;
    if (loadedKey.current === key) return;
    void load(user.id, workDate);
  }, [user, workDate, load]);

  const refreshChildren = useCallback(async (dayId: string) => {
    const [nextActivities, nextBreaks] = await Promise.all([
      listActivities(dayId),
      listBreaks(dayId),
    ]);
    setActivities(nextActivities);
    setBreaks(nextBreaks);
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    loadedKey.current = null;
    await load(user.id, workDate);
  }, [user, workDate, load]);

  const requireEditableDay = useCallback((): WorkDay => {
    if (!workDay) throw new AppError('The workday is still loading. Please wait a moment.');
    if (workDay.status === 'completed') {
      throw new AppError('This day is completed. Reopen it before making changes.');
    }
    return workDay;
  }, [workDay]);

  const addActivity = useCallback(
    async (input: ActivityInput) => {
      const day = requireEditableDay();
      // A new activity closes the previous open one at the new start time.
      await closeOpenActivity(activities, input.started_at);
      await createActivity(day.id, input);
      await refreshChildren(day.id);
    },
    [activities, refreshChildren, requireEditableDay],
  );

  const editActivity = useCallback(
    async (activityId: string, input: ActivityInput) => {
      const day = requireEditableDay();
      await updateActivityRecord(activityId, input);
      await refreshChildren(day.id);
    },
    [refreshChildren, requireEditableDay],
  );

  const removeActivity = useCallback(
    async (activityId: string) => {
      const day = requireEditableDay();
      await deleteActivityRecord(activityId);
      await refreshChildren(day.id);
    },
    [refreshChildren, requireEditableDay],
  );

  const beginLunch = useCallback(async () => {
    const day = requireEditableDay();
    const startedAt = new Date().toISOString();
    await closeOpenActivity(activities, startedAt);
    await startBreak(day.id, breaks, 'LUNCH', startedAt);
    await refreshChildren(day.id);
  }, [activities, breaks, refreshChildren, requireEditableDay]);

  const resumeWork = useCallback(async () => {
    const day = requireEditableDay();
    const running = openBreak(breaks);
    if (!running) throw new AppError('No break is currently running.');
    await endBreak(running.id);
    await refreshChildren(day.id);
  }, [breaks, refreshChildren, requireEditableDay]);

  const finishDay = useCallback(async () => {
    const day = requireEditableDay();
    const updated = await finishWorkDay(day.id);
    setWorkDay(updated);
    await refreshChildren(day.id);
  }, [refreshChildren, requireEditableDay]);

  const reopenDay = useCallback(async () => {
    if (!workDay) return;
    const updated = await reopenWorkDay(workDay.id);
    setWorkDay(updated);
    await refreshChildren(workDay.id);
  }, [workDay, refreshChildren]);

  const currentBreak = useMemo(() => openBreak(breaks), [breaks]);

  const summary = useMemo(
    () => (workDay ? summariseDay({ workDay, activities, breaks }, now) : null),
    [workDay, activities, breaks, now],
  );

  return {
    loading,
    error,
    workDate,
    workDay,
    activities,
    breaks,
    currentBreak,
    onLunch: currentBreak !== null,
    isCompleted: workDay?.status === 'completed',
    summary,
    reload,
    addActivity,
    editActivity,
    removeActivity,
    beginLunch,
    resumeWork,
    finishDay,
    reopenDay,
  };
}
