import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoadingState } from '@/components/ui/Spinner';

export function ProtectedRoute() {
  const { session, initialising } = useAuth();
  const location = useLocation();

  if (initialising) return <LoadingState label="Loading workspace…" />;
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { session, initialising } = useAuth();
  if (initialising) return <LoadingState label="Loading…" />;
  if (session) return <Navigate to="/today" replace />;
  return <Outlet />;
}
