import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, LineChart, ListOrdered, LogOut, PiggyBank, Plus, Settings, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/common';
import { MonthPicker } from '@/components/month-picker';
import { ExpenseSheet } from '@/components/expense-sheet';
import { useAuth } from '@/lib/auth';
import { useAppState } from '@/lib/app-state';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, title: 'Dashboard', month: true },
  { to: '/expenses', label: 'Expenses', short: 'Expenses', icon: ListOrdered, title: 'Expenses', month: false },
  { to: '/categories', label: 'Categories', short: 'Categories', icon: Tags, title: 'Categories', month: true, mobileTab: false },
  { to: '/budgets', label: 'Budgets', short: 'Budgets', icon: PiggyBank, title: 'Budgets', month: true },
  { to: '/insights', label: 'Insights', short: 'Insights', icon: LineChart, title: 'Insights', month: true },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings, title: 'Settings', month: false },
];

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const { openNewExpense } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const page = NAV.find((n) => location.pathname.startsWith(n.to)) ?? NAV[0];

  async function handleSignOut() {
    await signOut();
    navigate('/signin', { replace: true });
  }

  return (
    <div className="min-h-dvh desk:pl-[248px]">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-stamp-amber px-3 py-2 text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-ink-line bg-ink-raised desk:flex">
        <div className="px-5 pt-6 pb-8">
          <Wordmark />
        </div>
        <nav aria-label="Main" className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'group flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors',
                  isActive ? 'bg-ink-hover text-paper' : 'text-ink-muted hover:bg-ink-hover/60 hover:text-paper',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('size-[18px]', isActive && 'text-stamp-amber')} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink-line p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill bg-paper font-display text-sm font-semibold text-ink">
              {initials(user?.displayName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-paper">{user?.displayName}</span>
              <span className="block truncate text-xs text-ink-muted">{user?.email}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-1 flex h-9 w-full items-center gap-3 rounded-control px-3 text-sm text-ink-muted transition-colors hover:bg-ink-hover/60 hover:text-paper"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-ink-line bg-ink-raised/95 backdrop-blur">
        <div className="flex h-16 max-w-[1248px] items-center gap-3 px-4 sm:px-6 desk:px-8">
          <span className="desk:hidden">
            <Wordmark compact />
          </span>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-paper desk:text-xl">{page.title}</h1>
          {page.month && <MonthPicker className="max-[420px]:[&>span]:min-w-[6.5rem] max-[420px]:[&>span]:text-xs" />}
          <Button onClick={openNewExpense} className="hidden desk:inline-flex">
            <Plus /> Add expense
          </Button>
        </div>
      </header>

      <main id="main" className="max-w-[1248px] px-4 pt-6 pb-28 sm:px-6 desk:px-8 desk:pt-8 desk:pb-12">
        <Outlet />
      </main>

      {/* Mobile: floating "Add expense" and bottom tab bar */}
      <Button
        onClick={openNewExpense}
        className="fixed right-4 bottom-[84px] z-30 size-14 rounded-pill shadow-float desk:hidden [&_svg]:size-6"
        aria-label="Add expense"
      >
        <Plus />
      </Button>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-line bg-ink-raised pb-[env(safe-area-inset-bottom)] desk:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {NAV.filter((n) => n.mobileTab !== false).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors',
                    isActive ? 'text-stamp-amber' : 'text-ink-muted hover:text-paper',
                  )
                }
              >
                <item.icon className="size-5" />
                {item.short}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <ExpenseSheet />
    </div>
  );
}
