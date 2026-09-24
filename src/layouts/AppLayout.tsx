import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  Clock3,
  FileSpreadsheet,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/hooks/useTheme';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/utils/cn';

const NAV_ITEMS = [
  { to: '/today', label: 'Today', icon: Clock3 },
  { to: '/history', label: 'History', icon: CalendarDays },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  useTheme(profile?.theme);

  const handleSignOut = async () => {
    await signOut();
    navigate('/sign-in', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <a href="#main-content" className="sr-skip">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
            Workday
            <br />
            Activity Tracker
          </span>
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="truncate px-2 text-xs text-slate-500 dark:text-slate-400">
            {profile?.name ?? profile?.email}
          </p>
          <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden dark:border-slate-800 dark:bg-slate-900">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
          </span>
          Workday Activity Tracker
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </Button>
      </header>

      {menuOpen ? (
        <div
          id="mobile-menu"
          className="sticky top-[57px] z-30 border-b border-slate-200 bg-white px-3 py-2 lg:hidden dark:border-slate-800 dark:bg-slate-900"
        >
          <nav aria-label="Mobile navigation" className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} onNavigate={() => setMenuOpen(false)} />
            ))}
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </nav>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start"
            onClick={() => setMenuOpen(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Close
          </Button>
        </div>
      ) : null}

      {!online ? (
        <div
          role="alert"
          className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white"
        >
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          You are offline. Changes cannot be saved until the connection returns.
        </div>
      ) : null}

      <main id="main-content" className="px-4 pb-24 pt-4 sm:px-6 lg:ml-60 lg:pb-10 lg:pt-6">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden dark:border-slate-800 dark:bg-slate-900"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                isActive
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-slate-500 dark:text-slate-400',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{label}</span>
                <span className="sr-only">{isActive ? '(current page)' : ''}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof Clock3;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-5 w-5" aria-hidden="true" />
          <span>{label}</span>
          {isActive ? <span className="sr-only">(current page)</span> : null}
        </>
      )}
    </NavLink>
  );
}
