import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppStateProvider } from '@/lib/app-state';
import { AppShell } from '@/components/app-shell';
import { ErrorState, Wordmark } from '@/components/common';
import { Toaster } from '@/components/ui/misc';
import { SignInPage, SignUpPage } from '@/pages/auth';
import { DashboardPage } from '@/pages/dashboard';
import { ExpensesPage } from '@/pages/expenses';
import { CategoriesPage } from '@/pages/categories';
import { BudgetsPage } from '@/pages/budgets';
import { InsightsPage } from '@/pages/insights';
import { SettingsPage } from '@/pages/settings';

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Loading">
      <Wordmark className="animate-pulse" />
    </div>
  );
}

// Auth-gated routing, driven by GET /api/auth/me.
function RequireAuth({ children }) {
  const { status, error, refresh } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="paper-card w-full max-w-md">
          <ErrorState error={error} onRetry={refresh} title="We couldn't reach the server" />
        </div>
      </div>
    );
  }
  if (status === 'signed-out') return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return children;
}

function GuestOnly({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status === 'signed-in') return <Navigate to="/dashboard" replace />;
  return children;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppStateProvider>
          <Routes>
            <Route path="/signin" element={<GuestOnly><SignInPage /></GuestOnly>} />
            <Route path="/signup" element={<GuestOnly><SignUpPage /></GuestOnly>} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/budgets" element={<BudgetsPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <Toaster />
        </AppStateProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
