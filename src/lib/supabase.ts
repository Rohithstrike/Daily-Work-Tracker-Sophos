import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client.
 *
 * Only the public project URL and the anon/publishable key are used here.
 * Data isolation is enforced by Row Level Security in PostgreSQL - never by
 * the client. A service-role key must never reach this bundle.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (import.meta.env.DEV && anonKey && /^sb_secret_|service_role/.test(anonKey)) {
  throw new Error(
    'A secret Supabase key was found in VITE_SUPABASE_ANON_KEY. Use the anon or publishable key only.',
  );
}

export const supabase: SupabaseClient = createClient(url ?? 'http://localhost', anonKey ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'wat.auth',
  },
  global: {
    headers: { 'x-application-name': 'workday-activity-tracker' },
  },
});

export const DEFAULT_REPORT_PREFIX = import.meta.env.VITE_DEFAULT_REPORT_PREFIX || 'OC';
