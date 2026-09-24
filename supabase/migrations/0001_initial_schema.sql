-- =====================================================================
-- Workday Activity Tracker - initial schema
-- Tables, enums, constraints, triggers and indexes.
-- Row Level Security lives in 0002_row_level_security.sql.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_type') then
    create type public.activity_type as enum (
      'CASE', 'AR', 'DUPE', 'IR', 'PEER_REVIEW', 'MISC_HELP', 'THREAT_HUNT'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_priority') then
    create type public.activity_priority as enum ('P1', 'P2', 'P3', 'P4');
  end if;

  if not exists (select 1 from pg_type where typname = 'work_day_status') then
    create type public.work_day_status as enum ('active', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'break_type') then
    create type public.break_type as enum ('LUNCH');
  end if;

  if not exists (select 1 from pg_type where typname = 'month_status') then
    create type public.month_status as enum ('in_progress', 'completed', 'exported');
  end if;

  if not exists (select 1 from pg_type where typname = 'theme_preference') then
    create type public.theme_preference as enum ('light', 'dark', 'system');
  end if;
end
$$;

-- -------------------------------------------------------- shared functions
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  name           text,
  email          text not null,
  timezone       text not null default 'UTC',
  week_starts_on smallint not null default 1
                 check (week_starts_on between 0 and 6),
  report_prefix  text not null default 'OC'
                 check (char_length(report_prefix) between 1 and 20),
  theme          public.theme_preference not null default 'system',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is 'One row per authenticated user. Never store customer or case data here.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------- work_days
create table if not exists public.work_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  work_date   date not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      public.work_day_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint work_days_unique_per_user_date unique (user_id, work_date),
  constraint work_days_finished_after_started
    check (finished_at is null or finished_at >= started_at),
  constraint work_days_completed_has_finished_at
    check (status <> 'completed' or finished_at is not null)
);

drop trigger if exists work_days_set_updated_at on public.work_days;
create trigger work_days_set_updated_at
  before update on public.work_days
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- activities
create table if not exists public.activities (
  id               uuid primary key default gen_random_uuid(),
  work_day_id      uuid not null references public.work_days (id) on delete cascade,
  type             public.activity_type not null,
  priority         public.activity_priority,
  quantity         integer not null default 1,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Mirrors ACTIVITY_RULES in src/lib/activityRules.ts.
  constraint activities_priority_matches_type check (
    (type in ('CASE', 'AR', 'DUPE', 'PEER_REVIEW') and priority is not null)
    or
    (type in ('IR', 'MISC_HELP', 'THREAT_HUNT') and priority is null)
  ),
  constraint activities_quantity_range check (quantity >= 1 and quantity <= 999),
  constraint activities_notes_length check (notes is null or char_length(notes) <= 500),
  constraint activities_ended_after_started
    check (ended_at is null or ended_at >= started_at),
  constraint activities_duration_non_negative
    check (duration_seconds is null or duration_seconds >= 0)
);

comment on constraint activities_priority_matches_type on public.activities is
  'CASE/AR/DUPE/PEER_REVIEW require P1-P4; IR/MISC_HELP/THREAT_HUNT must be NULL.';

-- -------------------------------------------------------------- breaks
create table if not exists public.breaks (
  id               uuid primary key default gen_random_uuid(),
  work_day_id      uuid not null references public.work_days (id) on delete cascade,
  type             public.break_type not null default 'LUNCH',
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer,
  created_at       timestamptz not null default now(),
  constraint breaks_ended_after_started
    check (ended_at is null or ended_at >= started_at),
  constraint breaks_duration_non_negative
    check (duration_seconds is null or duration_seconds >= 0)
);

-- At most one open break per workday.
create unique index if not exists breaks_one_open_per_work_day
  on public.breaks (work_day_id)
  where ended_at is null;

-- --------------------------------------------------------------- months
create table if not exists public.months (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  year         smallint not null check (year between 2000 and 2100),
  month        smallint not null check (month between 1 and 12),
  status       public.month_status not null default 'in_progress',
  completed_at timestamptz,
  exported_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint months_unique_per_user unique (user_id, year, month)
);

comment on table public.months is
  'Month status is always explicit. A month never completes because the calendar month ended.';

drop trigger if exists months_set_updated_at on public.months;
create trigger months_set_updated_at
  before update on public.months
  for each row execute function public.set_updated_at();

-- ------------------------------------------------- duration calculation
create or replace function public.calculate_duration_seconds()
returns trigger
language plpgsql
as $$
begin
  if new.ended_at is not null then
    new.duration_seconds := greatest(0, extract(epoch from (new.ended_at - new.started_at))::int);
  else
    new.duration_seconds := null;
  end if;
  return new;
end;
$$;

drop trigger if exists activities_calculate_duration on public.activities;
create trigger activities_calculate_duration
  before insert or update of started_at, ended_at on public.activities
  for each row execute function public.calculate_duration_seconds();

drop trigger if exists breaks_calculate_duration on public.breaks;
create trigger breaks_calculate_duration
  before insert or update of started_at, ended_at on public.breaks
  for each row execute function public.calculate_duration_seconds();

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ------------------------------------- lock records on a completed workday
create or replace function public.guard_completed_work_day()
returns trigger
language plpgsql
as $$
declare
  target_work_day uuid;
  day_status public.work_day_status;
begin
  target_work_day := coalesce(new.work_day_id, old.work_day_id);

  select status into day_status
  from public.work_days
  where id = target_work_day;

  if day_status = 'completed' then
    raise exception 'This day is completed. Reopen the day before making changes.'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists activities_guard_completed_day on public.activities;
create trigger activities_guard_completed_day
  before insert or update or delete on public.activities
  for each row execute function public.guard_completed_work_day();

drop trigger if exists breaks_guard_completed_day on public.breaks;
create trigger breaks_guard_completed_day
  before insert or update or delete on public.breaks
  for each row execute function public.guard_completed_work_day();

-- ---------------------- close any open break/activity when a day finishes
create or replace function public.close_open_entries_on_finish()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    update public.activities
      set ended_at = coalesce(ended_at, new.finished_at)
      where work_day_id = new.id and ended_at is null;

    update public.breaks
      set ended_at = coalesce(ended_at, new.finished_at)
      where work_day_id = new.id and ended_at is null;
  end if;
  return new;
end;
$$;

-- Runs AFTER the status change so the guard trigger sees the old status.
drop trigger if exists work_days_close_open_entries on public.work_days;
create trigger work_days_close_open_entries
  before update of status on public.work_days
  for each row execute function public.close_open_entries_on_finish();

-- --------------------------------------------------------------- indexes
create index if not exists work_days_user_date_idx
  on public.work_days (user_id, work_date desc);

create index if not exists activities_work_day_idx
  on public.activities (work_day_id);

create index if not exists activities_work_day_started_idx
  on public.activities (work_day_id, started_at);

create index if not exists breaks_work_day_idx
  on public.breaks (work_day_id);

create index if not exists months_user_year_month_idx
  on public.months (user_id, year, month);

-- ------------------------------------- automatic profile for new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, timezone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
