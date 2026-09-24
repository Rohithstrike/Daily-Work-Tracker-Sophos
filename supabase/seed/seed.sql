-- =====================================================================
-- Optional development seed.
-- Replace :user_id with your own auth user id before running.
-- Never seed production data that resembles real customer information.
-- =====================================================================
\set user_id '00000000-0000-0000-0000-000000000000'

insert into public.work_days (user_id, work_date, started_at, finished_at, status)
values (:'user_id', date '2026-09-01', timestamptz '2026-09-01 03:00:00+00', timestamptz '2026-09-01 12:00:00+00', 'completed')
on conflict (user_id, work_date) do nothing;

with day as (
  select id from public.work_days where user_id = :'user_id' and work_date = date '2026-09-01'
)
insert into public.activities (work_day_id, type, priority, quantity, started_at, ended_at, notes)
select day.id, v.type::public.activity_type, v.priority::public.activity_priority, v.quantity, v.started_at, v.ended_at, v.notes
from day, (values
  ('CASE',        'P1', 3, timestamptz '2026-09-01 03:05:00+00', timestamptz '2026-09-01 04:10:00+00', null),
  ('AR',          'P2', 4, timestamptz '2026-09-01 04:10:00+00', timestamptz '2026-09-01 05:00:00+00', 'CX replied'),
  ('IR',          null, 1, timestamptz '2026-09-01 05:00:00+00', timestamptz '2026-09-01 06:30:00+00', null),
  ('THREAT_HUNT', null, 2, timestamptz '2026-09-01 06:30:00+00', timestamptz '2026-09-01 07:25:00+00', 'Authentication pattern review')
) as v(type, priority, quantity, started_at, ended_at, notes);

with day as (
  select id from public.work_days where user_id = :'user_id' and work_date = date '2026-09-01'
)
insert into public.breaks (work_day_id, type, started_at, ended_at)
select day.id, 'LUNCH', timestamptz '2026-09-01 07:25:00+00', timestamptz '2026-09-01 08:14:00+00' from day;
