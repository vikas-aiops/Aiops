import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { currentMonth } from './format';

// App-wide UI state:
//  - month:     the month selected in the top bar (YYYY-MM)
//  - version:   bumped after every write so every data view refetches
//  - sheet:     the add / edit expense slide-over
//  - stampId:   the expense that was just saved; its ledger row plays the stamp
const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [month, setMonth] = useState(currentMonth);
  const [version, setVersion] = useState(0);
  const [sheet, setSheet] = useState({ open: false, expense: null });
  const [stampId, setStampId] = useState(null);
  const stampTimer = useRef(null);

  const invalidate = useCallback(() => setVersion((v) => v + 1), []);

  const stamp = useCallback((id) => {
    clearTimeout(stampTimer.current);
    setStampId(id);
    stampTimer.current = setTimeout(() => setStampId(null), 2200);
  }, []);
  useEffect(() => () => clearTimeout(stampTimer.current), []);

  const value = useMemo(
    () => ({
      month,
      setMonth,
      version,
      invalidate,
      sheet,
      openNewExpense: () => setSheet({ open: true, expense: null }),
      openEditExpense: (expense) => setSheet({ open: true, expense }),
      closeSheet: () => setSheet((s) => ({ ...s, open: false })),
      stampId,
      stamp,
    }),
    [month, version, invalidate, sheet, stampId, stamp],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  return useContext(AppStateContext);
}

// Fetches `path` (skipped when null) and refetches whenever path or the global
// data version changes. Keeps the previous data while refetching, so views
// don't flash back to skeletons after every save.
export function useApi(path) {
  const { version } = useAppState();
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { signal: controller.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((s) => ({ data: s.data, error, loading: false }));
      });
    return () => controller.abort();
  }, [path, version, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
