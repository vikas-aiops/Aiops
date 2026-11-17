import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

// Session state comes from GET /api/auth/me; the cookie itself is httpOnly and
// never visible to JavaScript.
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, error: null });

  const refresh = useCallback(async () => {
    try {
      const { user } = await api('/auth/me');
      setState({ status: 'signed-in', user, error: null });
    } catch (err) {
      if (err.status === 401) setState({ status: 'signed-out', user: null, error: null });
      else setState({ status: 'error', user: null, error: err });
    }
  }, []);

  useEffect(() => {
    refresh();
    const onExpired = () => setState({ status: 'signed-out', user: null, error: null });
    window.addEventListener('expense:unauthenticated', onExpired);
    return () => window.removeEventListener('expense:unauthenticated', onExpired);
  }, [refresh]);

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      async signIn(email, password) {
        const { user } = await api('/auth/signin', { method: 'POST', body: { email, password } });
        setState({ status: 'signed-in', user, error: null });
      },
      async signUp(displayName, email, password) {
        const { user } = await api('/auth/signup', { method: 'POST', body: { displayName, email, password } });
        setState({ status: 'signed-in', user, error: null });
      },
      async signOut() {
        try {
          await api('/auth/signout', { method: 'POST' });
        } finally {
          setState({ status: 'signed-out', user: null, error: null });
        }
      },
      setUser(user) {
        setState((s) => ({ ...s, user }));
      },
    }),
    [state, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
