-- =====================================================================
-- Workday Activity Tracker - Row Level Security
-- Every table is user-owned. Activities and breaks derive ownership from
-- their parent workday. No user may read or write another user's data.
-- =====================================================================

alter table public.profiles   enable row level security;
alter table public.work_days  enable row level security;
alter table public.activities enable row level security;
alter table public.breaks     enable row level security;
alter table public.months     enable row level security;

-- Defence in depth: the anon/authenticated roles get nothing by default.
alter table public.profiles   force row level security;
alter table public.work_days  force row level security;
alter table public.activities force row level security;
alter table public.breaks     force row level security;
alter table public.months     force row level security;

-- ---------------------------------------------------------------- helper
create or replace function public.owns_work_day(target_work_day uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.work_days wd
    where wd.id = target_work_day
      and wd.user_id = auth.uid()
  );
$$;

-- -------------------------------------------------------------- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Profiles are never deleted from the client; removing the auth user cascades.

-- ------------------------------------------------------------- work_days
drop policy if exists work_days_select_own on public.work_days;
create policy work_days_select_own on public.work_days
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists work_days_insert_own on public.work_days;
create policy work_days_insert_own on public.work_days
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists work_days_update_own on public.work_days;
create policy work_days_update_own on public.work_days
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists work_days_delete_own on public.work_days;
create policy work_days_delete_own on public.work_days
  for delete to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------ activities
drop policy if exists activities_select_own on public.activities;
create policy activities_select_own on public.activities
  for select to authenticated
  using (public.owns_work_day(work_day_id));

drop policy if exists activities_insert_own on public.activities;
create policy activities_insert_own on public.activities
  for insert to authenticated
  with check (public.owns_work_day(work_day_id));

drop policy if exists activities_update_own on public.activities;
create policy activities_update_own on public.activities
  for update to authenticated
  using (public.owns_work_day(work_day_id))
  with check (public.owns_work_day(work_day_id));

drop policy if exists activities_delete_own on public.activities;
create policy activities_delete_own on public.activities
  for delete to authenticated
  using (public.owns_work_day(work_day_id));

-- ---------------------------------------------------------------- breaks
drop policy if exists breaks_select_own on public.breaks;
create policy breaks_select_own on public.breaks
  for select to authenticated
  using (public.owns_work_day(work_day_id));

drop policy if exists breaks_insert_own on public.breaks;
create policy breaks_insert_own on public.breaks
  for insert to authenticated
  with check (public.owns_work_day(work_day_id));

drop policy if exists breaks_update_own on public.breaks;
create policy breaks_update_own on public.breaks
  for update to authenticated
  using (public.owns_work_day(work_day_id))
  with check (public.owns_work_day(work_day_id));

drop policy if exists breaks_delete_own on public.breaks;
create policy breaks_delete_own on public.breaks
  for delete to authenticated
  using (public.owns_work_day(work_day_id));

-- ---------------------------------------------------------------- months
drop policy if exists months_select_own on public.months;
create policy months_select_own on public.months
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists months_insert_own on public.months;
create policy months_insert_own on public.months
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists months_update_own on public.months;
create policy months_update_own on public.months
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists months_delete_own on public.months;
create policy months_delete_own on public.months
  for delete to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------- grants
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.work_days, public.activities, public.breaks, public.months
  to authenticated;

-- The anonymous role must never touch application data.
revoke all on public.profiles, public.work_days, public.activities, public.breaks, public.months
  from anon;
