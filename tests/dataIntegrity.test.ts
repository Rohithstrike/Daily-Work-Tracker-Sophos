import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openBreak, openActivity } from '../src/lib/timeline';
import { sanitiseFilename, monthlyReportFilename, rangeReportFilename } from '../src/utils/filename';
import { workDateFor, zonedTimeToUtcIso, utcIsoToZonedHHmm } from '../src/utils/date';
import type { BreakEntry } from '../src/types';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const schemaSql = readFileSync(join(migrationsDir, '0001_initial_schema.sql'), 'utf8');
const rlsSql = readFileSync(join(migrationsDir, '0002_row_level_security.sql'), 'utf8');
const normalise = (sql: string) => sql.replace(/\s+/g, ' ');
const schemaFlat = normalise(schemaSql);
const rlsFlat = normalise(rlsSql);

/**
 * Tests 22-24 are enforced in PostgreSQL. The executable checks live in
 * supabase/tests/constraints_test.sql and supabase/tests/rls_test.sql; these
 * assertions guarantee the guarantees are present in the committed migrations
 * so they can never be dropped silently.
 */
describe('database guarantees', () => {
  it('22. allows only one workday per user and date', () => {
    expect(schemaSql).toContain('constraint work_days_unique_per_user_date unique (user_id, work_date)');
  });

  it('23. isolates each user behind row level security', () => {
    for (const table of ['profiles', 'work_days', 'activities', 'breaks', 'months']) {
      expect(rlsFlat).toContain(`alter table public.${table} enable row level security`);
      expect(rlsFlat).toContain(`alter table public.${table} force row level security`);
    }
    expect(rlsFlat).toContain('using (user_id = auth.uid())');
    expect(rlsSql).toContain('public.owns_work_day(work_day_id)');
    expect(rlsFlat).toContain(
      'revoke all on public.profiles, public.work_days, public.activities, public.breaks, public.months from anon',
    );
  });

  it('24. rejects record changes on a completed day', () => {
    expect(schemaSql).toContain('guard_completed_work_day');
    expect(schemaSql).toContain('This day is completed. Reopen the day before making changes.');
    expect(schemaSql).toContain('activities_guard_completed_day');
    expect(schemaSql).toContain('breaks_guard_completed_day');
  });

  it('mirrors the central priority rules as a check constraint', () => {
    expect(schemaFlat).toContain(
      "(type in ('CASE', 'AR', 'DUPE', 'PEER_REVIEW') and priority is not null)",
    );
    expect(schemaFlat).toContain(
      "(type in ('IR', 'MISC_HELP', 'THREAT_HUNT') and priority is null)",
    );
    expect(schemaFlat).toContain('constraint activities_quantity_range check (quantity >= 1 and quantity <= 999)');
  });

  it('creates the required indexes and no service-role key is referenced', () => {
    for (const index of [
      'work_days_user_date_idx',
      'activities_work_day_idx',
      'activities_work_day_started_idx',
      'breaks_work_day_idx',
      'months_user_year_month_idx',
      'breaks_one_open_per_work_day',
    ]) {
      expect(schemaSql).toContain(index);
    }
    const clientSource = readFileSync(join(process.cwd(), 'src', 'lib', 'supabase.ts'), 'utf8');
    expect(clientSource).toContain('VITE_SUPABASE_ANON_KEY');
    expect(clientSource).not.toContain('SERVICE_ROLE_KEY');
  });
});

describe('open entry detection', () => {
  const closed: BreakEntry = {
    id: 'b1',
    work_day_id: 'd1',
    type: 'LUNCH',
    started_at: '2026-09-24T07:00:00.000Z',
    ended_at: '2026-09-24T07:45:00.000Z',
    duration_seconds: 2700,
    created_at: '2026-09-24T07:00:00.000Z',
  };
  const open: BreakEntry = { ...closed, id: 'b2', started_at: '2026-09-24T12:00:00.000Z', ended_at: null, duration_seconds: null };

  it('finds the single open break', () => {
    expect(openBreak([closed])).toBeNull();
    expect(openBreak([closed, open])?.id).toBe('b2');
  });

  it('returns null when no activity is running', () => {
    expect(openActivity([])).toBeNull();
  });
});

describe('export filenames', () => {
  it('names monthly exports with the configured prefix', () => {
    expect(monthlyReportFilename('OC', 'September', 2026)).toBe('OC September 2026.xlsx');
  });

  it('names custom range exports', () => {
    expect(rangeReportFilename('OC', '2026-09-01', '2026-09-30')).toBe('OC 2026-09-01 - 2026-09-30.xlsx');
  });

  it('sanitises invalid filesystem characters', () => {
    expect(sanitiseFilename('OC/September:2026?*')).toBe('OC September 2026');
    expect(sanitiseFilename('   ')).toBe('report');
  });
});

describe('timezone handling', () => {
  it('derives the work date from the user timezone, not the browser', () => {
    // 18:40 UTC on 23 September is already 24 September in Kolkata.
    const instant = new Date('2026-09-23T18:40:00.000Z');
    expect(workDateFor('Asia/Kolkata', instant)).toBe('2026-09-24');
    expect(workDateFor('UTC', instant)).toBe('2026-09-23');
    expect(workDateFor('America/New_York', instant)).toBe('2026-09-23');
  });

  it('round-trips local wall-clock times through UTC', () => {
    const utc = zonedTimeToUtcIso('2026-09-24', '16:45', 'Asia/Kolkata');
    expect(utc).toBe('2026-09-24T11:15:00.000Z');
    expect(utcIsoToZonedHHmm(utc, 'Asia/Kolkata')).toBe('16:45');
  });
});
