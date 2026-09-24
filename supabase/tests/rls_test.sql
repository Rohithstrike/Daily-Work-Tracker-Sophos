-- =====================================================================
-- Row Level Security tests.
-- Simulates two authenticated users and proves that neither can read or
-- modify the other's data. The script rolls back at the end.
-- =====================================================================
begin;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  day_a uuid;
  visible_rows integer;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (user_a, 'rls-a@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (user_b, 'rls-b@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  insert into public.work_days (user_id, work_date)
  values (user_a, date '2026-09-10') returning id into day_a;

  insert into public.activities (work_day_id, type, priority, quantity)
  values (day_a, 'CASE', 'P1', 2);

  -- Act as user B.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  select count(*) into visible_rows from public.work_days;
  if visible_rows <> 0 then
    raise exception 'FAIL: user B can see % workdays belonging to user A', visible_rows;
  end if;
  raise notice 'PASS: user B cannot read user A workdays';

  select count(*) into visible_rows from public.activities;
  if visible_rows <> 0 then
    raise exception 'FAIL: user B can see % activities belonging to user A', visible_rows;
  end if;
  raise notice 'PASS: user B cannot read user A activities';

  -- An update targeting another user's row must affect zero rows.
  update public.activities set quantity = 99;
  get diagnostics visible_rows = row_count;
  if visible_rows <> 0 then
    raise exception 'FAIL: user B updated % of user A rows', visible_rows;
  end if;
  raise notice 'PASS: user B cannot update user A activities';

  delete from public.work_days;
  get diagnostics visible_rows = row_count;
  if visible_rows <> 0 then
    raise exception 'FAIL: user B deleted % of user A rows', visible_rows;
  end if;
  raise notice 'PASS: user B cannot delete user A workdays';

  -- Back to user A, who must still see their own data.
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  select count(*) into visible_rows from public.work_days;
  if visible_rows <> 1 then
    raise exception 'FAIL: user A sees % of their own workdays, expected 1', visible_rows;
  end if;
  raise notice 'PASS: user A can read their own workday';

  perform set_config('role', 'postgres', true);
  raise notice 'ALL RLS TESTS PASSED';
end
$$;

rollback;
