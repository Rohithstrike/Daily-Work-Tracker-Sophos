import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

import {
  endBreak,
  startBreak,
} from '@/services/breakService';

import { openBreak } from '@/lib/timeline';
import {
  summariseDay,
  type DaySummary,
} from '@/lib/summary';
import {
  AppError,
  toAppError,
} from '@/lib/errors';

import { workDateFor } from '@/utils/date';

import type {
  Activity,
  ActivityInput,
  BreakEntry,
  IsoDate,
  WorkDay,
} from '@/types';

/**
 * Refresh the current workday from Supabase every five minutes.
 */
const AUTO_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

interface UseWorkdayResult {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  workDate: IsoDate;
  workDay: WorkDay | null;
  activities: Activity[];
  breaks: BreakEntry[];
  currentBreak: BreakEntry | null;
  onLunch: boolean;
  isCompleted: boolean;
  summary: DaySummary | null;
  lastRefreshedAt: Date | null;
  reload: () => Promise<void>;
  addActivity: (input: ActivityInput) => Promise<void>;
  editActivity: (
    activityId: string,
    input: ActivityInput,
  ) => Promise<void>;
  removeActivity: (activityId: string) => Promise<void>;
  beginLunch: () => Promise<void>;
  resumeWork: () => Promise<void>;
  finishDay: () => Promise<void>;
  reopenDay: () => Promise<void>;
}

/**
 * Orchestrates today's workday.
 *
 * Responsibilities:
 * - Determines today's date using the user's configured timezone.
 * - Loads or creates today's workday.
 * - Loads activities and breaks from Supabase.
 * - Automatically refreshes data every five minutes.
 * - Silently refreshes when the browser tab becomes active again.
 * - Exposes activity, break and workday actions to the Today page.
 *
 * Supabase remains the permanent source of truth.
 */
export function useWorkday(now: Date): UseWorkdayResult {
  const { user, timezone } = useAuth();

  const [workDay, setWorkDay] = useState<WorkDay | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [breaks, setBreaks] = useState<BreakEntry[]>([]);

  /**
   * `loading` is used only for the initial or explicit full reload.
   *
   * Automatic five-minute refreshes use `refreshing` so the page does not
   * disappear or show the full loading screen every five minutes.
   */
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] =
    useState<Date | null>(null);

  /**
   * Prevent duplicate loading of the same user and local work date.
   */
  const loadedKey = useRef<string | null>(null);

  /**
   * Prevent two automatic refresh requests from running simultaneously.
   */
  const refreshInProgress = useRef(false);

  /**
   * Used to avoid updating React state after the component unmounts.
   */
  const mountedRef = useRef(true);

  /**
   * Calculate the date using the user's configured timezone.
   *
   * This allows the page to move to a new workday at local midnight even
   * when the browser remains open.
   */
  const workDate = useMemo(
    () => workDateFor(timezone, now),
    [timezone, now],
  );

  /**
   * Track component mount state.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Loads or creates a workday.
   *
   * Used for:
   * - Initial page load
   * - Date rollover
   * - Explicit user reload
   *
   * This is a full load and may display the loading state.
   */
  const load = useCallback(
    async (
      userId: string,
      date: IsoDate,
      showLoading = true,
    ) => {
      if (showLoading && mountedRef.current) {
        setLoading(true);
      }

      if (mountedRef.current) {
        setError(null);
      }

      try {
        const day = await getOrCreateWorkDay(userId, date);
        const detail = await loadWorkDayDetail(day);

        if (!mountedRef.current) {
          return;
        }

        setWorkDay(detail.workDay);
        setActivities(detail.activities);
        setBreaks(detail.breaks);
        setLastRefreshedAt(new Date());

        loadedKey.current = `${userId}:${date}`;
      } catch (caught) {
        if (!mountedRef.current) {
          return;
        }

        setError(
          toAppError(
            caught,
            'loadWorkspace',
          ).userMessage,
        );
      } finally {
        if (showLoading && mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  /**
   * Initial load and date rollover.
   *
   * If the configured local date changes while the browser stays open,
   * this loads or creates the new date's workday.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    const key = `${user.id}:${workDate}`;

    if (loadedKey.current === key) {
      return;
    }

    void load(user.id, workDate, true);
  }, [user, workDate, load]);

  /**
   * Reload activities and breaks for the currently loaded workday.
   *
   * This is used immediately after add, edit, delete, lunch and resume
   * operations.
   */
  const refreshChildren = useCallback(
    async (dayId: string) => {
      const [
        nextActivities,
        nextBreaks,
      ] = await Promise.all([
        listActivities(dayId),
        listBreaks(dayId),
      ]);

      if (!mountedRef.current) {
        return;
      }

      setActivities(nextActivities);
      setBreaks(nextBreaks);
      setLastRefreshedAt(new Date());
    },
    [],
  );

  /**
   * Silent refresh used by the five-minute timer.
   *
   * It does not:
   * - Set the main loading state
   * - Clear the existing page
   * - Refresh the entire browser
   * - Close open dialogs
   *
   * It skips the refresh when the browser reports that it is offline.
   */
  const refreshSilently = useCallback(async () => {
    if (!user || refreshInProgress.current) {
      return;
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.onLine === false
    ) {
      return;
    }

    refreshInProgress.current = true;

    if (mountedRef.current) {
      setRefreshing(true);
    }

    try {
      const date = workDateFor(
        timezone,
        new Date(),
      );

      /**
       * If the local date has changed, perform a complete load for the new
       * date. This keeps each day's records isolated.
       */
      if (date !== workDate) {
        loadedKey.current = null;
        await load(user.id, date, false);
        return;
      }

      const day = await getOrCreateWorkDay(
        user.id,
        date,
      );

      const detail = await loadWorkDayDetail(day);

      if (!mountedRef.current) {
        return;
      }

      setWorkDay(detail.workDay);
      setActivities(detail.activities);
      setBreaks(detail.breaks);
      setLastRefreshedAt(new Date());

      loadedKey.current = `${user.id}:${date}`;

      /**
       * A successful background refresh clears an earlier temporary
       * connection or loading error.
       */
      setError(null);
    } catch (caught) {
      /**
       * Keep the existing screen and records visible if a five-minute
       * background refresh fails.
       *
       * The technical error is logged without replacing the entire page
       * with an error state.
       */
      console.error(
        '[workday-auto-refresh]',
        caught,
      );
    } finally {
      refreshInProgress.current = false;

      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [
    user,
    timezone,
    workDate,
    load,
  ]);

  /**
   * Refresh automatically every five minutes.
   *
   * The interval is removed automatically when:
   * - The component unmounts
   * - The user signs out
   * - A dependency changes
   */
  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void refreshSilently();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, refreshSilently]);

  /**
   * Refresh when the user returns to this browser tab.
   *
   * Browsers may slow down background intervals. Refreshing on tab return
   * ensures the user sees the latest Supabase data immediately.
   */
  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshSilently();
      }
    };

    const handleWindowFocus = () => {
      void refreshSilently();
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    window.addEventListener(
      'focus',
      handleWindowFocus,
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      window.removeEventListener(
        'focus',
        handleWindowFocus,
      );
    };
  }, [user, refreshSilently]);

  /**
   * Explicit full reload exposed to the Today page.
   */
  const reload = useCallback(async () => {
    if (!user) {
      return;
    }

    loadedKey.current = null;

    await load(
      user.id,
      workDate,
      true,
    );
  }, [
    user,
    workDate,
    load,
  ]);

  /**
   * Ensures that the current workday exists and can still be edited.
   */
  const requireEditableDay =
    useCallback((): WorkDay => {
      if (!workDay) {
        throw new AppError(
          'The workday is still loading. Please wait a moment.',
        );
      }

      if (workDay.status === 'completed') {
        throw new AppError(
          'This day is completed. Reopen it before making changes.',
        );
      }

      return workDay;
    }, [workDay]);

  /**
   * Add a new activity.
   *
   * A previous open activity is closed at the new activity's start time
   * where appropriate.
   */
  const addActivity = useCallback(
    async (input: ActivityInput) => {
      const day = requireEditableDay();

      await closeOpenActivity(
        activities,
        input.started_at,
      );

      await createActivity(
        day.id,
        input,
      );

      await refreshChildren(day.id);
    },
    [
      activities,
      refreshChildren,
      requireEditableDay,
    ],
  );

  /**
   * Edit an existing activity.
   */
  const editActivity = useCallback(
    async (
      activityId: string,
      input: ActivityInput,
    ) => {
      const day = requireEditableDay();

      await updateActivityRecord(
        activityId,
        input,
      );

      await refreshChildren(day.id);
    },
    [
      refreshChildren,
      requireEditableDay,
    ],
  );

  /**
   * Delete an existing activity.
   */
  const removeActivity = useCallback(
    async (activityId: string) => {
      const day = requireEditableDay();

      await deleteActivityRecord(activityId);

      await refreshChildren(day.id);
    },
    [
      refreshChildren,
      requireEditableDay,
    ],
  );

  /**
   * Start lunch.
   *
   * An open activity is closed before the lunch break begins.
   */
  const beginLunch = useCallback(async () => {
    const day = requireEditableDay();
    const startedAt = new Date().toISOString();

    await closeOpenActivity(
      activities,
      startedAt,
    );

    await startBreak(
      day.id,
      breaks,
      'LUNCH',
      startedAt,
    );

    await refreshChildren(day.id);
  }, [
    activities,
    breaks,
    refreshChildren,
    requireEditableDay,
  ]);

  /**
   * End the currently open lunch break.
   */
  const resumeWork = useCallback(async () => {
    const day = requireEditableDay();
    const running = openBreak(breaks);

    if (!running) {
      throw new AppError(
        'No break is currently running.',
      );
    }

    await endBreak(running.id);
    await refreshChildren(day.id);
  }, [
    breaks,
    refreshChildren,
    requireEditableDay,
  ]);

  /**
   * Finish and lock the current workday.
   */
  const finishDay = useCallback(async () => {
    const day = requireEditableDay();

    const updated = await finishWorkDay(day.id);

    if (mountedRef.current) {
      setWorkDay(updated);
      setLastRefreshedAt(new Date());
    }

    await refreshChildren(day.id);
  }, [
    refreshChildren,
    requireEditableDay,
  ]);

  /**
   * Reopen a completed workday without removing data.
   */
  const reopenDay = useCallback(async () => {
    if (!workDay) {
      return;
    }

    const updated = await reopenWorkDay(
      workDay.id,
    );

    if (mountedRef.current) {
      setWorkDay(updated);
      setLastRefreshedAt(new Date());
    }

    await refreshChildren(workDay.id);
  }, [
    workDay,
    refreshChildren,
  ]);

  /**
   * Current open lunch break, if one exists.
   */
  const currentBreak = useMemo(
    () => openBreak(breaks),
    [breaks],
  );

  /**
   * Live daily summary.
   *
   * The `now` value updates the displayed working and lunch durations
   * without sending a database request every second.
   */
  const summary = useMemo(
    () =>
      workDay
        ? summariseDay(
            {
              workDay,
              activities,
              breaks,
            },
            now,
          )
        : null,
    [
      workDay,
      activities,
      breaks,
      now,
    ],
  );

  return {
    loading,
    refreshing,
    error,
    workDate,
    workDay,
    activities,
    breaks,
    currentBreak,
    onLunch: currentBreak !== null,
    isCompleted:
      workDay?.status === 'completed',
    summary,
    lastRefreshedAt,
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