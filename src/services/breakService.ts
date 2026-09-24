import { supabase } from '@/lib/supabase';
import { toAppError, AppError } from '@/lib/errors';
import { openBreak } from '@/lib/timeline';
import type { BreakEntry, BreakType } from '@/types';

const BREAK_COLUMNS = 'id,work_day_id,type,started_at,ended_at,duration_seconds,created_at';

/**
 * Starts a break. A partial unique index in PostgreSQL guarantees that only
 * one open break can exist per workday; this check gives a friendly message
 * before we ever hit that constraint.
 */
export async function startBreak(
  workDayId: string,
  existingBreaks: BreakEntry[],
  type: BreakType = 'LUNCH',
  startedAt: string = new Date().toISOString(),
): Promise<BreakEntry> {
  if (openBreak(existingBreaks)) {
    throw new AppError('A break is already in progress.');
  }

  const { data, error } = await supabase
    .from('breaks')
    .insert({ work_day_id: workDayId, type, started_at: startedAt })
    .select(BREAK_COLUMNS)
    .single();

  if (error) throw toAppError(error, 'startLunch');
  return data as BreakEntry;
}

/**
 * Ends the open break. The actual duration is stored - there is no maximum,
 * so a 1h 11m lunch is recorded exactly as 4260 seconds.
 */
export async function endBreak(
  breakId: string,
  endedAt: string = new Date().toISOString(),
): Promise<BreakEntry> {
  const { data, error } = await supabase
    .from('breaks')
    .update({ ended_at: endedAt })
    .eq('id', breakId)
    .select(BREAK_COLUMNS)
    .single();

  if (error) throw toAppError(error, 'endLunch');
  return data as BreakEntry;
}

export async function deleteBreak(breakId: string): Promise<void> {
  const { error } = await supabase.from('breaks').delete().eq('id', breakId);
  if (error) throw toAppError(error, 'generic');
}
