import { supabase, DEFAULT_REPORT_PREFIX } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';
import { detectBrowserTimezone } from '@/utils/date';
import type { Profile } from '@/types';

/** Reads the signed-in user's profile, or null when it does not exist yet. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw toAppError(error, 'loadWorkspace');
  return (data as Profile | null) ?? null;
}

/**
 * Guarantees a profile row exists. The database trigger normally creates it on
 * sign-up; this is a safe client-side fallback for pre-existing auth users.
 */
export async function ensureProfile(
  userId: string,
  email: string,
  name?: string | null,
): Promise<Profile> {
  const existing = await getProfile(userId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        name: name ?? email.split('@')[0] ?? null,
        timezone: detectBrowserTimezone(),
        report_prefix: DEFAULT_REPORT_PREFIX,
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single();

  if (error) throw toAppError(error, 'loadWorkspace');
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  changes: Partial<Pick<Profile, 'name' | 'timezone' | 'week_starts_on' | 'report_prefix' | 'theme'>>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(changes)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw toAppError(error, 'saveSettings');
  return data as Profile;
}
