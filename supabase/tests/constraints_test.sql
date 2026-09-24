-- =====================================================================
-- Database constraint tests.
-- Run in the Supabase SQL editor. The whole script rolls back, so it is
-- safe against a live project. Every statement should print "PASS".
-- =====================================================================
begin;

do $$
declare
  test_user uuid := gen_random_uuid();
  day_id uuid;
  failed boolean;
begin
  -- A profile row normally arrives via the auth trigger; insert directly for
  -- the purposes of this test (constraint tests only, RLS is tested separately).
  insert into auth.users (id, email, instance_id, aud, role)
  values (test_user, 'constraint-test@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  insert into public.work_days (user_id, work_date)
  values (test_user, date '2026-09-01')
  returning id into day_id;

  ---------------------------------------------------------------- valid rows
  insert into public.activities (work_day_id, type, priority, quantity)
  values (day_id, 'CASE', 'P1', 3);
  raise notice 'PASS: CASE with P1 accepted';

  insert into public.activities (work_day_id, type, priority, quantity)
  values (day_id, 'CASE', 'P4', 1);
  raise notice 'PASS: CASE with P4 accepted';

  insert into public.activities (work_day_id, type, priority, quantity)
  values (day_id, 'AR', 'P2', 4);
  raise notice 'PASS: AR with P2 accepted';

  insert into public.activities (work_day_id, type, priority, quantity)
  values (day_id, 'DUPE', 'P3', 2);
  raise notice 'PASS: DUPE with P3 accepted';

  insert into public.activities (work_day_id, type, priority, quantity)
  values (day_id, 'PEER_REVIEW', 'P2', 1);
  raise notice 'PASS: PEER_REVIEW with P2 accepted';

  insert into public.activities (work_day_id, type, priority, quantity)
  values (day_id, 'IR', null, 1);
  raise notice 'PASS: IR without priority accepted';

  insert into public.activities (work_day_id, type, priority, quantity)
  values (day_id, 'MISC_HELP', null, 1);
  raise notice 'PASS: MISC_HELP without priority accepted';

  insert into public.activities (work_day_id, type, priority, quantity)
  values (day_id, 'THREAT_HUNT', null, 2);
  raise notice 'PASS: THREAT_HUNT without priority accepted';

  -------------------------------------------------------------- invalid rows
  failed := false;
  begin
    insert into public.activities (work_day_id, type, priority, quantity)
    values (day_id, 'CASE', null, 1);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: CASE with NULL priority was accepted'; end if;
  raise notice 'PASS: CASE with NULL priority rejected';

  failed := false;
  begin
    insert into public.activities (work_day_id, type, priority, quantity)
    values (day_id, 'IR', 'P1', 1);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: IR with P1 was accepted'; end if;
  raise notice 'PASS: IR with P1 rejected';

  failed := false;
  begin
    insert into public.activities (work_day_id, type, priority, quantity)
    values (day_id, 'MISC_HELP', 'P2', 1);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: MISC_HELP with P2 was accepted'; end if;
  raise notice 'PASS: MISC_HELP with P2 rejected';

  failed := false;
  begin
    insert into public.activities (work_day_id, type, priority, quantity)
    values (day_id, 'THREAT_HUNT', 'P1', 1);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: THREAT_HUNT with P1 was accepted'; end if;
  raise notice 'PASS: THREAT_HUNT with P1 rejected';

  failed := false;
  begin
    insert into public.activities (work_day_id, type, priority, quantity)
    values (day_id, 'IR', null, 0);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: quantity 0 was accepted'; end if;
  raise notice 'PASS: quantity below 1 rejected';

  --------------------------------------------------------- duration trigger
  declare
    lunch_seconds integer;
  begin
    insert into public.breaks (work_day_id, type, started_at, ended_at)
    values (day_id, 'LUNCH', timestamptz '2026-09-01 13:05:00+00', timestamptz '2026-09-01 14:16:00+00')
    returning duration_seconds into lunch_seconds;
    if lunch_seconds <> 4260 then
      raise exception 'FAIL: lunch duration was % seconds, expected 4260', lunch_seconds;
    end if;
    raise notice 'PASS: lunch over one hour stored as 4260 seconds (1h 11m)';
  end;

  ------------------------------------------------------ one open break only
  failed := false;
  begin
    insert into public.breaks (work_day_id, type, started_at) values (day_id, 'LUNCH', now());
    insert into public.breaks (work_day_id, type, started_at) values (day_id, 'LUNCH', now());
  exception when unique_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: two open breaks were accepted'; end if;
  raise notice 'PASS: only one open break allowed per workday';

  ------------------------------------------------- one workday per user/date
  failed := false;
  begin
    insert into public.work_days (user_id, work_date) values (test_user, date '2026-09-01');
  exception when unique_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: duplicate workday was accepted'; end if;
  raise notice 'PASS: only one workday per user per date';

  ------------------------------------------------ completed day rejects edits
  update public.breaks set ended_at = now() where work_day_id = day_id and ended_at is null;
  update public.work_days set status = 'completed', finished_at = now() where id = day_id;

  failed := false;
  begin
    insert into public.activities (work_day_id, type, priority, quantity)
    values (day_id, 'CASE', 'P1', 1);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: completed day accepted a new activity'; end if;
  raise notice 'PASS: completed day rejects normal record changes';

  --------------------------------------------- month uniqueness per user/year
  insert into public.months (user_id, year, month) values (test_user, 2026, 9);
  failed := false;
  begin
    insert into public.months (user_id, year, month) values (test_user, 2026, 9);
  exception when unique_violation then failed := true;
  end;
  if not failed then raise exception 'FAIL: duplicate month record was accepted'; end if;
  raise notice 'PASS: only one month record per user/year/month';

  raise notice 'ALL CONSTRAINT TESTS PASSED';
end
$$;

rollback;
