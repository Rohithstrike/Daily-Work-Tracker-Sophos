import { Outlet } from 'react-router-dom';
import { Clock3 } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Workday Activity Tracker
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Record your daily work, breaks and monthly summaries.
            </p>
          </div>
        </div>
        <main className="card p-6">
          <Outlet />
        </main>
        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Never record customer names, case contents, credentials or other confidential information.
        </p>
      </div>
    </div>
  );
}
