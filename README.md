# Workday Activity Tracker

A private, production-quality web application for recording office work activity day by day and
month by month. Built for long-term daily use: React 18 + TypeScript on the front end, Supabase
PostgreSQL as the permanent source of truth, and Vercel for hosting.

---

## 1. Purpose

Record what you worked on throughout each working day — the category of work, its priority (where
applicable), how many items, when you started and stopped, your lunch break and short notes — and
turn that into daily timelines, monthly history and professionally formatted Excel reports.

The database is the only source of truth. Excel files, GitHub and browser storage are outputs or
caches, never the record itself.

---

## 2. Work categories

| Category | Code | Priority | Meaning |
|---|---|---|---|
| Case | `CASE` | P1–P4 required | Standard case worked during the day |
| AR | `AR` | P1–P4 required | Action Required — an escalated case received a response and needs further action |
| Dupe | `DUPE` | P1–P4 required | Duplicate cases |
| IR | `IR` | None (NULL) | Incident response work |
| Peer Review | `PEER_REVIEW` | P1–P4 required | Reviewing a colleague's work |
| Miscalculation / Help | `MISC_HELP` | None (NULL) | Helping a colleague or calculation-related work |
| Threat Hunt | `THREAT_HUNT` | None (NULL) | Proactive threat-hunting work |
| Lunch | break, not an activity | — | Recorded as Start Lunch / Resume Work |

---

## 3. Business rules

- Case, AR, Dupe and Peer Review **require** a priority of P1, P2, P3 or P4.
- IR, Miscalculation / Help and Threat Hunt **must** store `NULL` as their priority. P1–P4 is never
  displayed for them anywhere in the UI, charts or reports.
- Quantity is an integer between **1 and 999**.
- Notes are optional and limited to **500 characters**.
- Lunch may start at any time and has **no maximum duration**. A 49-minute lunch is stored as
  49 minutes; a 1 hour 11 minute lunch is stored as 1 hour 11 minutes, never truncated.
- Only **one open break** may exist per workday.
- Only **one workday** may exist per user per date.
- A completed day rejects record changes until it is explicitly reopened. Reopening never deletes
  data.
- Month status is always an explicit user decision. A month never becomes "completed" because the
  calendar month ended.
- Working time = elapsed time from start to finish, **minus** break time.

All of these rules live in one place, `src/lib/activityRules.ts`, and are mirrored as CHECK
constraints and triggers in PostgreSQL.

---

## 4. Architecture

```
src/
├── components/ui/     Accessible, reusable UI primitives (Button, Field, Dialog, Toast…)
├── features/          Feature slices: auth, today, history, dashboard, reports, settings
├── hooks/             React state and orchestration (useWorkday, useNow, useTheme…)
├── layouts/           App shell and auth shell
├── lib/               Pure business logic: activityRules, schemas, summary, timeline, errors
├── services/          All Supabase access plus report and Excel generation
├── types/             Domain types
└── utils/             Date, duration, filename and class-name helpers
supabase/
├── migrations/        Schema, constraints, triggers, indexes, RLS
├── seed/              Optional development seed
└── tests/             SQL constraint and RLS tests
tests/                 Vitest unit tests over the pure logic
```

Responsibilities are strictly separated: components render, hooks orchestrate, services talk to
Supabase, `lib/` holds pure logic. Monthly reports are never calculated inside a React component.

---

## 5. Database model

| Table | Key fields | Notes |
|---|---|---|
| `profiles` | id (= `auth.users.id`), name, email, timezone, week_starts_on, report_prefix, theme | Created automatically by a trigger on sign-up |
| `work_days` | id, user_id, work_date, started_at, finished_at, status | `UNIQUE(user_id, work_date)`; status `active` / `completed` |
| `activities` | id, work_day_id, type, priority, quantity, started_at, ended_at, duration_seconds, notes | Priority/type CHECK constraint mirrors `ACTIVITY_RULES` |
| `breaks` | id, work_day_id, type, started_at, ended_at, duration_seconds | Partial unique index allows one open break per day |
| `months` | id, user_id, year, month, status, completed_at, exported_at | `UNIQUE(user_id, year, month)`; `in_progress` / `completed` / `exported` |

Triggers maintain `updated_at`, calculate `duration_seconds` whenever `ended_at` is present, close
open entries when a day is finished, and block changes to a completed day.

Indexes: `work_days(user_id, work_date)`, `activities(work_day_id)`,
`activities(work_day_id, started_at)`, `breaks(work_day_id)`, `months(user_id, year, month)`.

---

## 6. Local setup

Requires **Node.js 22.x** and **npm 10.x** (see `.nvmrc` and the `engines` field).

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase values
npm run dev
```

---

## 7. Supabase setup

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run, in order:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_row_level_security.sql`
3. Copy **Project URL** and the **anon / publishable** key from Project Settings → API.
4. Optional: verify the database with `supabase/tests/constraints_test.sql` and
   `supabase/tests/rls_test.sql`. Both scripts roll back, so they are safe to run.

---

## 8. Environment variables

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon or publishable key (`sb_publishable_…`) — a public browser key |
| `VITE_DEFAULT_REPORT_PREFIX` | Default Excel filename prefix, e.g. `OC` |

**Never** place a service-role key, an `sb_secret_…` key, a database password, a Supabase access
token or a GitHub token in these variables or anywhere in the front end. Security is enforced by
Row Level Security in PostgreSQL. `.env.local` is git-ignored — confirm it is not staged before
every commit:

```bash
git status --short          # .env.local must not appear
```

---

## 9. Testing

```bash
npm run typecheck
npm test
npm run lint
```

`tests/` covers the activity rules, lunch durations, daily and monthly totals, work time minus
breaks, month isolation (September never contains October), timeline ordering, export filenames
and timezone-based work dates. The database-level guarantees — one workday per user/date, cross-user
isolation and locked completed days — are exercised by the SQL scripts in `supabase/tests/`.

---

## 10. Production build

```bash
npm install
npm run typecheck
npm test
npm run build
```

All four must succeed before deploying. npm deprecation warnings are not build failures; only a
non-zero exit code is.

---

## 11. Vercel deployment

From a private GitHub repository:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` (or `npm ci`) |
| Root directory | `./` |

Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_DEFAULT_REPORT_PREFIX` under
Settings → Environment Variables, for Production and Preview.

Do **not** enable Vercel's optional Supabase integration — it creates a second database. This app
already points at your existing Supabase project.

`vercel.json` contains the SPA rewrite so that `/sign-in`, `/sign-up`, `/forgot-password`,
`/today`, `/history`, `/dashboard`, `/reports` and `/settings` all work on a hard refresh instead of
returning 404.

After the first successful deployment, add the production URL in Supabase under
**Authentication → URL Configuration**:

- **Site URL**: `https://<your-app>.vercel.app`
- **Redirect URLs**: `https://<your-app>.vercel.app/**`, including `/reset-password`

Without this, password-reset links will not return to the app in production.

---

## 12. Updating the application

```bash
git add -A
git commit -m "Describe the change"
git push
```

Vercel redeploys automatically on push. `package-lock.json` must stay committed so builds are
reproducible.

If a deployment fails: read the **first** actual error line, confirm the commit contains your latest
work, confirm `package-lock.json` is committed, confirm Node and npm are pinned, confirm the
environment variables exist in Vercel, then reproduce the exact production build locally with
`npm run build`.

---

## 13. Privacy principles

This application stores **work metadata only**: category, priority, quantity, timings and short
notes such as `CX replied`.

Never record customer names, email addresses, personal information, case contents, credentials,
indicators of compromise or confidential company information.

---

## 14. Offline behaviour

The current version detects connection loss and tells you when a write was not saved. It never
pretends an unsaved activity was stored, and it never treats browser storage as the source of truth.
A future IndexedDB sync queue is documented in [`docs/offline-queue.md`](docs/offline-queue.md).

---

## 15. Licence

MIT — see [LICENSE](LICENSE).
