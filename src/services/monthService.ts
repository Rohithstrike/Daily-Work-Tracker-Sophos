import { supabase } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';
import type { MonthRecord, MonthStatus } from '@/types';

const MONTH_COLUMNS =
  'id,user_id,year,month,status,completed_at,exported_at,created_at,updated_at';

export async function getMonth(
  userId: string,
  year: number,
  month: number,
): Promise<MonthRecord | null> {
  const { data, error } = await supabase
    .from('months')
    .select(MONTH_COLUMNS)
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (error) throw toAppError(error, 'loadHistory');
  return (data as MonthRecord | null) ?? null;
}

export async function listMonths(userId: string): Promise<MonthRecord[]> {
  const { data, error } = await supabase
    .from('months')
    .select(MONTH_COLUMNS)
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) throw toAppError(error, 'loadHistory');
  return (data ?? []) as MonthRecord[];
}

async function upsertMonth(
  userId: string,
  year: number,
  month: number,
  changes: Partial<Pick<MonthRecord, 'status' | 'completed_at' | 'exported_at'>>,
): Promise<MonthRecord> {
  const { data, error } = await supabase
    .from('months')
    .upsert(
      { user_id: userId, year, month, ...changes },
      { onConflict: 'user_id,year,month' },
    )
    .select(MONTH_COLUMNS)
    .single();

  if (error) throw toAppError(error, 'generic');
  return data as MonthRecord;
}

/** Month status is always an explicit user decision; no data is removed. */
export async function markMonthComplete(
  userId: string,
  year: number,
  month: number,
): Promise<MonthRecord> {
  return upsertMonth(userId, year, month, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
}

export async function reopenMonth(
  userId: string,
  year: number,
  month: number,
): Promise<MonthRecord> {
  return upsertMonth(userId, year, month, { status: 'in_progress', completed_at: null });
}

export async function markMonthExported(
  userId: string,
  year: number,
  month: number,
  currentStatus: MonthStatus | undefined,
): Promise<MonthRecord> {
  return upsertMonth(userId, year, month, {
    status: currentStatus === 'in_progress' ? 'in_progress' : 'exported',
    exported_at: new Date().toISOString(),
  });
}
