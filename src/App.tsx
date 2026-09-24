import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/ProtectedRoute';
import { LoadingState } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { isSupabaseConfigured } from '@/lib/supabase';
import TodayPage from '@/features/today/TodayPage';
import SignInPage from '@/features/auth/SignInPage';
import SignUpPage from '@/features/auth/SignUpPage';
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/features/auth/ResetPasswordPage';

// Heavy pages are code-split so the Today page never downloads Recharts or ExcelJS.
const HistoryPage = lazy(() => import('@/features/history/HistoryPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

export function App() {
  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Alert tone="warning" title="Configuration required" className="max-w-lg">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and
          set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </Alert>
      </main>
    );
  }

  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        {/* Reset password is reachable while a recovery session exists. */}
        <Route element={<AuthLayout />}>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/today" element={<TodayPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </Suspense>
  );
}
