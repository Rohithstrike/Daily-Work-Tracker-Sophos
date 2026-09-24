import { supabase } from '@/lib/supabase';
import { toAppError, AppError } from '@/lib/errors';
import { activityRecordSchema } from '@/lib/schemas';
import { normalisePriority, validateActivityRule } from '@/lib/activityRules';
import { openActivity } from '@/lib/timeline';
import type { Activity, ActivityInput } from '@/types';

const ACTIVITY_COLUMNS =
  'id,work_day_id,type,priority,quantity,started_at,ended_at,duration_seconds,notes,created_at,updated_at';

/** Service-level guard so invalid rows never reach PostgreSQL. */
function validateOrThrow(input: ActivityInput): ActivityInput {
  const priority = normalisePriority(input.type, input.priority);
  const candidate: ActivityInput = { ...input, priority };

  const violations = validateActivityRule(candidate);
  if (violations.length > 0) {
    throw new AppError(violations[0]?.message ?? 'That activity is not valid.');
  }

  const parsed = activityRecordSchema.safeParse({
    type: candidate.type,
    priority: candidate.priority,
    quantity: candidate.quantity,
    started_at: candidate.started_at,
    ended_at: candidate.ended_at,
    notes: candidate.notes,
  });
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'That activity is not valid.');
  }
  return candidate;
}

export async function createActivity(
  workDayId: string,
  input: ActivityInput,
): Promise<Activity> {
  const record = validateOrThrow(input);

  const { data, error } = await supabase
    .from('activities')
    .insert({ work_day_id: workDayId, ...record })
    .select(ACTIVITY_COLUMNS)
    .single();

  if (error) throw toAppError(error, 'saveActivity');
  return data as Activity;
}

export async function updateActivity(
  activityId: string,
  input: ActivityInput,
): Promise<Activity> {
  const record = validateOrThrow(input);

  const { data, error } = await supabase
    .from('activities')
    .update(record)
    .eq('id', activityId)
    .select(ACTIVITY_COLUMNS)
    .single();

  if (error) throw toAppError(error, 'saveActivity');
  return data as Activity;
}

export async function deleteActivity(activityId: string): Promise<void> {
  const { error } = await supabase.from('activities').delete().eq('id', activityId);
  if (error) throw toAppError(error, 'deleteActivity');
}

/** Closes an activity at the given instant. */
export async function closeActivity(activityId: string, endedAt: string): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .update({ ended_at: endedAt })
    .eq('id', activityId)
    .select(ACTIVITY_COLUMNS)
    .single();

  if (error) throw toAppError(error, 'saveActivity');
  return data as Activity;
}

/**
 * Closes the currently running activity, if any, at `boundary`.
 * Called when a new activity starts or when lunch begins, so that the
 * timeline never contains two overlapping open activities.
 */
export async function closeOpenActivity(
  activities: Activity[],
  boundary: string,
): Promise<Activity | null> {
  const running = openActivity(activities);
  if (!running) return null;
  if (boundary < running.started_at) return null;
  return closeActivity(running.id, boundary);
}
